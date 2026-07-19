# -*- coding: utf-8 -*-
"""Opta pipeline otomasyonu: keşif -> eksik maç tespiti -> parse -> staging -> load.

Haftalık akış (manuel CSV hazırlamaya son):
  1. Sezon sonuç sayfasından tüm maç linkleri toplanır (headless Selenium).
  2. raw.match_json_staging ile karşılaştırılır; sadece eksik maçlar kalır.
  3. Eksikler için mevcut unified parser (headless) çalıştırılır.
  4. Batch staging'e yazılır, ardından loader'lar koşulur (upsert, idempotent).

Kullanım:
  .venv\\Scripts\\python.exe src\\football\\auto_opta_pipeline.py            # tam akış
  .venv\\Scripts\\python.exe src\\football\\auto_opta_pipeline.py --dry-run  # sadece keşif+fark
  .venv\\Scripts\\python.exe src\\football\\auto_opta_pipeline.py --limit 2  # ilk N eksik maç

Zamanlanmış görev (haftalık) bu dosyayı argümansız çağırır; yeni maç yoksa
hiçbir şey yapmadan çıkar. Yeni sezon eklemek için SEASONS listesine
(sonuç sayfası URL'i) satır eklemek yeterli.
"""
import argparse
import csv
import importlib.util
import json
import logging
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import dotenv_values
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_DIR = Path(__file__).resolve().parents[2]          # oddskeeper/
SRC_DIR = BASE_DIR / "src" / "football"
# Üretim scraper'ı: staging payload formatını (match_info + page_status +
# overall_status) doğrudan üretir; takım id'lerini de doğru çıkarır.
PARSER_PATH = SRC_DIR / "parse_backup2_integrated_v8.py"
UNIFIED_DIR = BASE_DIR / "data" / "raw" / "opta_unified_matches"
BATCH_ROOT = BASE_DIR / "data" / "raw" / "auto_batches"
LOG_DIR = BASE_DIR / "data" / "logs"
for p in (BATCH_ROOT, LOG_DIR):
    p.mkdir(parents=True, exist_ok=True)

ENV = dotenv_values(BASE_DIR / ".env")
SUPABASE_URL = (ENV.get("SUPABASE_URL") or "").strip().strip('"')
SUPABASE_KEY = (ENV.get("SUPABASE_SECRET_KEY") or "").strip().strip('"')

# Headless Chrome'un UA'sındaki "HeadlessChrome" imzasına site boş sayfa döndürüyor;
# normal Chrome UA'sı ile headless sorunsuz çalışıyor (çerez onayı da gerekmiyor).
CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
)

OPTA_BASE = "https://optaplayerstats.statsperform.com"
SEASONS = [
    {
        "label": "2025-2026",
        "results_url": f"{OPTA_BASE}/en_GB/soccer/s%C3%BCper-lig-2025-2026/97zghcaoec1isvvdkh9ud50d0/results",
    },
    {
        "label": "2026-2027",
        "results_url": f"{OPTA_BASE}/en_GB/soccer/s%C3%BCper-lig-2026-2027/e00dq6lfzgc7vo631cz8ktc0k/results",
    },
]

DISCOVERY_WAIT_SECONDS = 25
LOADERS = [
    "load_staging_to_football_matches.py",
    "load_staging_to_football_match_incidents.py",
    "load_staging_to_football_match_player_stats_opta_points.py",
    "load_staging_to_football_match_player_stats_details.py",
    "load_staging_to_football_match_team_stats.py",
]

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = LOG_DIR / f"auto_pipeline_{ts}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(log_file, encoding="utf-8")],
)


def load_parser_module():
    spec = importlib.util.spec_from_file_location("opta_prod_parser", PARSER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules["opta_prod_parser"] = module
    spec.loader.exec_module(module)
    return module


def match_json_ok(match_id: str) -> bool:
    """Per-match çıktı sağlıklı mı (v8 formatı): overall_status ok VE
    match_summary.match_info'da takım adları dolu, takım id'leri gerçek."""
    path = UNIFIED_DIR / f"{match_id}.json"
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("overall_status") != "ok":
            return False
        mi = (data.get("match_summary") or {}).get("match_info") or {}
        for side in ("home_team", "away_team"):
            team = mi.get(side) or {}
            if not (team.get("name") or "").strip():
                return False
            tid = (team.get("source_team_id") or "").strip()
            if tid in ("", "Left", "Right"):
                return False
        return True
    except Exception:
        return False


def make_headless_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument(f"--user-agent={CHROME_UA}")
    options.add_argument("--window-size=1400,1000")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--log-level=3")
    return webdriver.Chrome(options=options)


def discover_match_urls() -> dict:
    """{match_id: match_view_url} - tüm konfigüre sezonlardan."""
    driver = make_headless_driver()

    found = {}
    try:
        for season in SEASONS:
            logging.info(f"Keşif: {season['label']} -> {season['results_url']}")
            driver.get(season["results_url"])
            time.sleep(4)
            try:
                driver.execute_script(
                    "window.UC_UI && window.UC_UI.acceptAllConsents && window.UC_UI.acceptAllConsents()"
                )
            except Exception:
                pass

            links = []
            deadline = time.monotonic() + DISCOVERY_WAIT_SECONDS
            while time.monotonic() < deadline:
                links = driver.execute_script(
                    "return [...new Set([...document.querySelectorAll('a[href*=\"match/view/\"]')]"
                    ".map(a => a.href))]"
                )
                if links:
                    # linkler gelmeye başladı; render bitene kadar kısa ek bekleme
                    time.sleep(4)
                    links = driver.execute_script(
                        "return [...new Set([...document.querySelectorAll('a[href*=\"match/view/\"]')]"
                        ".map(a => a.href))]"
                    )
                    break
                time.sleep(2)

            logging.info(f"  {season['label']}: {len(links)} maç linki bulundu")
            for href in links:
                match_id = href.split("match/view/")[-1].split("/")[0].strip()
                if match_id:
                    # /match/view/<id> ana sayfası (parser kendi alt sayfalarını türetir)
                    found[match_id] = href.split("/match/view/")[0] + "/match/view/" + match_id
    finally:
        driver.quit()

    return found


def staged_match_ids() -> set:
    ids = set()
    offset = 0
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept-Profile": "raw",
    }
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/match_json_staging"
            f"?select=source_match_id&source=eq.opta&order=id&limit=1000&offset={offset}",
            headers=headers, timeout=30,
        )
        r.raise_for_status()
        chunk = r.json()
        ids.update(row["source_match_id"] for row in chunk)
        if len(chunk) < 1000:
            return ids
        offset += 1000


def _parse_urls(parser_module, urls: list, csv_path: Path) -> None:
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["url"])
        for u in urls:
            writer.writerow([u])

    # v8'i otomasyon moduna çek: CSV bizimki, sayı sınırı yok, görünür tam
    # pencere (headless'ta site eksik render ediyor; küçültülmüş pencerede de
    # Chrome render'ı kısıp widget'ları yüklemiyor - timeout fırtınası).
    parser_module.CSV_PATH = str(csv_path)
    parser_module.MAX_MATCH_COUNT = 1000
    parser_module.HEADLESS_MODE = False
    parser_module.MINIMIZE_WINDOW = False
    parser_module.KEEP_BROWSER_OPEN = False
    parser_module.main()


def run_parser(parser_module, missing: dict, batch_dir: Path) -> Path:
    """missing: {match_id: url}. Daha önce başarıyla parse edilenler atlanır,
    hatalılar bir kez otomatik yeniden denenir; batch per-match dosyalardan kurulur."""
    todo = {mid: url for mid, url in missing.items() if not match_json_ok(mid)}
    skipped = len(missing) - len(todo)
    if skipped:
        logging.info(f"{skipped} maç zaten başarıyla parse edilmiş, atlanıyor")

    if todo:
        _parse_urls(parser_module, list(todo.values()), batch_dir / "input_matches.csv")

    retry = {mid: url for mid, url in todo.items() if not match_json_ok(mid)}
    if retry:
        logging.info(f"{len(retry)} maç hatalı; bir kez yeniden deneniyor")
        _parse_urls(parser_module, list(retry.values()), batch_dir / "retry_matches.csv")
        still_bad = [mid for mid in retry if not match_json_ok(mid)]
        if still_bad:
            logging.warning(f"Tekrar denemeye rağmen hatalı kalan maçlar: {still_bad}")

    records = []
    for mid in sorted(missing):
        path = UNIFIED_DIR / f"{mid}.json"
        if path.exists():
            records.append(json.loads(path.read_text(encoding="utf-8")))
        else:
            logging.warning(f"Parse çıktısı yok, batch dışı: {mid}")

    batch_json = batch_dir / "batch_matches.json"
    batch_json.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    # bulk_write_v2 (parser formatını doğru işleyen yazıcı) sabit olarak
    # all_matches.json'ı okur; batch içeriğini oraya da yazıyoruz.
    (UNIFIED_DIR / "all_matches.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logging.info(f"Batch oluşturuldu: {len(records)} maç -> {batch_json}")
    return batch_json


def run_step(script: str, args: list = None, strict: bool = False) -> None:
    cmd = [sys.executable, str(SRC_DIR / script)] + (args or [])
    logging.info(f"ADIM: {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(
        cmd, cwd=str(BASE_DIR), capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    # Alt scriptler logging ile stderr'e yazıyor; iki akışın da kuyruğunu logla.
    tail = "\n".join(
        ((result.stdout or "") + "\n" + (result.stderr or "")).strip().splitlines()[-10:]
    )
    logging.info(f"  çıktı (son satırlar):\n{tail}")
    if result.returncode != 0:
        raise RuntimeError(f"{script} hata verdi (kod {result.returncode}):\n{tail}")
    if strict and "Traceback" in (result.stderr or ""):
        raise RuntimeError(f"{script} çıktısında hata izi var; akış durduruldu.")


def close_played_fixtures() -> None:
    """Oynanmış maçı olan 'scheduled' fikstür satırlarını completed yapar.
    Takım çifti + sezon üzerinden eşleşir; böylece fikstür tarihi kaymış
    (ertelenmiş/öne alınmış) maçlar da doğru kapanır."""
    dsn = (ENV.get("DATABASE_URL") or "").strip().strip('"')
    if not dsn:
        logging.info("DATABASE_URL tanımlı değil; fikstür kapatma adımı atlandı")
        return
    try:
        import psycopg2
    except ImportError:
        logging.info("psycopg2 kurulu değil; fikstür kapatma adımı atlandı")
        return
    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor()
        cur.execute("""
            update football.fixtures f
            set fixture_status = 'completed', updated_at = now()
            where f.fixture_status = 'scheduled'
              and exists (
                  select 1 from football.matches m
                  where m.home_team_source_id = f.home_team_source_id
                    and m.away_team_source_id = f.away_team_source_id
                    and m.season_label = f.season_label
                    and m.home_score is not null
              )""")
        logging.info(f"Oynanmış fikstür kapatıldı: {cur.rowcount}")
        conn.commit()
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="sadece keşif + fark raporu")
    ap.add_argument("--limit", type=int, default=None, help="ilk N eksik maçla sınırla")
    args = ap.parse_args()

    if not (SUPABASE_URL and SUPABASE_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY (oddskeeper/.env)")

    parser_module = load_parser_module()

    discovered = discover_match_urls()
    logging.info(f"Keşfedilen toplam maç: {len(discovered)}")
    if not discovered:
        logging.error("Hiç maç linki bulunamadı; site yapısı değişmiş olabilir.")
        raise SystemExit(2)

    staged = staged_match_ids()
    logging.info(f"Staging'de mevcut: {len(staged)}")

    missing = {mid: url for mid, url in discovered.items() if mid not in staged}
    logging.info(f"Eksik maç: {len(missing)}")
    for mid in sorted(missing):
        logging.info(f"  eksik: {mid}")

    if args.dry_run or not missing:
        logging.info("Yapılacak iş yok." if not missing else "Dry-run bitti.")
        return

    if args.limit:
        missing = dict(sorted(missing.items())[: args.limit])

    batch_dir = BATCH_ROOT / ts
    batch_dir.mkdir(parents=True, exist_ok=True)
    logging.info(f"Batch klasörü: {batch_dir} ({len(missing)} maç)")

    run_parser(parser_module, missing, batch_dir)

    # Not: batch_v1 yazıcısı parser formatındaki (normalized_urls içindeki)
    # source_match_id'yi görmüyor; v2 yazıcısı doğru işliyor ve
    # all_matches.json'ı (üstte batch içeriğiyle dolduruldu) okuyor.
    run_step("bulk_write_match_json_staging_v2.py", strict=True)
    for loader in LOADERS:
        run_step(loader)

    close_played_fixtures()

    logging.info("TAMAM. Otomatik akış bitti.")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Gunluk log triyaji (sahip istegi 2026-08-31): log_digest'in "N hata isareti"
ham ozetini SINIFLANDIRILMIS tek ntfy bildirimine cevirir.

Neden: eski digest her sabah "match_scrape.log: 706 hata isareti" gibi ham sayi
atiyordu; hangisinin zararsiz oldugu bildirimden anlasilmiyordu. Bu katman ayni
pos mekanizmasiyla ayni satirlari okur ama uc seviyeye ayirir ve karari basliga
yazar:

  NOISE  bilinen zararsiz desenler (yalniz sayi olarak raporlanir)
  WARN   bilinen gecici siniflar (bos kosu, 403/5xx, fetch hatasi) ve
         "FAILED ama ayni is sonraki kosuda OK" (kendini toparlama tespiti)
  CRIT   geri kalan HER SEY (fail-loud: bilinmeyen desen asla gurultu sayilmaz)

Seviye kurali:
  - CRIT varsa baslik KRITIK (priority high)
  - WARN bir desen ayni gun >=2 kez YA DA >=2 gun ust uste ise baslik Uyari
    (tekrar esigi); tekil WARN'lar "izlemede" olarak OK basligi altinda kalir
  - NOISE sayisi son 7 gun medyaninin 3 katini (ve 20'yi) asarsa Uyari uretir
  - temiz gunde de dusuk oncelikli "OK" bildirimi gider (dead man's switch:
    bildirim hic gelmiyorsa digest'in kendisi olmus demektir).
    Kapatmak icin pipeline/.env -> NTFY_DIGEST_HEARTBEAT=0

Durum dosyalari (log_digest.sh ile PAYLASILIR, format ayni):
  digest_state/<log>.pos           son okunan satir numarasi
  digest_state/triage_history.json desen-basina gunluk sayilar (tekrar/spike)

Kullanim: log_triage.py [--dry-run] [--from-start]
  --dry-run    pos/history YAZMAZ, bildirim ATMAZ; raporu stdout'a basar
  --from-start pos'lari yok sayip dosyalari bastan tarar (kalibrasyon testi)
Cikis kodu 0 = analiz tamam (bildirim hatasi yutulur; opsiyonel katman).
Analiz exception'inda rc!=0 ve pos ILERLEMEZ -> log_digest.sh ham fallback'e
duser, ayni chunk'i o tarar.
"""
import json
import re
import statistics
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    ROOT = Path(__file__).resolve().parents[2]  # .../pipeline
except IndexError:  # repo disina kopyalanmis (ör. /tmp testi)
    ROOT = Path("/opt/oddskeeper/repo/oddskeeper-web/pipeline")
LOGDIR = Path("/opt/oddskeeper/logs")
STATE = Path("/opt/oddskeeper/digest_state")
SKIP_FILES = {"digest.log"}

# Eski log_digest.sh ile AYNI yakalama kapsami (K-2 dahil): kapsam daralmasin.
PATTERN = re.compile(r"FAILED|Traceback|FAIL:|\[HATA\]| HATA:|UYARI|NotNullViolation|SystemExit")

# Siniflandirma kurallari: (kural_id, regex, seviye, bildirimde gorunen kisa aciklama)
# SIRALI degerlendirilir; ilk eslesen kazanir. Hicbiri eslesmezse:
# satir UYARI iceriyorsa WARN(bilinmeyen uyari), degilse CRIT(bilinmeyen desen).
RULES = [
    # --- NOISE: bilinen zararsiz ---
    ("scrape_hash_dedup", re.compile(r"UYARI: scrape_hash check_and_store"), "noise",
     "scrape_hash dedup bug'i (bilinen, fail-open; fix bekliyor)"),
    ("kupa_gol_detay", re.compile(r"UYARI ham gol \d+ != skor"), "noise",
     "kupa eleme gol-detay boslugu (kaynak vermiyor; skor dogru)"),
    # --- WARN: bilinen gecici siniflar ---
    ("odds_bos_kosu", re.compile(r"\[HATA\] ikinci deneme de verisiz"), "warn",
     "Bets10 bos kosu; gunde 4 kosu, sonraki telafi eder"),
    ("http_403_challenge", re.compile(r"HTTP 403|challenge"), "warn",
     "kaynak 403/challenge (gecici bot korumasi)"),
    ("http_5xx", re.compile(r"HTTP 50\d"), "warn",
     "kaynak site 5xx (gecici)"),
    ("ssl_proxy", re.compile(r"CertificateVerifyError|SSL certificate|curl: \(\d+\)"), "warn",
     "SSL/proxy gecici arizasi"),
    ("fetch_bos_kosu", re.compile(r"FETCH FAILED"), "warn",
     "fetch kosusu bos gecti; 10dk sonraki kosu telafi eder"),
    ("lig_fetch_hata", re.compile(r"^\[[^\]]+\] HATA: "), "warn",
     "lig fetch hatasi (gecici ag/kaynak)"),
    # --- CRIT: bilinen kritik siniflar (etiketli gorunsun diye) ---
    ("mapping_health_fail", re.compile(r"=== FAIL: HIGH gaps"), "crit",
     "mapping health HIGH acigi"),
    ("notnull_violation", re.compile(r"NotNullViolation"), "crit",
     "DB NotNullViolation"),
    ("job_failed", re.compile(r"FAILED rc=[1-9]"), "crit",
     "is FAILED bitti"),  # ayni chunk'ta OK'si varsa warn'a iner
    ("traceback", re.compile(r"Traceback"), "crit",
     "beklenmeyen istisna (Traceback)"),
]

# "===== 2026-08-26 18:20:50 UTC CUP FS FAILED rc=1 =====" / "... CUP FS OK ====="
JOB_HDR = re.compile(r"^===== .* UTC (?P<job>.+?) (?P<st>OK|FAILED)")

TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")


def read_env(key, default=""):
    envf = ROOT / ".env"
    try:
        for line in envf.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return default


def classify(line):
    for rule_id, rx, level, desc in RULES:
        if rx.search(line):
            return rule_id, level, desc
    if "UYARI" in line:
        return "bilinmeyen_uyari", "warn", "bilinmeyen UYARI deseni (incele)"
    return "bilinmeyen", "crit", "BILINMEYEN desen (incele!)"


def squash(line, n=150):
    # timestamp'leri sil ki ayni hatanin ornekleri ayni gorunsun
    s = re.sub(r"\d{4}-\d{2}-\d{2}[ T]?[\d:,.]*", "", line).strip()
    return s[:n]


def scan_chunk(base, lines):
    """Chunk'taki hata satirlarini kural bazinda toplar. Doner:
    {key: {"level","desc","count","samples":[...], "recovered":bool}}"""
    # kendini-toparlama: FAILED gorulen is adlarinin sonraki OK'leri
    fails, oks = {}, {}
    for i, ln in enumerate(lines):
        m = JOB_HDR.match(ln)
        if not m:
            continue
        (fails if m.group("st") == "FAILED" else oks).setdefault(m.group("job"), []).append(i)
    recovered_jobs = {j for j, idxs in fails.items()
                      if j in oks and max(oks[j]) > min(idxs)}

    out = {}
    for i, ln in enumerate(lines):
        if not PATTERN.search(ln):
            continue
        rule_id, level, desc = classify(ln)
        recovered = False
        if rule_id == "job_failed":
            m = JOB_HDR.match(ln)
            if m and m.group("job") in recovered_jobs:
                level, recovered = "warn", True
                desc = "is FAILED ama sonraki kosuda toparladi"
        key = f"{rule_id}@{base}"
        ev = out.setdefault(key, {"level": level, "desc": desc, "count": 0,
                                  "samples": [], "recovered": recovered, "file": base})
        ev["count"] += 1
        if len(ev["samples"]) < 2:
            ev["samples"].append(squash(ln))
        # ayni kural hem recovered hem degilse: toparlamayan varsa crit kalsin
        if ev["level"] == "warn" and level == "crit":
            ev["level"], ev["recovered"] = "crit", False
    return out


def streak_days(day_counts):
    """Bugun dahil geriye dogru ardisik kac gun count>0 (history + bugun)."""
    n, d = 0, datetime.now(timezone.utc)
    while True:
        key = d.strftime("%Y-%m-%d")
        if day_counts.get(key, 0) > 0:
            n += 1
            d = datetime.fromtimestamp(d.timestamp() - 86400, tz=timezone.utc)
        else:
            return n


def noise_spike(day_counts, today_count):
    prev = [v for k, v in sorted(day_counts.items()) if k != TODAY][-7:]
    if len(prev) < 3:  # sogutma: taban olusmadan spike alarmi verme
        return False, 0
    med = statistics.median(prev)
    return today_count > max(20, 3 * med), med


def notify(title, body, priority, tag):
    topic = read_env("NTFY_TOPIC")
    if not topic:
        return
    try:
        req = urllib.request.Request(
            f"https://ntfy.sh/{topic}", data=body.encode("utf-8"),
            headers={"Title": title, "Priority": priority, "Tags": tag})
        urllib.request.urlopen(req, timeout=10)
    except Exception as exc:  # bildirim opsiyonel katman: hatasi akisi durdurmaz
        print(f"  ntfy gonderilemedi: {exc}", flush=True)


def main():
    dry = "--dry-run" in sys.argv
    from_start = "--from-start" in sys.argv
    STATE.mkdir(parents=True, exist_ok=True)

    hist_f = STATE / "triage_history.json"
    try:
        hist = json.loads(hist_f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        hist = {}

    events = {}   # key -> event dict
    new_pos = {}  # posfile -> satir sayisi (basarili analiz sonunda yazilir)
    for f in sorted(LOGDIR.glob("*.log")):
        if f.name in SKIP_FILES:
            continue
        lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        posf = STATE / f"{f.name}.pos"
        last = 0
        if not from_start and posf.exists():
            try:
                last = int(posf.read_text().strip() or 0)
            except ValueError:
                last = 0
        if last > len(lines):  # rotasyon/kucultme -> bastan
            last = 0
        events.update(scan_chunk(f.name, lines[last:]))
        new_pos[posf] = len(lines)

    # history guncelle (bellekte; yazim en sonda)
    for key, ev in events.items():
        hist.setdefault(key, {})[TODAY] = ev["count"]
    cutoff = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() - 21 * 86400, tz=timezone.utc).strftime("%Y-%m-%d")
    hist = {k: {d: c for d, c in days.items() if d >= cutoff}
            for k, days in hist.items() if any(d >= cutoff for d in days)}

    # --- seviyeleri ve satirlari kur ---
    crit_lines, warn_lines, watch_lines, noise_parts = [], [], [], []
    for key, ev in sorted(events.items(), key=lambda kv: -kv[1]["count"]):
        days = hist.get(key, {})
        stk = streak_days(days)
        label = f"{ev['file']}: {ev['desc']} x{ev['count']}"
        if stk >= 2:
            label += f" ({stk} gundur ust uste)"
        if ev["level"] == "crit":
            crit_lines.append(label + " | ornek: " + (ev["samples"][0] if ev["samples"] else "-"))
        elif ev["level"] == "noise":
            spike, med = noise_spike(days, ev["count"])
            noise_parts.append(f"{key.split('@')[0]} x{ev['count']}")
            if spike:
                warn_lines.append(f"{ev['file']}: gurultu deseninde anormal artis: "
                                  f"{ev['desc']} x{ev['count']} (7g medyan {med:g})")
        else:  # warn
            if ev["count"] >= 2 or stk >= 2:
                warn_lines.append(label)
            else:
                watch_lines.append(label)

    # --- baslik/oncelik karari ---
    if crit_lines:
        title, prio, tag = f"KRITIK: {len(crit_lines)} sorun", "high", "rotating_light"
    elif warn_lines:
        title, prio, tag = f"Uyari: {len(warn_lines)} tekrar eden sorun", "default", "warning"
    else:
        title, prio, tag = "OK - kritik yok", "low", "white_check_mark"

    body_parts = []
    if crit_lines:
        body_parts.append("KRITIK:\n" + "\n".join("- " + s for s in crit_lines))
    if warn_lines:
        body_parts.append("UYARI (tekrar esigi asildi):\n" + "\n".join("- " + s for s in warn_lines))
    if watch_lines:
        body_parts.append("Izlemede (tekil, kendiliginden gecen tur):\n"
                          + "\n".join("- " + s for s in watch_lines))
    if noise_parts:
        body_parts.append("Bilinen gurultu (zararsiz): " + ", ".join(noise_parts))
    if not body_parts:
        body_parts.append("Tum loglar temiz.")
    body = "\n\n".join(body_parts)[:3500]

    now = datetime.now(timezone.utc).strftime("%F %T UTC")
    print(f"{now} triage: {title}")
    print(body, flush=True)

    if dry:
        print("(dry-run: bildirim/pos/history yazilmadi)")
        return

    heartbeat = read_env("NTFY_DIGEST_HEARTBEAT", "1") != "0"
    if crit_lines or warn_lines or watch_lines or heartbeat:
        notify("oddskeeper " + title, body, prio, tag)

    # pos/history YALNIZ analiz + bildirim denemesi bittikten sonra ilerler
    for posf, n in new_pos.items():
        posf.write_text(str(n))
    hist_f.write_text(json.dumps(hist, ensure_ascii=False, indent=0), encoding="utf-8")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Uretim SofaScore fetcher: cok-macli, grace-period'li.

Proxy (PROXY_URL, .env) uzerinden curl_cffi ile SofaScore'dan guncel sezonun
son bitmis maclarini kesfeder, GRACE-PERIOD gecmis olanlari cekip mevcut
load_sofascore_1lig_player_stats.py mantigiyla (match_row/player_rows/upsert)
football.matches + football.match_player_stats_details'e (source='sofascore')
yazar. Sonunda tff1 mat'larini tazeler.

GRACE-PERIOD mantigi (mac bitinceye + duzeltmeler otursun diye):
  Bir mac ancak baslangicindan (kickoff) MIN_AGE_H .. MAX_AGE_H saat once ise islenir.
  - MIN_AGE_H  : mac biter bitmez cekme; istatistik/duzeltme otursun (varsayilan 4s).
  - MAX_AGE_H  : bu pencere boyunca her kosuda tekrar cekilir (Opta'dan yayilan
                 duzeltmeleri yakalamak icin); upsert idempotent oldugu icin guvenli
                 (varsayilan 60s ~ 2.5 gun).

Ortam degiskeni ile ezilir (test/ayar):
  SOFA_MIN_AGE_H, SOFA_MAX_AGE_H, SOFA_MAX_MATCHES (0=sinirsiz),
  SOFA_SEASON_ID (belirli sezon zorla; yoksa guncel sezon), SOFA_SLEEP (istekler arasi sn).

Calistirma:
  python src/football/fetch_sofascore_matches.py
"""
import importlib
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
PROXY = (ENV.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY}
HDR = {"Accept": "application/json"}
API = "https://api.sofascore.com/api/v1"

# test edilmis yukleyici mantigini yeniden kullan (dosyaya dokunmadan)
sys.path.insert(0, str(Path(__file__).resolve().parent))
loader = importlib.import_module("load_sofascore_1lig_player_stats")
teamload = importlib.import_module("load_sofascore_team_stats")  # takim-mac stat (GSheet + MSM feed)
shotload = importlib.import_module("load_sofascore_shotmap")  # sut kirilimlari (PSM kutu ici/disi)
scrape_hash = importlib.import_module("scrape_hash")  # H2: mac payload hash (gozlem)
mpsd_raw = importlib.import_module("mpsd_raw")  # Faz 2: ham jsonb yan tablo ayrimi

MIN_AGE_H = float(os.environ.get("SOFA_MIN_AGE_H", "4"))
MAX_AGE_H = float(os.environ.get("SOFA_MAX_AGE_H", "60"))
MAX_MATCHES = int(os.environ.get("SOFA_MAX_MATCHES", "0"))  # 0 = sinirsiz
FORCE_SEASON = (os.environ.get("SOFA_SEASON_ID") or "").strip()  # test: belirli sezon
SLEEP = float(os.environ.get("SOFA_SLEEP", "0.6"))

# Islenecek ligler. SofaScore unique-tournament id + DB competition etiketi.
# ut=52 Super Lig, ut=98 Trendyol 1. Lig (26/27 season 98149). competition
# etiketi tff1 view'larinin filtresiyle birebir olmali ('Trendyol 1. Lig').
LEAGUES = [
    {"ut": 52, "competition": "Süper Lig"},
    {"ut": 98, "competition": "Trendyol 1. Lig"},
    # Avrupa kulup kupalari (sofascore-keyed, guncel sezonu otomatik alir). match_row
    # roundInfo yakalar -> asama (on eleme/lig-fazi/braket) verisi kendiliginden gelir.
    # competition etiketleri guard + ucl/uel/uecl view'lariyla birebir.
    {"ut": 7, "competition": "UEFA Şampiyonlar Ligi"},
    {"ut": 679, "competition": "UEFA Avrupa Ligi"},
    {"ut": 17015, "competition": "UEFA Konferans Ligi"},
]


def get(url, tries=3):
    last = None
    for _ in range(tries):
        try:
            r = cr.get(url, headers=HDR, proxies=PROXIES, impersonate="chrome", timeout=40)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}: {r.text[:120]}"
        except Exception as e:  # noqa
            last = repr(e)[:120]
        time.sleep(1.5)
    raise RuntimeError(f"{url} -> {last}")


def season_label_from_name(name: str) -> str:
    """'Super Lig 24/25' -> '2024/2025'; '2024/2025' -> aynen."""
    m = re.search(r"(\d{4})/(\d{4})", name or "")
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    m = re.search(r"(\d{2})/(\d{2})", name or "")
    if m:
        return f"20{m.group(1)}/20{m.group(2)}"
    return name or ""


def now_ts() -> float:
    return datetime.now(tz=timezone.utc).timestamp()


def process_league(cfg: dict):
    ut = cfg["ut"]
    comp = cfg["competition"]
    seasons = get(f"{API}/unique-tournament/{ut}/seasons")["seasons"]
    if FORCE_SEASON:
        season = next((s for s in seasons if str(s["id"]) == FORCE_SEASON), seasons[0])
    else:
        season = seasons[0]  # guncel sezon
    season_label = season_label_from_name(season["name"])
    print(f"[{comp}] sezon={season['name']} -> {season_label} (id {season['id']})", flush=True)

    # son bitmis maclari topla (page 0 en yeni; gerekirse 1)
    events = []
    for page in (0, 1):
        try:
            evs = get(f"{API}/unique-tournament/{ut}/season/{season['id']}/events/last/{page}")["events"]
        except Exception:
            break
        events.extend(evs)
        if len(evs) < 30:
            break

    now = now_ts()
    eligible = []
    for ev in events:
        if (ev.get("status") or {}).get("type") != "finished":
            continue
        ts = ev.get("startTimestamp")
        if not ts:
            continue
        age_h = (now - ts) / 3600.0
        if MIN_AGE_H <= age_h <= MAX_AGE_H:
            eligible.append(ev)
    eligible.sort(key=lambda e: e.get("startTimestamp") or 0)
    if MAX_MATCHES:
        eligible = eligible[-MAX_MATCHES:]
    print(f"[{comp}] aday mac (grace {MIN_AGE_H}-{MAX_AGE_H}s): {len(eligible)}", flush=True)

    # yukleyici global'lerini bu lig icin ayarla
    loader.SEASON_LABEL = season_label
    loader.COMPETITION = comp

    m_rows, p_rows, t_rows, s_rows, c_rows = [], [], [], [], []
    event_hashes = []  # H2 (gozlem): [(source_match_id, payload_hash)]
    for ev in eligible:
        eid = ev["id"]
        try:
            lineup = get(f"{API}/event/{eid}/lineups")
        except Exception as e:  # noqa
            print(f"  ATLANDI event {eid}: {e}", flush=True)
            continue
        # Hakem SADECE tam event-detayinda gelir (events-list ev'inde yok) -> cek + enjekte.
        try:
            det = get(f"{API}/event/{eid}")["event"]
            if det.get("referee"):
                ev["referee"] = det["referee"]
        except Exception as e:  # noqa
            print(f"  hakem cekilemedi {eid}: {repr(e)[:80]}", flush=True)
        # H2: bu macin satirlarini once yerelde topla (payload hash icin), sonra
        # paylasimli listelere ekle (upsert davranisi birebir ayni kalir).
        m_one = loader.match_row(ev, playoff=False)
        p_ev = loader.player_rows(ev, lineup)
        t_ev, c_ev, s_ev = [], [], []
        # Takim-mac statlari (statistics + incidents -> match_team_stats, source='sofascore').
        # Eksik/404 ise sadece takim-stat atlanir, oyuncu verisi etkilenmez.
        try:
            stats = get(f"{API}/event/{eid}/statistics")
            inc = get(f"{API}/event/{eid}/incidents")
            t_ev = teamload.build_team_rows(ev, stats, inc, comp)
            # Oyuncu-bazli kart olaylari (sahada-gorulen ayrimi icin). lineup
            # yukarida cekildi; incidents'ten kart+degisiklik okunur.
            c_ev = teamload.build_card_rows(ev, inc, lineup)
        except Exception as e:  # noqa
            print(f"  takim-stat atlandi {eid}: {repr(e)[:80]}", flush=True)
        # Shotmap (kutu ici/disi sut kirilimlari). 404 = bu mac icin yok, zararsiz.
        try:
            sm = get(f"{API}/event/{eid}/shotmap")
            s_ev = shotload.build_shot_rows(eid, sm.get("shotmap", []))
        except Exception as e:  # noqa
            print(f"  shotmap atlandi {eid}: {repr(e)[:80]}", flush=True)
        m_rows.append(m_one)
        p_rows.extend(p_ev)
        t_rows.extend(t_ev)
        c_rows.extend(c_ev)
        s_rows.extend(s_ev)
        try:
            event_hashes.append((str(eid), scrape_hash.event_payload_hash(m_one, p_ev, t_ev, c_ev, s_ev)))
        except Exception as e:  # noqa
            print(f"  H2 hash hata {eid}: {repr(e)[:80]}", flush=True)
        hs = (ev.get("homeScore") or {}).get("current")
        as_ = (ev.get("awayScore") or {}).get("current")
        print(f"  + {ev['homeTeam']['name']} {hs}-{as_} {ev['awayTeam']['name']} (event {eid})", flush=True)
        time.sleep(SLEEP)

    if m_rows:
        loader.upsert("matches", m_rows, "source,source_match_id")
    if t_rows:
        teamload.upsert(t_rows)
        print(f"[{comp}] takim-stat upsert: {len(t_rows)} satir", flush=True)
    if c_rows:
        teamload.upsert_cards(c_rows)
        print(f"[{comp}] oyuncu-kart upsert: {len(c_rows)} kart", flush=True)
    if s_rows:
        shotload.upsert(s_rows)
        print(f"[{comp}] shotmap upsert: {len(s_rows)} sut", flush=True)
    # ayni oyuncu-mac anahtarini tekillestir (son kazanir)
    dedup = {}
    for r in p_rows:
        dedup[(r["source_match_id"], r["source_player_id"])] = r
    p_rows = list(dedup.values())
    if p_rows:
        # Faz 2: ham jsonb yan tabloya (bkz mpsd_raw); once sicak, sonra ham.
        hot_rows, raw_rows = mpsd_raw.split(p_rows)
        loader.upsert("match_player_stats_details", hot_rows, "source,source_match_id,source_player_id")
        loader.upsert(mpsd_raw.TABLE, raw_rows, mpsd_raw.CONFLICT)
    print(f"[{comp}] upsert: {len(m_rows)} mac, {len(p_rows)} oyuncu", flush=True)
    # H2 (FAZ 1 gozlem): degisen/degismeyen mac tespiti. Refresh davranisini
    # DEGISTIRMEZ; yalniz sayar/loglar. FAZ 2'de 'changed=0' ise refresh atlanacak.
    h2 = scrape_hash.check_and_store(loader.SOURCE, event_hashes)
    print(f"[{comp}] H2 gozlem: {len(event_hashes)} mac, degisen={h2['changed']} "
          f"(yeni={h2['new']}), degismeyen={h2['unchanged']}", flush=True)
    return len(m_rows), len(p_rows), h2["changed"]


def main():
    if not PROXY:
        raise SystemExit("Eksik PROXY_URL (.env)")
    if not (loader.SUPABASE_URL and loader.SUPABASE_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY")
    total_m = total_p = 0
    cup_m = 0  # H3: Avrupa kupasi maci sayisi (kupa mat refresh gate'i icin)
    changed_m = 0  # H2: bu turda payload'i gercekten degisen mac sayisi
    cup_changed = 0  # H2 FAZ 2: degisen KUPA maci (wrapper 3d kupa mat gate'i)
    CUP_COMPS = {"UEFA Şampiyonlar Ligi", "UEFA Avrupa Ligi", "UEFA Konferans Ligi"}
    ok_ligler = 0   # K-2: hatasiz biten lig sayisi (tam-cokus tespiti icin)
    hata_ligler = 0
    for cfg in LEAGUES:
        try:
            m, p, ch = process_league(cfg)
            total_m += m
            total_p += p
            changed_m += ch
            if cfg["competition"] in CUP_COMPS:
                cup_m += m
                cup_changed += ch
            ok_ligler += 1
        except Exception as e:  # noqa
            hata_ligler += 1
            print(f"[{cfg['competition']}] HATA: {e}", flush=True)
    # H2 FAZ 2: refresh yalniz payload'i degisen mac varsa kosar (yeni mac da
    # degisen sayilir; hash hatasi da muhafazakar olarak degisen sayilir, bkz
    # scrape_hash). Grace penceresinde ayni bitmis macin ~21 tur yeniden
    # islenmesi artik her turda mat refresh tetiklemez. SLA (sahip, 2026-08-19):
    # veri mac-sonrasi scrape bitisi +10dk icinde gorunsun; ilk isleme turu
    # changed>0 verdigi icin bu sinir korunur.
    if changed_m:
        loader.refresh_mats()
    elif total_m:
        print("H2 FAZ 2: islenen mac var ama payload degismedi, mat refresh atlandi", flush=True)
    print(f"TOPLAM: {total_m} mac, {total_p} oyuncu", flush=True)
    # H3: wrapper bu satiri grep'leyip kupa mat'larini (ucl/uel/uecl) SADECE kupa
    # maci islenen turda tazeler (gated). SofaScore'un stat vermedigi kupa maclari
    # icin FlashScore cup adimi (2b) ayrica tetikler.
    print(f"CUP_M: {cup_m}", flush=True)
    # H2 FAZ 2: wrapper gate'leri bu iki satiri okur (yoksa fail-open eski davranis).
    print(f"CHANGED_M: {changed_m}", flush=True)
    print(f"CUP_CHANGED_M: {cup_changed}", flush=True)
    # K-2 (2026-08-20): TUM ligler hata verip hicbiri islenemediyse (proxy /
    # SofaScore tam cokusu) rc!=0 don -> wrapper 'SOFA FAILED' banner'i basar,
    # anlik ntfy + gunluk digest gorur. Kismi hata (bazi ligler OK) rc=0 kalir;
    # '[lig] HATA:' satirlari digest desenine (' HATA:') girer.
    if hata_ligler and not ok_ligler:
        raise SystemExit(f"FETCH FAILED: {hata_ligler} lig hata, 0 lig islendi")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Avrupa kupalari (CL/EL/Con) FlashScore overlay fetcher.

Amac: SofaScore bazi kupa maclarinda (ozellikle on eleme) oyuncu VE/VEYA takim
istatistigi vermez (kadro var, stat yok). FlashScore verir. Bu script sadece
SofaScore'un BOS oldugu kupa maclari icin FlashScore'dan (source='flashscore')
doldurur; kupa view'lari SofaScore bossa FlashScore'a duser.

Akis:
  1) SofaScore kupa maclarindan "eksik" olanlari DB'den bul (oyuncu-bos veya
     takim-bos). Bunlari (competition, tarih, takim adi, skor) ile indeksle.
  2) FlashScore results sayfalarini kesfet (fetch_flashscore_matches.discover).
  3) Her FS macini bir SofaScore macina cozumle (tarih +/-1 gun + skor + ad
     benzerligi). Yalniz SofaScore'un EKSIK oldugu maclar islenir.
  4) Cozulen mac icin: df_st takim-stat + (varsa) epmsse/epmsd oyuncu-stat cek;
     football.matches + match_team_stats + match_player_stats_details'e
     source='flashscore' yaz. ref.flashscore_sofa_match_map'e eslesme yaz.

Idempotent. Grace penceresi (cron) veya backfill (FS_CUP_BACKFILL=1: eksik olan
tum maclar) ile calisir.

Env: FS_MIN_AGE_H(2.5)/FS_MAX_AGE_H(6) grace; FS_CUP_BACKFILL(1=tum eksikler);
     FS_TEST_MID (tek FS mid); FS_SLEEP(0.4); FS_DRY_RUN(1=yazma).
Calistirma: python src/football/fetch_flashscore_cup_matches.py
"""
import importlib
import json
import os
import re
import tempfile
import time
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path

import psycopg2
from curl_cffi import requests as cr
from dotenv import dotenv_values

fsfetch = importlib.import_module("fetch_flashscore_matches")
fsplayer = importlib.import_module("load_flashscore_player_stats")
fsteam = importlib.import_module("load_flashscore_team_stats")

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DSN = (ENV.get("DATABASE_URL") or "").strip().strip('"')

MIN_AGE_H = float(os.environ.get("FS_MIN_AGE_H", "2.5"))
MAX_AGE_H = float(os.environ.get("FS_MAX_AGE_H", "6"))
SLEEP = float(os.environ.get("FS_SLEEP", "0.4"))
BACKFILL = (os.environ.get("FS_CUP_BACKFILL") or "") not in ("", "0", "false", "False")
TEST_MID = (os.environ.get("FS_TEST_MID") or "").strip()
DRY_RUN = (os.environ.get("FS_DRY_RUN") or "") not in ("", "0", "false", "False")

GQL = "https://2.ds.lsapp.eu/pq_graphql"
SEASON = "2026/2027"

CUPS = [
    {"url": "https://www.flashscore.com/football/europe/champions-league/results/",
     "competition": "UEFA Şampiyonlar Ligi"},
    {"url": "https://www.flashscore.com/football/europe/europa-league/results/",
     "competition": "UEFA Avrupa Ligi"},
    {"url": "https://www.flashscore.com/football/europe/conference-league/results/",
     "competition": "UEFA Konferans Ligi"},
]

# Ad normalizasyonunda atilacak jenerik kulup ekleri (token bazli).
DROP_TOKENS = {
    "fc", "fk", "sk", "sc", "ac", "if", "bk", "cf", "kf", "afc", "cd", "ca",
    "us", "as", "ss", "ssc", "rc", "ns", "nk", "hnk", "gnk", "jk", "fs",
    "club", "kalcio", "calcio", "spor", "sportif", "the",
}


def norm_name(name: str) -> str:
    """Takim adini karsilastirma icin normalize et: ulke ekini/parantezi at,
    aksani kaldir, jenerik kulup token'larini at, harfe indirge."""
    s = (name or "").strip()
    s = re.sub(r"\([^)]*\)", " ", s)              # '(Fin)' at
    s = s.replace("ı", "i").replace("İ", "i").replace("ø", "o").replace("Ø", "o")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    toks = re.split(r"[^a-z0-9]+", s)
    toks = [t for t in toks if t and t not in DROP_TOKENS]
    return " ".join(toks)


def name_overlap(a: str, b: str) -> float:
    """Iki normalize ad arasi token/substring benzerligi 0..1."""
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    if inter:
        return inter / max(len(ta), len(tb))
    # token kesisimi yok: kisaltma olabilir (KuPS<->kuopion) -> substring dene
    ja, jb = "".join(a.split()), "".join(b.split())
    if ja and jb and (ja in jb or jb in ja):
        return 0.5
    # bas harf/prefix: FS kisaltmalari icin son care (dusuk guven)
    if ja[:3] and jb[:3] and ja[:3] == jb[:3]:
        return 0.3
    return 0.0


def _get(url, want_json, tries=3, headers=None):
    for _ in range(tries):
        try:
            r = cr.get(url, headers=headers or {"Accept": "*/*"},
                       impersonate="chrome", timeout=40)
            if r.status_code == 200:
                return r.json() if want_json else r.text
        except Exception:  # noqa
            pass
        time.sleep(1.2)
    return None


def load_sofascore_gaps(cur):
    """SofaScore kupa maclari + eksik bayraklari. Doner:
    matches: [{id, competition, date, hn, an, hs, as, player_empty, team_empty}]"""
    cur.execute("""
        select m.source_match_id, m.competition, m.match_datetime::date,
               m.home_team_name, m.away_team_name, m.home_score, m.away_score,
               not exists (
                 select 1 from football.match_player_stats_details d
                 where d.source='sofascore' and d.source_match_id=m.source_match_id
                   and d.raw_stats ? 'minutesPlayed'
               ) as player_empty,
               not exists (
                 select 1 from football.match_team_stats ts
                 where ts.source='sofascore' and ts.source_match_id=m.source_match_id
                   and (coalesce(ts.summary_shots,0) > 0
                        or ts.details_expected_goals is not null)
               ) as team_empty
        from football.matches m
        where m.source='sofascore'
          and m.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')
    """)
    out = []
    for r in cur.fetchall():
        out.append({
            "id": r[0], "competition": r[1], "date": r[2],
            "hn": r[3], "an": r[4], "hs": r[5], "as": r[6],
            "nhn": norm_name(r[3]), "nan": norm_name(r[4]),
            "player_empty": r[7], "team_empty": r[8],
        })
    return out


def candidates(fs_block, competition, gaps):
    """FS blogu icin KABUL EDILEBILIR tum SofaScore adaylari, guvene gore sirali.
    Doner [(gap, conf, reason), ...] (bos = eslesme yok).

    Eskiden (resolve) yalniz EN IYI aday donerdi; claim-tracking icin ikinci-en-iyi
    de gerekli: bir blogun en iyi maci baska bir blok tarafindan claim'lendiyse, o
    blok bu listedeki bir sonraki uygun maca dusebilsin.

    Kabul: (1) guclu ad benzerligi (>=0.6), VEYA (2) skor TAM eslesir + en az bir
    taraf makul eslesir (max>=0.4, toplam>=0.5). FS kisaltmalari (KuPS<->Kuopion)
    tek tarafi sifirlayabilir; skor+tarih+diger taraf yeterli ayirt edicidir."""
    ts = fs_block["ts"]
    fdate = datetime.fromtimestamp(ts, tz=timezone.utc).date()
    fhn, fan = norm_name(fs_block["h"]), norm_name(fs_block["a"])
    fhs = int(fs_block["hs"]) if (fs_block["hs"] or "").isdigit() else None
    fas = int(fs_block["as"]) if (fs_block["as"] or "").isdigit() else None
    out = []
    for g in gaps:
        if g["competition"] != competition:
            continue
        if g["date"] is None or abs((g["date"] - fdate).days) > 1:
            continue
        # ev/deplasman dogru sirada ad benzerligi (her taraf ayri)
        hov = name_overlap(fhn, g["nhn"])
        aov = name_overlap(fan, g["nan"])
        no = (hov + aov) / 2.0
        # skor eslesmesi (guclu sinyal)
        score_ok = (fhs is not None and g["hs"] is not None
                    and fhs == g["hs"] and fas == g["as"])
        # guven skoru: skor eslesirse +0.6, ayni gun +0.1, ad benzerligi agirlik
        conf = no + (0.6 if score_ok else 0.0) + (0.1 if g["date"] == fdate else 0.0)
        accept = (no >= 0.6) or (score_ok and max(hov, aov) >= 0.4 and (hov + aov) >= 0.5)
        if accept:
            out.append((g, conf, "name" if no >= 0.6 else "score+name"))
    out.sort(key=lambda x: x[1], reverse=True)
    return out


def upsert_match_map(cur, sofa_id, fs_mid, competition, confidence):
    cur.execute("""
        insert into ref.flashscore_sofa_match_map
          (sofascore_match_id, flashscore_match_id, competition, confidence, updated_at)
        values (%s,%s,%s,%s, now())
        on conflict (sofascore_match_id) do update set
          flashscore_match_id = excluded.flashscore_match_id,
          competition = excluded.competition,
          confidence = excluded.confidence,
          updated_at = now()
    """, (sofa_id, fs_mid, competition, round(float(confidence), 3)))


def write_match_row(mid, competition, home, away, ts, hs, as_):
    """football.matches (flashscore) minimal satiri (oyuncusuz maclar icin)."""
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    winner = None
    if hs is not None and as_ is not None and hs != as_:
        winner = "home" if hs > as_ else "away"
    row = {
        "source": "flashscore",
        "source_match_id": mid,
        "competition": competition,
        "season_label": SEASON,
        "match_datetime": dt.isoformat(),
        "match_date_text": dt.strftime("%d.%m.%Y %H:%M"),
        "home_team_source_id": home["id"],
        "away_team_source_id": away["id"],
        "home_team_name": home["name"],
        "away_team_name": away["name"],
        "home_score": hs,
        "away_score": as_,
        "winner_side": winner,
        "winner_team_source_id": (home["id"] if winner == "home"
                                  else away["id"] if winner == "away" else None),
    }
    if not DRY_RUN:
        fsplayer.upsert("matches", [row], "source,source_match_id")


def process_fs_match(g, fs_block, competition, cur, confidence=1.0):
    """Cozulmus bir FS macini cek + yaz. Doner (team_written, player_written)."""
    mid = fs_block["mid"]
    ts = fs_block["ts"]
    hs = int(fs_block["hs"]) if (fs_block["hs"] or "").isdigit() else None
    as_ = int(fs_block["as"]) if (fs_block["as"] or "").isdigit() else None

    # epmsse (kadro/takim id) -> varsa gercek FS takim id/adlari
    se = _get(f"{GQL}?_hash=epmsse&eventId={mid}&projectId=2", want_json=True) or {}
    se_data = (se.get("data") or {})
    ev = (se_data.get("findEventPMSById") or {})
    teams = {t.get("side"): t for t in (ev.get("teams") or [])}
    players = ev.get("players") or []
    if teams.get("HOME") and teams.get("AWAY"):
        home = {"id": str(teams["HOME"]["id"]), "name": teams["HOME"].get("name") or fs_block["h"]}
        away = {"id": str(teams["AWAY"]["id"]), "name": teams["AWAY"].get("name") or fs_block["a"]}
    else:
        home = {"id": f"{mid}_H", "name": re.sub(r"\s*\([^)]*\)$", "", fs_block["h"] or "")}
        away = {"id": f"{mid}_A", "name": re.sub(r"\s*\([^)]*\)$", "", fs_block["a"] or "")}

    team_written = player_written = 0

    # --- takim istatistigi (df_st) ---
    if g["team_empty"]:
        text = fsteam.fetch_df_st(mid)
        if text:
            parsed = fsteam.parse_match_period(text)
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            rows = fsteam.build_team_rows(
                mid, parsed, home, away, competition, SEASON,
                dt.isoformat(), dt.strftime("%d.%m.%Y %H:%M"), hs, as_)
            if not DRY_RUN:
                fsteam.upsert(rows)
            team_written = len(rows)

    # --- oyuncu istatistigi (epmsse+epmsd) ---
    if g["player_empty"] and players:
        d = _get(f"{GQL}?_hash=epmsd&eventId={mid}&providerId=7", want_json=True) or {}
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%d.%m.%Y %H:%M")
        obj = {"ix": {"mid": mid, "h": home["name"], "a": away["name"],
                      "dt": dt, "sc": [hs, as_], "hdr": ""},
               "se": se_data, "d": (d.get("data") or {})}
        tmp = Path(tempfile.mkdtemp(prefix="fscup_"))
        try:
            (tmp / f"fs_cup_m_{mid}.json").write_text(
                json.dumps(obj, ensure_ascii=False), encoding="utf-8")
            mr, pr = fsplayer.load_folder(tmp, SEASON, competition,
                                          do_refresh=False, dry_run=DRY_RUN)
            player_written = pr
        finally:
            for f in tmp.glob("*"):
                f.unlink()
            tmp.rmdir()
    else:
        # oyuncu yazilmadi ama football.matches satiri (harita + Results icin) gerekli
        write_match_row(mid, competition, home, away, ts, hs, as_)

    if not DRY_RUN:
        upsert_match_map(cur, g["id"], mid, competition, confidence)
    return team_written, player_written


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()
    gaps = load_sofascore_gaps(cur)
    gap_ids = {g["id"] for g in gaps if g["player_empty"] or g["team_empty"]}
    print(f"SofaScore kupa maci: {len(gaps)}, eksik (player/team): {len(gap_ids)}", flush=True)
    if not gaps:
        return

    now_ts = datetime.now(tz=timezone.utc).timestamp()

    # 1) Uygun tum bloklar icin ADAY ciftleri topla (blok basina 1+ olabilir).
    cand = []  # (conf, competition, block, gap, reason)
    for cup in CUPS:
        blocks = fsfetch.discover(cup["url"])
        elig = 0
        for b in blocks:
            if TEST_MID and b["mid"] != TEST_MID:
                continue
            played = (b["hs"] or "").isdigit() and (b["as"] or "").isdigit()
            if not played:
                continue
            if not (TEST_MID or BACKFILL):
                age_h = (now_ts - b["ts"]) / 3600.0
                if not (MIN_AGE_H <= age_h <= MAX_AGE_H):
                    continue
            elig += 1
            for g, conf, reason in candidates(b, cup["competition"], gaps):
                if not (g["player_empty"] or g["team_empty"]):
                    continue  # SofaScore dolu, FS gerekmez
                cand.append((conf, cup["competition"], b, g, reason))
        print(f"[{cup['competition']}] blok={len(blocks)}, uygun blok={elig}", flush=True)

    # 2) CLAIM-TRACKING: guven sirasi (buyukten kucuge); her FS blogu ve her SofaScore
    #    maci EN FAZLA BIR kez tahsis edilir. En guvenli ciftler once kilitlenir ->
    #    cakisan blok kaybederse listedeki bir sonraki uygun macina duser (mac-basina
    #    tek FS kaynagi; iki farkli mac ayni sofascore id'sine yazamaz).
    cand.sort(key=lambda x: x[0], reverse=True)
    claimed_gap, claimed_mid = set(), set()
    picks = []  # (competition, block, gap, reason, conf)
    for conf, comp, b, g, reason in cand:
        if b["mid"] in claimed_mid or g["id"] in claimed_gap:
            continue
        claimed_mid.add(b["mid"])
        claimed_gap.add(g["id"])
        picks.append((comp, b, g, reason, conf))
    print(f"aday cift={len(cand)}, tahsis edilen mac={len(picks)}", flush=True)

    # 3) Tahsis edilen maclari isle.
    total_t = total_p = total_m = 0
    for comp, b, g, reason, conf in picks:
        try:
            tw, pw = process_fs_match(g, b, comp, cur, conf)
            total_t += tw; total_p += pw; total_m += 1
            print(f"  + {b['mid']} -> sofa {g['id']} ({reason} {conf:.2f}) "
                  f"team={tw} player={pw}  {b['h']} {b['hs']}-{b['as']} {b['a']}", flush=True)
            time.sleep(SLEEP)
        except Exception as e:  # noqa
            print(f"  ATLANDI {b['mid']} (sofa {g['id']}): {repr(e)[:160]}", flush=True)
    print(f"TOPLAM: {total_m} mac, {total_t} takim-satiri, {total_p} oyuncu "
          f"(backfill={BACKFILL}, dry_run={DRY_RUN})", flush=True)


if __name__ == "__main__":
    main()

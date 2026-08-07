# -*- coding: utf-8 -*-
"""Headless FlashScore mac-sonrasi fetcher (overlay metrikleri).

SofaScore ana kaynak; FlashScore yalniz Sofa'da olmayanlari getirir
(1.Lig: xg/xgot/xa/sari-kirmizi kart/detayli pozisyon). Faz 0 spike'ta
kanitlandi: hepsi VPS'ten duz HTTP (curl_cffi), PROXY'SIZ aciliyor.

Akis:
  1) Kesif: flashscore.com .../results/ HTML'i cek; gomulu feed'i (~ / div ÷ /
     not ¬ delimited) parse et -> AA÷mid, AD÷kickoff-ts, AE/AF takim, AG/AH skor.
  2) Grace: mac ancak kickoff'tan FS_MIN_AGE_H..FS_MAX_AGE_H saat once basladiysa
     VE skoru varsa islenir (~ mac bitiminden 30 dk sonra).
  3) Per-mac: lsapp.eu pq_graphql epmsse (kadro/oyuncu) + epmsd (stats/rating).
  4) {ix,se,d} JSON'a yaz -> load_flashscore_player_stats.load_folder ile
     football.matches + match_player_stats_details'e (source='flashscore') upsert.

Idempotent (on_conflict merge); tekrar cekmek zararsiz (Sofa gibi duzeltmeleri yakalar).

Env: FS_MIN_AGE_H(2.5), FS_MAX_AGE_H(6), FS_SLEEP(0.4),
     FS_TEST_MID (tek mid'i zorla; test), FS_DRY_RUN (1=DB'ye yazma).
Calistirma: python src/football/fetch_flashscore_matches.py
"""
import importlib
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests as cr

fsload = importlib.import_module("load_flashscore_player_stats")

MIN_AGE_H = float(os.environ.get("FS_MIN_AGE_H", "2.5"))
MAX_AGE_H = float(os.environ.get("FS_MAX_AGE_H", "6"))
SLEEP = float(os.environ.get("FS_SLEEP", "0.4"))
TEST_MID = (os.environ.get("FS_TEST_MID") or "").strip()
DRY_RUN = (os.environ.get("FS_DRY_RUN") or "") not in ("", "0", "false", "False")

GQL = "https://2.ds.lsapp.eu/pq_graphql"
HDR = {"Accept": "*/*"}
DIV = "÷"   # ÷ alan ayirici
NOT = "¬"   # ¬ alan sonu

# Islenecek ligler: FlashScore results sayfasi + DB competition + season_label + dosya oneki.
LEAGUES = [
    {"key": "1lig", "url": "https://www.flashscore.com/football/turkey/1-lig/results/",
     "competition": "Trendyol 1. Lig", "season_label": "2026/2027"},
    {"key": "tsl", "url": "https://www.flashscore.com/football/turkey/super-lig/results/",
     "competition": "Süper Lig", "season_label": "2026/2027"},
]


def now_ts():
    return datetime.now(tz=timezone.utc).timestamp()


def _get(url, want_json, tries=3):
    last = None
    for _ in range(tries):
        try:
            r = cr.get(url, headers=HDR, impersonate="chrome", timeout=40)
            if r.status_code == 200:
                return r.json() if want_json else r.text
            last = f"HTTP {r.status_code}"
        except Exception as e:  # noqa
            last = repr(e)[:120]
        time.sleep(1.5)
    raise RuntimeError(f"{url} -> {last}")


def _field(blk, key):
    m = re.search(re.escape(key) + DIV + r"([^" + NOT + r"]*)", blk)
    return m.group(1) if m else None


def discover(url):
    """results sayfa HTML'inden mac bloklari -> [{mid,ts,h,a,hs,as}]."""
    html = _get(url, want_json=False)
    out = []
    for blk in html.split("~"):
        mm = re.search(r"AA" + DIV + r"([A-Za-z0-9]{8})", blk)
        if not mm:
            continue
        ad = _field(blk, "AD")
        if not ad or not ad.isdigit():
            continue
        out.append({
            "mid": mm.group(1), "ts": int(ad),
            "h": _field(blk, "AE"), "a": _field(blk, "AF"),
            "hs": _field(blk, "AG"), "as": _field(blk, "AH"),
        })
    return out


def is_eligible(m):
    age_h = (now_ts() - m["ts"]) / 3600.0
    played = (m["hs"] or "").isdigit() and (m["as"] or "").isdigit()
    return played and MIN_AGE_H <= age_h <= MAX_AGE_H


def fetch_match_obj(m):
    mid = m["mid"]
    se = _get(f"{GQL}?_hash=epmsse&eventId={mid}&projectId=2", want_json=True).get("data") or {}
    d = _get(f"{GQL}?_hash=epmsd&eventId={mid}&providerId=7", want_json=True).get("data") or {}
    dt = datetime.fromtimestamp(m["ts"], tz=timezone.utc).strftime("%d.%m.%Y %H:%M")
    ix = {"mid": mid, "h": m["h"], "a": m["a"], "dt": dt, "sc": [m["hs"], m["as"]], "hdr": ""}
    return {"ix": ix, "se": se, "d": d}


def process_league(cfg):
    matches = discover(cfg["url"])
    if TEST_MID:
        picks = [x for x in matches if x["mid"] == TEST_MID] or [
            {"mid": TEST_MID, "ts": int(now_ts()) - 3 * 3600, "h": None, "a": None, "hs": None, "as": None}]
        picks = picks[:1]
    else:
        picks = [x for x in matches if is_eligible(x)]
    print(f"[{cfg['key']}] toplam blok={len(matches)}, islenecek={len(picks)}", flush=True)
    if not picks:
        return 0, 0
    tmp = Path(tempfile.mkdtemp(prefix=f"fs_{cfg['key']}_"))
    try:
        for m in picks:
            try:
                obj = fetch_match_obj(m)
                (tmp / f"fs_{cfg['key']}_m_{m['mid']}.json").write_text(
                    json.dumps(obj, ensure_ascii=False), encoding="utf-8")
                print(f"  + {m['mid']} {m.get('h')} {m.get('hs')}-{m.get('as')} {m.get('a')}", flush=True)
                time.sleep(SLEEP)
            except Exception as e:  # noqa
                print(f"  ATLANDI {m['mid']}: {repr(e)[:120]}", flush=True)
        return fsload.load_folder(tmp, cfg["season_label"], cfg["competition"],
                                  do_refresh=False, dry_run=DRY_RUN)
    finally:
        for f in tmp.glob("*"):
            f.unlink()
        tmp.rmdir()


def main():
    total_m = total_p = 0
    wrote = False
    for cfg in LEAGUES:
        try:
            mr, pr = process_league(cfg)
            total_m += mr
            total_p += pr
            wrote = wrote or mr > 0
        except Exception as e:  # noqa
            print(f"[{cfg['key']}] HATA: {repr(e)[:160]}", flush=True)
    if wrote and not DRY_RUN:
        fsload.refresh_mats()
    print(f"TOPLAM: {total_m} mac, {total_p} oyuncu (dry_run={DRY_RUN})", flush=True)


if __name__ == "__main__":
    main()

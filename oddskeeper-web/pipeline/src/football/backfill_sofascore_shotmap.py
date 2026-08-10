# -*- coding: utf-8 -*-
"""Gecmis maclarin shotmap'ini doldurur (football.match_player_shots).

football.matches (source='sofascore') icinde olup henuz sut satiri olmayan
BITMIS maclari bulur, shotmap'i ceker, upsert eder. 404 = o mac icin shotmap
yok (or. 1.Lig 24/25 ilk haftasi), sessizce atlanir ama refetch'i onlemek
icin data/shotmap_missing.txt'ye islenir.

Varsayilan DIREKT baglanti (lokalden calisir, proxy GB'si harcamaz);
VPS'ten kosulacaksa --proxy ver (PROXY_URL .env'den).

Kullanim: python backfill_sofascore_shotmap.py [--limit N] [--sleep S] [--proxy]
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import psycopg2
from curl_cffi import requests as cr
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_sofascore_shotmap import build_shot_rows, upsert  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
API = "https://api.sofascore.com/api/v1"
MISSING_FILE = ROOT / "data" / "shotmap_missing.txt"


def main() -> None:
    limit = 0
    sleep_s = 0.7
    use_proxy = "--proxy" in sys.argv
    for i, a in enumerate(sys.argv):
        if a == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])
        if a == "--sleep" and i + 1 < len(sys.argv):
            sleep_s = float(sys.argv[i + 1])

    proxies = None
    if use_proxy:
        p = (ENV.get("PROXY_URL") or "").strip()
        if not p:
            raise SystemExit("--proxy verildi ama PROXY_URL yok (.env)")
        proxies = {"http": p, "https": p}

    missing: set[str] = set()
    if MISSING_FILE.exists():
        missing = {ln.strip() for ln in MISSING_FILE.read_text().splitlines() if ln.strip()}

    conn = psycopg2.connect(os.environ.get("DATABASE_URL") or ENV["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        select m.source_match_id
        from football.matches m
        where m.source = 'sofascore'
          and m.match_datetime < now() - interval '4 hours'
          and not exists (
            select 1 from football.match_player_shots s
            where s.source_match_id = m.source_match_id
          )
        order by m.match_datetime
        """
    )
    ids = [r[0] for r in cur.fetchall() if r[0] not in missing]
    conn.close()
    if limit:
        ids = ids[:limit]
    print(f"islenecek mac: {len(ids)} (daha once 404: {len(missing)})", flush=True)

    ok = miss = err = 0
    new_missing: list[str] = []
    for n, eid in enumerate(ids, 1):
        rows = None
        for attempt in range(3):
            try:
                r = cr.get(f"{API}/event/{eid}/shotmap", proxies=proxies,
                           impersonate="chrome", timeout=30)
                if r.status_code == 200:
                    rows = build_shot_rows(eid, r.json().get("shotmap", []))
                elif r.status_code == 404:
                    rows = []
                else:
                    raise RuntimeError(f"HTTP {r.status_code}")
                break
            except Exception as e:  # noqa
                if attempt == 2:
                    print(f"  [{n}/{len(ids)}] {eid} HATA: {repr(e)[:80]}", flush=True)
                    err += 1
                else:
                    time.sleep(4)
        if rows is None:
            time.sleep(sleep_s)
            continue
        if not rows:
            miss += 1
            new_missing.append(str(eid))
        else:
            try:
                upsert(rows)
                ok += 1
            except Exception as e:  # noqa
                print(f"  [{n}/{len(ids)}] {eid} UPSERT HATA: {repr(e)[:100]}", flush=True)
                err += 1
        if n % 50 == 0:
            print(f"  ... {n}/{len(ids)} (ok={ok} bos/404={miss} hata={err})", flush=True)
        time.sleep(sleep_s)

    if new_missing:
        MISSING_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(MISSING_FILE, "a", encoding="utf-8") as f:
            f.write("\n".join(new_missing) + "\n")
    print(f"BITTI: {ok} mac yuklendi, {miss} shotmap'siz, {err} hata", flush=True)


if __name__ == "__main__":
    main()

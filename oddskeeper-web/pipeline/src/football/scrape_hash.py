# -*- coding: utf-8 -*-
"""H2 (ARCHITECTURE_REVIEW): mac payload hash — "degisiklik yoksa refresh atla".

Her islenen macin upsert satirlarinin (match + player + team + card + shot)
deterministik hash'ini uretir, tracker.match_scrape_hash'te saklar ve bir sonraki
grace-penceresi turunda karsilastirir. Hash ayniysa DB'de veri degismemistir.

FAZ 1 (su an): yalniz GOZLEM. fetcher check_and_store'u cagirir, degisen/degismeyen
sayar ve loglar; refresh davranisini DEGISTIRMEZ. Birkac mac gunu degismeyen maclarin
'unchanged' verdigi dogrulaninca FAZ 2 (gercek atlama) acilir.

Guvenlik: hash TUM upsert payload'ini kapsar -> herhangi bir alan degisirse hash
degisir (Opta gec duzeltmeleri dahil). Hata durumunda 'degismis' kabul edilir
(muhafazakar: asla yanlislikla atlamaz).
"""
import hashlib
import json
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")


def _row_str(r: dict) -> str:
    # sort_keys + default=str: alan sirasi/serialize farki hash'i etkilemesin.
    return json.dumps(r, sort_keys=True, default=str, ensure_ascii=False)


def event_payload_hash(m_row, p_rows, t_rows, c_rows, s_rows) -> str:
    """Bir macin tum satirlarindan sira-bagimsiz deterministik hash."""
    parts = ["m:" + _row_str(m_row)]
    for tag, lst in (("p", p_rows or []), ("t", t_rows or []), ("c", c_rows or []), ("s", s_rows or [])):
        parts.extend(tag + ":" + _row_str(r) for r in lst)
    parts.sort()  # liste sirasindan bagimsiz olsun
    return hashlib.md5("\n".join(parts).encode("utf-8")).hexdigest()


def check_and_store(source: str, event_hashes: list) -> dict:
    """event_hashes: [(source_match_id, payload_hash)]. Stored hash ile karsilastirir,
    yeni hash'leri upsert eder. Doner:
      {'changed': n, 'new': n, 'unchanged': n, 'changed_ids': [...]}
    'changed' = new + gercekten-degismis (FAZ 2'de refresh gerektirecekler).
    LOG-ONLY: caller bu sonuca gore refresh'i ATLAMAZ; yalniz gozlem/log.
    Hata halinde hepsini 'changed' say (muhafazakar)."""
    if not event_hashes:
        return {"changed": 0, "new": 0, "unchanged": 0, "changed_ids": []}
    try:
        conn = psycopg2.connect((ENV.get("DATABASE_URL") or "").strip().strip('"'))
        conn.autocommit = True
        cur = conn.cursor()
        ids = [mid for mid, _ in event_hashes]
        cur.execute(
            "select source_match_id, payload_hash from tracker.match_scrape_hash "
            "where source=%s and source_match_id = any(%s)",
            (source, ids),
        )
        stored = dict(cur.fetchall())
        changed_ids, new, unchanged = [], 0, 0
        for mid, h in event_hashes:
            prev = stored.get(mid)
            if prev is None:
                new += 1
                changed_ids.append(mid)  # yeni mac -> ilk kez, refresh gerekli
            elif prev != h:
                changed_ids.append(mid)
            else:
                unchanged += 1
        psycopg2.extras.execute_values(
            cur,
            "insert into tracker.match_scrape_hash (source, source_match_id, payload_hash) "
            "values %s on conflict (source, source_match_id) do update "
            "set payload_hash=excluded.payload_hash, updated_at=now()",
            [(source, mid, h) for mid, h in event_hashes],
        )
        conn.close()
        return {"changed": len(changed_ids), "new": new, "unchanged": unchanged, "changed_ids": changed_ids}
    except Exception as exc:  # noqa
        print(f"  UYARI: scrape_hash check_and_store hata (hepsi degismis sayildi): {exc}", flush=True)
        return {"changed": len(event_hashes), "new": len(event_hashes), "unchanged": 0, "changed_ids": [m for m, _ in event_hashes]}

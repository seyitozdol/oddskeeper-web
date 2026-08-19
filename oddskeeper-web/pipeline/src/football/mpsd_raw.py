# -*- coding: utf-8 -*-
"""mpsd raw_stats yan tablo yardimcisi (Faz 2, 2026-08-19).

Ham jsonb artik football.match_player_stats_details'te DEGIL, yan tabloda
(football.match_player_stats_raw) tutulur; sicak tablo boylece ~%40 kuculur.
Okuyucu view'lar football.mpsd_with_raw compat view'i uzerinden join'ler.

Kullanim (loader'larda, upsert'ten hemen once):

    hot_rows, raw_rows = mpsd_raw.split(p_rows)
    upsert("match_player_stats_details", hot_rows, "source,source_match_id,source_player_id")
    upsert(mpsd_raw.TABLE, raw_rows, mpsd_raw.CONFLICT)

Sira onemli: once sicak satir (kimlik olussun), sonra ham. Ham yazim hata
verirse loader patlar (sessiz kayip yok) - ntfy alarmina duser ve grace
penceresi ayni maci sonraki turda yeniden isler.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

TABLE = "match_player_stats_raw"
CONFLICT = "source,source_match_id,source_player_id"
KEYS = ("source", "source_match_id", "source_player_id")


def split(rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """mpsd satirlarini (sicak, ham) olarak ayirir. Girdi satirlari MUTASYONA
    ugramaz; sicak satirlardan raw_stats kolonu cikarilir.

    updated_at ACIKCA gonderilir: PostgREST upsert'i ON CONFLICT DO UPDATE ile
    YALNIZ gonderilen kolonlari set eder, tablo default'u (now()) sadece INSERT'te
    isler. Gonderilmezse guncellenen satirlarda updated_at bayat kalir ve
    "yan tablo taze mi?" kontrolu yaniltir (2026-08-19'da olculdu)."""
    now = datetime.now(timezone.utc).isoformat()
    hot: List[Dict[str, Any]] = []
    raw: List[Dict[str, Any]] = []
    for r in rows:
        rs = r.get("raw_stats")
        hot.append({k: v for k, v in r.items() if k != "raw_stats"})
        if rs is not None:
            raw.append({**{k: r[k] for k in KEYS}, "raw_stats": rs, "updated_at": now})
    return hot, raw

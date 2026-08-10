# -*- coding: utf-8 -*-
"""SofaScore shotmap -> football.match_player_shots satirlari.

Sut basina: oyuncu, sonuc (goal/save/miss/post/block), koordinat, xg/xgot.
Siniflandirma (uc kaynakla dogrulandi - FlashScore SHOTS_BOX_IN/OUT + WhoScored
Opta olaylari 9/9 birebir):
  kutu ici  = playerCoordinates.x * 1.05m <= 16.5m  VE  20.35 <= y <= 79.65
              (x = kale cizgisine uzaklik, % saha boyu; saha 105x68m,
               ceza sahasi 16.5m derin x 40.32m genis)
  isabetli  = shotType in (goal, save)   (blok ve direk isabetli DEGIL;
              SofaScore blogu zaten ayri 'block' tipiyle verir)

fetch_sofascore_matches per-mac dongusunden ve backfill scriptinden kullanilir.
"""
from __future__ import annotations

import json
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
SUPABASE_URL = (ENV.get("SUPABASE_URL") or "").strip().strip('"')
SUPABASE_KEY = (ENV.get("SUPABASE_SECRET_KEY") or "").strip().strip('"')

FIELD_LEN_M = 105.0
BOX_DEPTH_M = 16.5
BOX_Y_MIN, BOX_Y_MAX = 20.35, 79.65

ON_TARGET_TYPES = {"goal", "save"}


def build_shot_rows(event_id, shotmap: list[dict]) -> list[dict]:
    """Bir macin shotmap listesini tablo satirlarina cevirir."""
    rows: list[dict] = []
    for s in shotmap or []:
        sid = s.get("id")
        player = s.get("player") or {}
        pid = player.get("id")
        if not sid or not pid:
            continue
        c = s.get("playerCoordinates") or {}
        x, y = c.get("x"), c.get("y")
        in_box = (
            x is not None and y is not None
            and x * FIELD_LEN_M / 100.0 <= BOX_DEPTH_M
            and BOX_Y_MIN <= y <= BOX_Y_MAX
        )
        stype = (s.get("shotType") or "").strip()
        rows.append({
            "source": "sofascore",
            "source_match_id": str(event_id),
            "shot_id": int(sid),
            "source_player_id": str(pid),
            "player_name": player.get("name"),
            "is_home": s.get("isHome"),
            "time_min": s.get("time"),
            "shot_type": stype,
            "situation": s.get("situation"),
            "body_part": s.get("bodyPart"),
            "x": x,
            "y": y,
            "xg": s.get("xg"),
            "xgot": s.get("xgot"),
            "is_in_box": in_box,
            "is_on_target": stype in ON_TARGET_TYPES,
        })
    return rows


def upsert(rows: list[dict]) -> None:
    """PostgREST upsert (football.match_player_shots)."""
    if not rows:
        return
    url = (f"{SUPABASE_URL}/rest/v1/match_player_shots"
           "?on_conflict=source,source_match_id,shot_id")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Profile": "football",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        r = requests.post(url, headers=headers, data=json.dumps(chunk), timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f"shotmap upsert HTTP {r.status_code}: {r.text[:300]}")

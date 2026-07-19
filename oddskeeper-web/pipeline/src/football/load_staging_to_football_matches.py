from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

# ============================================================
# AYARLAR
# ============================================================
PROJECT_ROOT = Path(r"C:\Users\zygom\PycharmProjects\oddskeeper")
ENV_PATH = PROJECT_ROOT / ".env"

SUPABASE_URL = "SUPABASE_URL"
SUPABASE_KEY_CANDIDATES = [
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_KEY",
]

STAGING_SCHEMA = "raw"
STAGING_TABLE = "match_json_staging"
TARGET_SCHEMA = "football"
TARGET_TABLE = "matches"
SOURCE_FILTER = "opta"
REQUEST_TIMEOUT = 60

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


# ============================================================
# YARDIMCI FONKSİYONLAR
# ============================================================
def load_environment() -> Tuple[str, str]:
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH)
        logging.info(f".env bulundu: {ENV_PATH}")
    else:
        load_dotenv()
        logging.warning(".env dosyası proje kökünde bulunamadı. Sistem env deneniyor.")

    url = os.getenv(SUPABASE_URL)
    key = None
    for env_name in SUPABASE_KEY_CANDIDATES:
        value = os.getenv(env_name)
        if value:
            key = value
            logging.info(f"Supabase key env bulundu: {env_name}")
            break

    if not url:
        raise RuntimeError("SUPABASE_URL bulunamadı.")
    if not key:
        raise RuntimeError(
            "Supabase key bulunamadı. SUPABASE_SECRET_KEY / "
            "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY kontrol et."
        )

    return url.rstrip("/"), key


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def to_int_or_none(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        if isinstance(value, bool):
            return int(value)
        return int(float(value))
    except Exception:
        return None


def epoch_ms_to_iso(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    try:
        ms = int(str(value))
        dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        return dt.isoformat()
    except Exception:
        return None


# ============================================================
# VERİ MODELLERİ
# ============================================================
@dataclass
class MatchRow:
    source: str
    source_match_id: str
    competition: Optional[str]
    match_datetime: Optional[str]
    match_date_text: Optional[str]
    raw_match_date_ms: Optional[int]
    page_title: Optional[str]
    match_url: Optional[str]
    home_team_source_id: str
    away_team_source_id: str
    home_team_name: str
    away_team_name: str
    home_score: Optional[int]
    away_score: Optional[int]
    winner_team_source_id: Optional[str]
    winner_side: Optional[str]
    venue: Optional[str]
    attendance: Optional[int]
    attendance_text: Optional[str]
    referee: Optional[str]
    payload_last_seen_at: str
    updated_at: str

    def to_insert_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "source_match_id": self.source_match_id,
            "competition": self.competition,
            "match_datetime": self.match_datetime,
            "match_date_text": self.match_date_text,
            "raw_match_date_ms": self.raw_match_date_ms,
            "page_title": self.page_title,
            "match_url": self.match_url,
            "home_team_source_id": self.home_team_source_id,
            "away_team_source_id": self.away_team_source_id,
            "home_team_name": self.home_team_name,
            "away_team_name": self.away_team_name,
            "home_score": self.home_score,
            "away_score": self.away_score,
            "winner_team_source_id": self.winner_team_source_id,
            "winner_side": self.winner_side,
            "venue": self.venue,
            "attendance": self.attendance,
            "attendance_text": self.attendance_text,
            "referee": self.referee,
            "payload_last_seen_at": self.payload_last_seen_at,
            "updated_at": self.updated_at,
        }


# ============================================================
# SUPABASE REST CLIENT
# ============================================================
class SupabaseRestClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def _table_url(self, schema: str, table: str) -> str:
        return f"{self.base_url}/rest/v1/{table}"

    def _headers(self, schema: str, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Accept-Profile": schema,
            "Content-Profile": schema,
        }
        if extra:
            headers.update(extra)
        return headers

    def _raise_for_status(self, response: requests.Response, context: str) -> None:
        if response.ok:
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        raise RuntimeError(
            f"{context} başarısız | HTTP {response.status_code} | cevap: {detail}"
        )

    def fetch_staging_rows(self, source_value: str) -> List[Dict[str, Any]]:
        url = self._table_url(STAGING_SCHEMA, STAGING_TABLE)
        params = {
            "select": "source,source_match_id,payload",
            "source": f"eq.{source_value}",
            "order": "source_match_id.asc",
        }
        response = self.session.get(
            url,
            params=params,
            headers=self._headers(STAGING_SCHEMA),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "STAGING FETCH")
        rows = response.json()
        return rows if isinstance(rows, list) else []

    def target_exists(self, source_value: str, source_match_id: str) -> bool:
        url = self._table_url(TARGET_SCHEMA, TARGET_TABLE)
        params = {
            "select": "id",
            "source": f"eq.{source_value}",
            "source_match_id": f"eq.{source_match_id}",
            "limit": 1,
        }
        response = self.session.get(
            url,
            params=params,
            headers=self._headers(TARGET_SCHEMA),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "TARGET EXISTS CHECK")
        data = response.json()
        return isinstance(data, list) and len(data) > 0

    def insert_target_row(self, row: Dict[str, Any]) -> None:
        url = self._table_url(TARGET_SCHEMA, TARGET_TABLE)
        response = self.session.post(
            url,
            data=json.dumps(row, ensure_ascii=False),
            headers=self._headers(TARGET_SCHEMA, {"Prefer": "return=minimal"}),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "TARGET INSERT")

    def update_target_row(self, source_value: str, source_match_id: str, row: Dict[str, Any]) -> None:
        url = self._table_url(TARGET_SCHEMA, TARGET_TABLE)
        params = {
            "source": f"eq.{source_value}",
            "source_match_id": f"eq.{source_match_id}",
        }
        response = self.session.patch(
            url,
            params=params,
            data=json.dumps(row, ensure_ascii=False),
            headers=self._headers(TARGET_SCHEMA, {"Prefer": "return=minimal"}),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "TARGET UPDATE")


# ============================================================
# PAYLOAD PARSE
# ============================================================
def pick_match_info(payload: Dict[str, Any]) -> Dict[str, Any]:
    candidates = [
        payload.get("match_summary", {}).get("match_info", {}),
        payload.get("opta_points_stats", {}).get("match_info", {}),
        payload.get("match_details", {}).get("match_info", {}),
    ]

    for item in candidates:
        if isinstance(item, dict) and item.get("source_match_id"):
            return item

    return {}


def build_match_row(staging_row: Dict[str, Any]) -> MatchRow:
    payload = staging_row.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    if not isinstance(payload, dict):
        raise ValueError("payload dict değil")

    match_info = pick_match_info(payload)
    if not match_info:
        raise ValueError("payload içinde match_info bulunamadı")

    source = clean_text(match_info.get("source")) or clean_text(staging_row.get("source"))
    source_match_id = clean_text(match_info.get("source_match_id")) or clean_text(staging_row.get("source_match_id"))

    home_team = match_info.get("home_team") or {}
    away_team = match_info.get("away_team") or {}

    home_team_name = clean_text(home_team.get("name"))
    away_team_name = clean_text(away_team.get("name"))
    home_team_source_id = clean_text(home_team.get("source_team_id"))
    away_team_source_id = clean_text(away_team.get("source_team_id"))

    missing_required = [
        ("source", source),
        ("source_match_id", source_match_id),
        ("home_team_name", home_team_name),
        ("away_team_name", away_team_name),
        ("home_team_source_id", home_team_source_id),
        ("away_team_source_id", away_team_source_id),
    ]

    missing_names = [name for name, value in missing_required if not value]
    if missing_names:
        raise ValueError(f"zorunlu alan eksik: {', '.join(missing_names)}")

    now_iso = now_utc_iso()

    return MatchRow(
        source=source,
        source_match_id=source_match_id,
        competition=clean_text(match_info.get("competition")),
        match_datetime=epoch_ms_to_iso(match_info.get("raw_match_date_ms")),
        match_date_text=clean_text(match_info.get("match_date_text")),
        raw_match_date_ms=to_int_or_none(match_info.get("raw_match_date_ms")),
        page_title=clean_text(match_info.get("page_title")),
        match_url=clean_text(match_info.get("match_url")),
        home_team_source_id=home_team_source_id,
        away_team_source_id=away_team_source_id,
        home_team_name=home_team_name,
        away_team_name=away_team_name,
        home_score=to_int_or_none(home_team.get("score")),
        away_score=to_int_or_none(away_team.get("score")),
        winner_team_source_id=clean_text(match_info.get("winner_team_source_id")),
        winner_side=clean_text(match_info.get("winner_side")),
        venue=clean_text(match_info.get("venue")),
        attendance=to_int_or_none(match_info.get("attendance")),
        attendance_text=clean_text(match_info.get("attendance_text")),
        referee=clean_text(match_info.get("referee")),
        payload_last_seen_at=now_iso,
        updated_at=now_iso,
    )


# ============================================================
# ANA AKIŞ
# ============================================================
def run_loader() -> None:
    logging.info("Staging -> football.matches load başladı...")

    base_url, api_key = load_environment()
    client = SupabaseRestClient(base_url, api_key)

    staging_rows = client.fetch_staging_rows(SOURCE_FILTER)
    total = len(staging_rows)
    logging.info(f"Fetch edildi: {total} staging satırı")

    inserted = 0
    updated = 0
    skipped = 0
    failed = 0

    for index, staging_row in enumerate(staging_rows, start=1):
        source_match_id = staging_row.get("source_match_id")
        logging.info(f"{index}/{total} işleniyor | match_id={source_match_id}")

        try:
            match_row = build_match_row(staging_row)
            row_dict = match_row.to_insert_dict()

            exists = client.target_exists(match_row.source, match_row.source_match_id)
            if exists:
                client.update_target_row(match_row.source, match_row.source_match_id, row_dict)
                updated += 1
                logging.info(f"UPDATE OK | match_id={match_row.source_match_id}")
            else:
                client.insert_target_row(row_dict)
                inserted += 1
                logging.info(f"INSERT OK | match_id={match_row.source_match_id}")

        except ValueError as e:
            skipped += 1
            logging.warning(f"SKIP | match_id={source_match_id} | neden={e}")
        except Exception as e:
            failed += 1
            logging.exception(f"FAIL | match_id={source_match_id} | hata={e}")

    logging.info("=" * 60)
    logging.info("LOAD ÖZETİ")
    logging.info(f"Toplam   : {total}")
    logging.info(f"Inserted : {inserted}")
    logging.info(f"Updated  : {updated}")
    logging.info(f"Skipped  : {skipped}")
    logging.info(f"Failed   : {failed}")
    logging.info("=" * 60)

    if failed > 0:
        logging.warning("Bazı kayıtlar yazılamadı. Logları kontrol et.")
    else:
        logging.info("Staging -> football.matches load tamamlandı.")


if __name__ == "__main__":
    run_loader()

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv


SUPABASE_URL_ENV_CANDIDATES = ["SUPABASE_URL", "SUPABASE_PROJECT_URL"]
SUPABASE_KEY_ENV_CANDIDATES = [
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_KEY",
]

SOURCE_FILTER = "opta"
RAW_SCHEMA = "raw"
RAW_TABLE = "match_json_staging"
TARGET_SCHEMA = "football"
TARGET_TABLE = "match_incidents"
REQUEST_TIMEOUT = 60


@dataclass
class IncidentRow:
    source: str
    source_match_id: str
    incident_key: str
    source_incident_id: Optional[str]
    side: str
    event_type_code: Optional[str]
    event_title: Optional[str]
    minute_text: Optional[str]
    minute_sort: Optional[int]
    player_texts: List[str]
    primary_player_text: Optional[str]
    secondary_player_text: Optional[str]
    raw_text: Optional[str]


class SupabaseRestClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _table_url(self, schema: str, table: str) -> str:
        return f"{self.base_url}/rest/v1/{table}"

    def _headers_with_schema(self, schema: str, return_representation: bool = False) -> Dict[str, str]:
        headers = {
            "Accept-Profile": schema,
            "Content-Profile": schema,
        }
        if return_representation:
            headers["Prefer"] = "return=representation"
        return headers

    @staticmethod
    def _raise_for_status(response: requests.Response, context: str) -> None:
        if response.ok:
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        raise RuntimeError(
            f"{context} başarısız | HTTP {response.status_code} | cevap: {detail}"
        )

    def fetch_staging_rows(self, source: str) -> List[Dict[str, Any]]:
        url = self._table_url(RAW_SCHEMA, RAW_TABLE)
        params = {
            "select": "source,source_match_id,payload",
            "source": f"eq.{source}",
            "order": "source_match_id.asc",
            "limit": "10000",
        }
        response = self.session.get(
            url,
            params=params,
            headers=self._headers_with_schema(RAW_SCHEMA),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "FETCH STAGING")
        data = response.json()
        return data if isinstance(data, list) else []

    def target_exists(self, source: str, source_match_id: str, incident_key: str) -> bool:
        url = self._table_url(TARGET_SCHEMA, TARGET_TABLE)
        params = {
            "select": "id",
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
            "incident_key": f"eq.{incident_key}",
            "limit": "1",
        }
        response = self.session.get(
            url,
            params=params,
            headers=self._headers_with_schema(TARGET_SCHEMA),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "TARGET EXISTS CHECK")
        data = response.json()
        return isinstance(data, list) and len(data) > 0

    def insert_row(self, row: Dict[str, Any]) -> None:
        url = self._table_url(TARGET_SCHEMA, TARGET_TABLE)
        response = self.session.post(
            url,
            headers=self._headers_with_schema(TARGET_SCHEMA, return_representation=False),
            data=json.dumps(row, ensure_ascii=False),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "INSERT")

    def update_row(self, row: Dict[str, Any], source: str, source_match_id: str, incident_key: str) -> None:
        url = self._table_url(TARGET_SCHEMA, TARGET_TABLE)
        params = {
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
            "incident_key": f"eq.{incident_key}",
        }
        response = self.session.patch(
            url,
            params=params,
            headers=self._headers_with_schema(TARGET_SCHEMA, return_representation=False),
            data=json.dumps(row, ensure_ascii=False),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "UPDATE")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def load_environment() -> None:
    load_dotenv()
    logging.info(".env yüklendi veya mevcut environment kullanılacak.")


def first_env(candidates: List[str]) -> Optional[str]:
    for key in candidates:
        value = os.getenv(key)
        if value:
            return value
    return None


def build_client() -> SupabaseRestClient:
    base_url = first_env(SUPABASE_URL_ENV_CANDIDATES)
    api_key = first_env(SUPABASE_KEY_ENV_CANDIDATES)

    if not base_url:
        raise RuntimeError("Supabase URL environment bulunamadı.")
    if not api_key:
        raise RuntimeError("Supabase API key environment bulunamadı.")

    found_key_name = next((k for k in SUPABASE_KEY_ENV_CANDIDATES if os.getenv(k)), "UNKNOWN")
    logging.info(f"Supabase key env bulundu: {found_key_name}")
    return SupabaseRestClient(base_url, api_key)


def parse_minute_sort(minute_text: Optional[str]) -> Optional[int]:
    if not minute_text:
        return None

    text = minute_text.strip().replace("’", "'")
    match = re.match(r"^(\d+)(?:\+(\d+))?'", text)
    if not match:
        return None

    base_min = int(match.group(1))
    extra = int(match.group(2)) if match.group(2) else 0
    return base_min + extra


def fallback_incident_key(incident: Dict[str, Any], side: str) -> str:
    source_incident_id = incident.get("source_incident_id")
    if source_incident_id:
        return f"{side}-src-{source_incident_id}"

    event_type_code = str(incident.get("event_type_code") or "na").strip().lower()
    minute_text = str(incident.get("minute_text") or "na").strip().lower()
    player_texts = incident.get("player_texts") or []
    joined_players = "-".join(str(x).strip().lower().replace(" ", "-") for x in player_texts[:2]) or "na"
    return f"{side}-{event_type_code}-{minute_text}-{joined_players}"


def normalize_incident(source: str, source_match_id: str, side: str, incident: Dict[str, Any]) -> IncidentRow:
    player_texts = incident.get("player_texts") or []
    if not isinstance(player_texts, list):
        player_texts = [str(player_texts)]

    player_texts = [str(x).strip() for x in player_texts if str(x).strip()]

    incident_key = str(incident.get("incident_key") or "").strip()
    if not incident_key:
        incident_key = fallback_incident_key(incident, side)

    minute_text = incident.get("minute_text")
    if minute_text is not None:
        minute_text = str(minute_text).strip() or None

    return IncidentRow(
        source=source,
        source_match_id=source_match_id,
        incident_key=incident_key,
        source_incident_id=(str(incident.get("source_incident_id")).strip() if incident.get("source_incident_id") else None),
        side=side,
        event_type_code=(str(incident.get("event_type_code")).strip() if incident.get("event_type_code") is not None else None),
        event_title=(str(incident.get("event_title")).strip() if incident.get("event_title") is not None else None),
        minute_text=minute_text,
        minute_sort=parse_minute_sort(minute_text),
        player_texts=player_texts,
        primary_player_text=player_texts[0] if len(player_texts) >= 1 else None,
        secondary_player_text=player_texts[1] if len(player_texts) >= 2 else None,
        raw_text=(str(incident.get("raw_text")).strip() if incident.get("raw_text") is not None else None),
    )


def extract_incident_rows(staging_row: Dict[str, Any]) -> List[IncidentRow]:
    payload = staging_row.get("payload") or {}
    source_match_id = str(staging_row.get("source_match_id") or "").strip()
    source = str(staging_row.get("source") or "").strip() or "opta"

    match_summary = payload.get("match_summary") or {}
    incidents = match_summary.get("incidents") or {}

    home_list = incidents.get("home") or []
    away_list = incidents.get("away") or []

    results: List[IncidentRow] = []

    for item in home_list:
        if isinstance(item, dict):
            results.append(normalize_incident(source, source_match_id, "home", item))

    for item in away_list:
        if isinstance(item, dict):
            results.append(normalize_incident(source, source_match_id, "away", item))

    return results


def row_to_payload(row: IncidentRow) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "source": row.source,
        "source_match_id": row.source_match_id,
        "incident_key": row.incident_key,
        "source_incident_id": row.source_incident_id,
        "side": row.side,
        "event_type_code": row.event_type_code,
        "event_title": row.event_title,
        "minute_text": row.minute_text,
        "minute_sort": row.minute_sort,
        "player_texts": row.player_texts,
        "primary_player_text": row.primary_player_text,
        "secondary_player_text": row.secondary_player_text,
        "raw_text": row.raw_text,
        "payload_last_seen_at": now_iso,
        "updated_at": now_iso,
    }


def run_loader() -> None:
    configure_logging()
    logging.info("Staging -> football.match_incidents load başladı...")

    load_environment()
    client = build_client()

    staging_rows = client.fetch_staging_rows(SOURCE_FILTER)
    logging.info(f"Fetch edildi: {len(staging_rows)} staging satırı")

    all_incident_rows: List[IncidentRow] = []
    for staging_row in staging_rows:
        all_incident_rows.extend(extract_incident_rows(staging_row))

    logging.info(f"İşlenecek incident sayısı: {len(all_incident_rows)}")

    inserted = 0
    updated = 0
    skipped = 0
    failed = 0

    for idx, incident_row in enumerate(all_incident_rows, start=1):
        logging.info(
            f"{idx}/{len(all_incident_rows)} işleniyor | "
            f"match_id={incident_row.source_match_id} | "
            f"incident_key={incident_row.incident_key}"
        )

        try:
            if not incident_row.source_match_id or not incident_row.incident_key or not incident_row.side:
                skipped += 1
                logging.warning(
                    f"SKIP | match_id={incident_row.source_match_id} | "
                    f"incident_key={incident_row.incident_key} | zorunlu alan eksik"
                )
                continue

            payload = row_to_payload(incident_row)
            exists = client.target_exists(
                incident_row.source,
                incident_row.source_match_id,
                incident_row.incident_key,
            )

            if exists:
                client.update_row(
                    payload,
                    incident_row.source,
                    incident_row.source_match_id,
                    incident_row.incident_key,
                )
                updated += 1
                logging.info(
                    f"UPDATE OK | match_id={incident_row.source_match_id} | incident_key={incident_row.incident_key}"
                )
            else:
                client.insert_row(payload)
                inserted += 1
                logging.info(
                    f"INSERT OK | match_id={incident_row.source_match_id} | incident_key={incident_row.incident_key}"
                )

        except Exception as exc:
            failed += 1
            logging.exception(
                f"FAIL | match_id={incident_row.source_match_id} | "
                f"incident_key={incident_row.incident_key} | hata={exc}"
            )

    logging.info("=" * 60)
    logging.info("LOAD ÖZETİ")
    logging.info(f"Toplam   : {len(all_incident_rows)}")
    logging.info(f"Inserted : {inserted}")
    logging.info(f"Updated  : {updated}")
    logging.info(f"Skipped  : {skipped}")
    logging.info(f"Failed   : {failed}")
    logging.info("=" * 60)

    if failed > 0:
        logging.warning("Bazı kayıtlar yazılamadı. Logları kontrol et.")


if __name__ == "__main__":
    run_loader()

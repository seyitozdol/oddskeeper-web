from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import find_dotenv, load_dotenv

# ============================================================
# AYARLAR
# ============================================================
INPUT_JSON_PATH = r"C:\Users\zygom\PycharmProjects\oddskeeper\data\raw\opta_unified_matches\all_matches.json"

SUPABASE_SCHEMA = "raw"
SUPABASE_TABLE = "match_json_staging"
SOURCE_NAME = "opta"
REQUEST_TIMEOUT = 30
DRY_RUN = False
CONTINUE_ON_ERROR = True

# TABLODA status kolonu YOKSA False kalsın.
USE_STATUS_COLUMN = False
STAGING_STATUS = "pending"

# ============================================================
# LOGGING
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


# ============================================================
# ENV / PATH
# ============================================================
def load_environment() -> Tuple[str, str]:
    env_path = find_dotenv(usecwd=True)
    if env_path:
        load_dotenv(env_path)
        logging.info(f".env bulundu: {env_path}")
    else:
        logging.warning(".env dosyası bulunamadı. Ortam değişkenleri sistemden okunacak.")

    supabase_url = (os.getenv("SUPABASE_URL") or "").strip()
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()

    if not supabase_url:
        raise RuntimeError("SUPABASE_URL bulunamadı.")

    if not supabase_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / SUPABASE_KEY / SUPABASE_ANON_KEY bulunamadı."
        )

    return supabase_url.rstrip("/"), supabase_key


# ============================================================
# JSON OKUMA
# ============================================================
def load_matches(json_path: str) -> List[Dict[str, Any]]:
    path = Path(json_path)
    if not path.exists():
        raise FileNotFoundError(f"JSON dosyası bulunamadı: {path}")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("all_matches.json içeriği liste formatında olmalı.")

    logging.info(f"JSON bulundu: {path}")
    logging.info(f"Yüklenecek maç sayısı: {len(data)}")
    return data


# ============================================================
# MATCH ID / ROW BUILD
# ============================================================
def extract_source_match_id(match_payload: Dict[str, Any]) -> Optional[str]:
    normalized = match_payload.get("normalized_urls", {}) or {}
    match_summary = match_payload.get("match_summary", {}) or {}
    match_info = match_summary.get("match_info", {}) or {}

    source_match_id = normalized.get("source_match_id") or match_info.get("source_match_id")
    if source_match_id is None:
        return None

    source_match_id = str(source_match_id).strip()
    return source_match_id or None


def build_staging_row(match_payload: Dict[str, Any]) -> Dict[str, Any]:
    source_match_id = extract_source_match_id(match_payload)
    if not source_match_id:
        raise ValueError("source_match_id bulunamadı.")

    row = {
        "source": SOURCE_NAME,
        "source_match_id": source_match_id,
        "payload": match_payload,
    }

    if USE_STATUS_COLUMN:
        row["status"] = STAGING_STATUS

    return row


# ============================================================
# SUPABASE REST CLIENT
# ============================================================
class SupabaseRestClient:
    def __init__(self, base_url: str, api_key: str, schema: str, table: str) -> None:
        self.base_url = base_url
        self.api_key = api_key
        self.schema = schema
        self.table = table
        self.endpoint = f"{self.base_url}/rest/v1/{self.table}"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": self.api_key,
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Profile": self.schema,
                "Content-Profile": self.schema,
            }
        )

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

    def row_exists(self, source: str, source_match_id: str) -> bool:
        params = {
            "select": "source_match_id",
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
            "limit": "1",
        }
        response = self.session.get(self.endpoint, params=params, timeout=REQUEST_TIMEOUT)
        self._raise_for_status(response, "Kayıt kontrolü")

        data = response.json()
        return isinstance(data, list) and len(data) > 0

    def insert_row(self, row: Dict[str, Any]) -> None:
        response = self.session.post(
            self.endpoint,
            json=[row],
            headers={"Prefer": "return=minimal"},
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "INSERT")

    def update_row(self, row: Dict[str, Any]) -> None:
        source = row["source"]
        source_match_id = row["source_match_id"]

        update_body = {
            "payload": row["payload"],
        }
        if USE_STATUS_COLUMN:
            update_body["status"] = row["status"]

        params = {
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
        }
        response = self.session.patch(
            self.endpoint,
            params=params,
            json=update_body,
            headers={"Prefer": "return=minimal"},
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "UPDATE")


# ============================================================
# BULK WRITE
# ============================================================
def write_matches_to_staging(matches: List[Dict[str, Any]], client: SupabaseRestClient) -> Dict[str, int]:
    summary = {
        "total": len(matches),
        "inserted": 0,
        "updated": 0,
        "failed": 0,
        "skipped": 0,
    }

    for index, match_payload in enumerate(matches, start=1):
        try:
            row = build_staging_row(match_payload)
            source_match_id = row["source_match_id"]
            logging.info(f"{index}/{len(matches)} işleniyor | match_id={source_match_id}")

            if DRY_RUN:
                logging.info(f"DRY RUN | Yazılmayacak | match_id={source_match_id}")
                summary["skipped"] += 1
                continue

            exists = client.row_exists(row["source"], source_match_id)
            if exists:
                client.update_row(row)
                summary["updated"] += 1
                logging.info(f"UPDATE OK | match_id={source_match_id}")
            else:
                client.insert_row(row)
                summary["inserted"] += 1
                logging.info(f"INSERT OK | match_id={source_match_id}")

        except Exception as e:
            summary["failed"] += 1
            logging.exception(f"Satır yazılamadı | index={index} | hata={e}")
            if not CONTINUE_ON_ERROR:
                raise

    return summary


# ============================================================
# MAIN
# ============================================================
def main() -> None:
    logging.info("Bulk staging write başladı...")

    supabase_url, supabase_key = load_environment()
    matches = load_matches(INPUT_JSON_PATH)

    client = SupabaseRestClient(
        base_url=supabase_url,
        api_key=supabase_key,
        schema=SUPABASE_SCHEMA,
        table=SUPABASE_TABLE,
    )

    summary = write_matches_to_staging(matches, client)

    logging.info("=" * 60)
    logging.info("BULK WRITE ÖZETİ")
    logging.info(f"Toplam   : {summary['total']}")
    logging.info(f"Inserted : {summary['inserted']}")
    logging.info(f"Updated  : {summary['updated']}")
    logging.info(f"Skipped  : {summary['skipped']}")
    logging.info(f"Failed   : {summary['failed']}")
    logging.info("=" * 60)

    if summary["failed"] > 0:
        logging.warning("Bazı satırlar yazılamadı. Logları kontrol et.")
    else:
        logging.info("Tüm bulk write akışı tamamlandı.")


if __name__ == "__main__":
    main()

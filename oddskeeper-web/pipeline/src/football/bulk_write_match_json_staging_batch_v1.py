from __future__ import annotations

import argparse
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)


@dataclass
class WriteStats:
    total: int = 0
    inserted: int = 0
    updated: int = 0
    failed: int = 0


class SupabaseRawClient:
    def __init__(self, base_url: str, api_key: str, schema: str = "raw") -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.schema = schema
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": self.api_key,
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=representation",
            }
        )

    def _url(self, table: str) -> str:
        return f"{self.base_url}/rest/v1/{table}"

    def _headers(self) -> dict[str, str]:
        return {
            **self.session.headers,
            "Accept-Profile": self.schema,
            "Content-Profile": self.schema,
        }

    def _raise_for_status(self, response: requests.Response, context: str) -> None:
        if response.ok:
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        raise RuntimeError(f"{context} başarısız | HTTP {response.status_code} | cevap: {detail}")

    def exists(self, source: str, source_match_id: str) -> bool:
        params = {
            "select": "source_match_id",
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
            "limit": "1",
        }
        response = self.session.get(self._url("match_json_staging"), headers=self._headers(), params=params, timeout=60)
        self._raise_for_status(response, "EXISTS CHECK")
        data = response.json()
        return bool(data)

    def insert_row(self, row: dict[str, Any]) -> None:
        response = self.session.post(self._url("match_json_staging"), headers=self._headers(), json=row, timeout=120)
        self._raise_for_status(response, "INSERT")

    def update_row(self, source: str, source_match_id: str, row: dict[str, Any]) -> None:
        params = {
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
        }
        response = self.session.patch(
            self._url("match_json_staging"),
            headers=self._headers(),
            params=params,
            json=row,
            timeout=120,
        )
        self._raise_for_status(response, "UPDATE")


def load_env(project_root: Path) -> None:
    env_path = project_root / ".env"
    if env_path.exists() and load_dotenv is not None:
        load_dotenv(env_path)
        logging.info(".env bulundu: %s", env_path)
    elif env_path.exists():
        logging.info(".env bulundu ama python-dotenv kurulu değil: %s", env_path)
    else:
        logging.warning(".env bulunamadı: %s", env_path)


def resolve_credentials() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL bulunamadı.")
    if not key:
        raise RuntimeError("Supabase key bulunamadı. SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY kontrol et.")
    return url, key


def get_match_id(item: dict[str, Any]) -> str | None:
    for key in ("source_match_id", "match_id", "id"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def build_row(item: dict[str, Any], source_name: str) -> dict[str, Any]:
    source_match_id = get_match_id(item)
    if not source_match_id:
        raise ValueError("Kayıtta source_match_id yok.")
    return {
        "source": source_name,
        "source_match_id": source_match_id,
        "payload": item,
    }


def write_batch(batch_json_path: Path, source_name: str, project_root: Path) -> WriteStats:
    if not batch_json_path.exists():
        raise FileNotFoundError(f"batch_matches.json bulunamadı: {batch_json_path}")

    with batch_json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("batch_matches.json liste formatında olmalı.")

    load_env(project_root)
    url, key = resolve_credentials()
    client = SupabaseRawClient(url, key)

    stats = WriteStats(total=len(data))
    logging.info("Batch JSON bulundu: %s", batch_json_path)
    logging.info("Yüklenecek maç sayısı: %s", len(data))

    for idx, item in enumerate(data, start=1):
        try:
            if not isinstance(item, dict):
                raise ValueError("Kayıt dict değil.")
            row = build_row(item, source_name)
            match_id = row["source_match_id"]
            logging.info("%s/%s işleniyor | match_id=%s", idx, len(data), match_id)
            if client.exists(source_name, match_id):
                client.update_row(source_name, match_id, row)
                stats.updated += 1
                logging.info("UPDATE OK | match_id=%s", match_id)
            else:
                client.insert_row(row)
                stats.inserted += 1
                logging.info("INSERT OK | match_id=%s", match_id)
        except Exception as exc:
            stats.failed += 1
            logging.exception("Satır yazılamadı | index=%s | hata=%s", idx, exc)

    return stats


def print_summary(stats: WriteStats) -> None:
    logging.info("============================================================")
    logging.info("BATCH BULK WRITE ÖZETİ")
    logging.info("Toplam   : %s", stats.total)
    logging.info("Inserted : %s", stats.inserted)
    logging.info("Updated  : %s", stats.updated)
    logging.info("Failed   : %s", stats.failed)
    logging.info("============================================================")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="batch_matches.json içindeki kayıtları raw.match_json_staging tablosuna yazar.")
    parser.add_argument("--batch-json", required=True, help="batch_matches.json yolu")
    parser.add_argument("--source", default="opta", help="Kaynak adı")
    return parser


def main() -> None:
    setup_logging()
    args = build_arg_parser().parse_args()
    project_root = Path.cwd()
    batch_json_path = (project_root / args.batch_json).resolve() if not Path(args.batch_json).is_absolute() else Path(args.batch_json)
    stats = write_batch(batch_json_path=batch_json_path, source_name=args.source, project_root=project_root)
    print_summary(stats)
    if stats.failed > 0:
        logging.warning("Bazı satırlar yazılamadı. Logları kontrol et.")


if __name__ == "__main__":
    main()

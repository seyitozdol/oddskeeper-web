import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

import requests
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

SUPABASE_URL_ENV_CANDIDATES = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY_ENV_CANDIDATES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"]

SOURCE_FILTER = "opta"
RAW_SCHEMA = "raw"
RAW_TABLE = "match_json_staging"
TARGET_SCHEMA = "football"
TARGET_TABLE = "match_player_stats_details"
PAGE_SIZE = 1000
REQUEST_TIMEOUT = 60


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )


def load_environment() -> None:
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH)
        logging.info(f".env bulundu: {ENV_PATH}")
    else:
        logging.warning(f".env bulunamadı: {ENV_PATH}")


def get_first_env(candidates: List[str]) -> Optional[str]:
    for name in candidates:
        value = os.getenv(name)
        if value:
            return value
    return None


def require_env(name_candidates: List[str], label: str) -> str:
    value = get_first_env(name_candidates)
    if not value:
        raise RuntimeError(f"Gerekli env bulunamadı: {label}")

    found_name = next((name for name in name_candidates if os.getenv(name)), label)
    logging.info(f"Supabase key env bulundu: {found_name}" if label == "SUPABASE_KEY" else f"Env bulundu: {found_name}")
    return value


def safe_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def safe_numeric(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass
class PlayerDetailRow:
    source: str
    source_match_id: str
    source_team_id: str
    team_name: str
    source_player_id: str
    player_name: str
    player_side: Optional[str]
    lineup_status: Optional[str]
    position_code: Optional[str]
    accurate_pass: Optional[int]
    hit_woodwork: Optional[int]
    attempts_ibox: Optional[int]
    attempts_obox: Optional[int]
    headed_shots: Optional[int]
    expected_goals: Optional[float]
    goal_kicks: Optional[int]
    total_throws: Optional[int]
    out_of_box_goals: Optional[int]
    right_foot_goals: Optional[int]
    left_foot_goals: Optional[int]
    headed_goals: Optional[int]
    penalty_goals: Optional[int]
    freekick_goals: Optional[int]
    fantasy_assist: Optional[int]
    raw_stats: Dict[str, Any]

    def to_row_dict(self) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "source": self.source,
            "source_match_id": self.source_match_id,
            "source_team_id": self.source_team_id,
            "team_name": self.team_name,
            "source_player_id": self.source_player_id,
            "player_name": self.player_name,
            "player_side": self.player_side,
            "lineup_status": self.lineup_status,
            "position_code": self.position_code,
            "accurate_pass": self.accurate_pass,
            "hit_woodwork": self.hit_woodwork,
            "attempts_ibox": self.attempts_ibox,
            "attempts_obox": self.attempts_obox,
            "headed_shots": self.headed_shots,
            "expected_goals": self.expected_goals,
            "goal_kicks": self.goal_kicks,
            "total_throws": self.total_throws,
            "out_of_box_goals": self.out_of_box_goals,
            "right_foot_goals": self.right_foot_goals,
            "left_foot_goals": self.left_foot_goals,
            "headed_goals": self.headed_goals,
            "penalty_goals": self.penalty_goals,
            "freekick_goals": self.freekick_goals,
            "fantasy_assist": self.fantasy_assist,
            "raw_stats": self.raw_stats,
            "payload_last_seen_at": now_iso,
            "updated_at": now_iso,
        }


class SupabaseRestClient:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key
        self.session = requests.Session()
        self.session.headers.update({
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        })

    def _endpoint(self, table: str) -> str:
        return f"{self.url}/rest/v1/{table}"

    def _schema_headers(self, schema: str) -> Dict[str, str]:
        return {
            "Accept-Profile": schema,
            "Content-Profile": schema,
        }

    @staticmethod
    def _raise_for_status(response: requests.Response, context: str) -> None:
        if response.ok:
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        raise RuntimeError(f"{context} başarısız | HTTP {response.status_code} | cevap: {detail}")

    def fetch_staging_rows(self, source: str) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        offset = 0

        while True:
            params = {
                "select": "source,source_match_id,payload",
                "source": f"eq.{source}",
                "order": "source_match_id.asc",
                "limit": str(PAGE_SIZE),
                "offset": str(offset),
            }
            response = self.session.get(
                self._endpoint(RAW_TABLE),
                headers=self._schema_headers(RAW_SCHEMA),
                params=params,
                timeout=REQUEST_TIMEOUT,
            )
            self._raise_for_status(response, "STAGING FETCH")
            batch = response.json()
            if not batch:
                break
            rows.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

        logging.info(f"Fetch edildi: {len(rows)} staging satırı")
        return rows

    def target_exists(self, source: str, source_match_id: str, source_player_id: str) -> bool:
        params = {
            "select": "id",
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
            "source_player_id": f"eq.{source_player_id}",
            "limit": "1",
        }
        response = self.session.get(
            self._endpoint(TARGET_TABLE),
            headers=self._schema_headers(TARGET_SCHEMA),
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "TARGET EXISTS CHECK")
        payload = response.json()
        return len(payload) > 0

    def insert_row(self, row: Dict[str, Any]) -> None:
        response = self.session.post(
            self._endpoint(TARGET_TABLE),
            headers={
                **self._schema_headers(TARGET_SCHEMA),
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            data=json.dumps(row, ensure_ascii=False),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "INSERT")

    def update_row(self, row: Dict[str, Any]) -> None:
        params = {
            "source": f"eq.{row['source']}",
            "source_match_id": f"eq.{row['source_match_id']}",
            "source_player_id": f"eq.{row['source_player_id']}",
        }
        response = self.session.patch(
            self._endpoint(TARGET_TABLE),
            headers={
                **self._schema_headers(TARGET_SCHEMA),
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            params=params,
            data=json.dumps(row, ensure_ascii=False),
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "UPDATE")


def iter_player_detail_rows(staging_row: Dict[str, Any]) -> Iterator[PlayerDetailRow]:
    payload = staging_row.get("payload") or {}
    source = staging_row.get("source") or SOURCE_FILTER
    source_match_id = staging_row.get("source_match_id") or ""

    match_details = payload.get("match_details") or {}
    sections = match_details.get("details_sections") or []

    for section in sections:
        source_team_id = section.get("team_source_id")
        team_name = section.get("section_title") or ""

        if not source_team_id:
            continue

        table = section.get("table") or {}
        rows = table.get("rows") or []

        for row in rows:
            source_player_id = row.get("source_player_id")
            if not source_player_id:
                continue

            stats = row.get("stats") or {}

            yield PlayerDetailRow(
                source=source,
                source_match_id=source_match_id,
                source_team_id=source_team_id,
                team_name=team_name,
                source_player_id=source_player_id,
                player_name=row.get("player_name") or "",
                player_side=row.get("player_side"),
                lineup_status=row.get("lineup_status"),
                position_code=row.get("position_code"),
                accurate_pass=safe_int(stats.get("accuratePass")),
                hit_woodwork=safe_int(stats.get("hitWoodwork")),
                attempts_ibox=safe_int(stats.get("attemptsIbox")),
                attempts_obox=safe_int(stats.get("attemptsObox")),
                headed_shots=safe_int(stats.get("attHdTotal")),
                expected_goals=safe_numeric(stats.get("expectedGoals")),
                goal_kicks=safe_int(stats.get("goalKicks")),
                total_throws=safe_int(stats.get("totalThrows")),
                out_of_box_goals=safe_int(stats.get("attOboxGoal")),
                right_foot_goals=safe_int(stats.get("attRfGoal")),
                left_foot_goals=safe_int(stats.get("attLfGoal")),
                headed_goals=safe_int(stats.get("attHdGoal")),
                penalty_goals=safe_int(stats.get("attPenGoal")),
                freekick_goals=safe_int(stats.get("attFreekickGoal")),
                fantasy_assist=safe_int(stats.get("fantasyAssist")),
                raw_stats=stats,
            )


def collect_rows(staging_rows: List[Dict[str, Any]]) -> List[PlayerDetailRow]:
    collected: List[PlayerDetailRow] = []
    for staging_row in staging_rows:
        collected.extend(list(iter_player_detail_rows(staging_row)))
    return collected


def run_loader() -> None:
    setup_logging()
    logging.info("Staging -> football.match_player_stats_details load başladı...")

    load_environment()
    supabase_url = require_env(SUPABASE_URL_ENV_CANDIDATES, "SUPABASE_URL")
    supabase_key = require_env(SUPABASE_KEY_ENV_CANDIDATES, "SUPABASE_KEY")

    client = SupabaseRestClient(supabase_url, supabase_key)

    staging_rows = client.fetch_staging_rows(SOURCE_FILTER)
    player_rows = collect_rows(staging_rows)

    total = len(player_rows)
    inserted = 0
    updated = 0
    skipped = 0
    failed = 0

    logging.info(f"Yüklenecek details oyuncu satırı: {total}")

    for idx, player_row in enumerate(player_rows, start=1):
        try:
            logging.info(
                f"{idx}/{total} işleniyor | match_id={player_row.source_match_id} | "
                f"player_id={player_row.source_player_id}"
            )

            if not player_row.source_player_id or not player_row.source_team_id:
                skipped += 1
                logging.warning(
                    f"SKIP | match_id={player_row.source_match_id} | "
                    f"player_id={player_row.source_player_id}"
                )
                continue

            row_dict = player_row.to_row_dict()
            exists = client.target_exists(
                player_row.source,
                player_row.source_match_id,
                player_row.source_player_id,
            )

            if exists:
                client.update_row(row_dict)
                updated += 1
                logging.info(
                    f"UPDATE OK | match_id={player_row.source_match_id} | "
                    f"player_id={player_row.source_player_id}"
                )
            else:
                client.insert_row(row_dict)
                inserted += 1
                logging.info(
                    f"INSERT OK | match_id={player_row.source_match_id} | "
                    f"player_id={player_row.source_player_id}"
                )
        except Exception as exc:
            failed += 1
            logging.exception(
                f"FAIL | match_id={player_row.source_match_id} | "
                f"player_id={player_row.source_player_id} | hata={exc}"
            )

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


if __name__ == "__main__":
    run_loader()

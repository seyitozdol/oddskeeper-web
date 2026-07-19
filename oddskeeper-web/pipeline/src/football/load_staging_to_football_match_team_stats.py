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
TARGET_TABLE = "match_team_stats"
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


def safe_iso_from_ms(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    try:
        ms = int(str(value))
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return None


def result_code(score_for: Optional[int], score_against: Optional[int]) -> Optional[str]:
    if score_for is None or score_against is None:
        return None
    if score_for > score_against:
        return "W"
    if score_for < score_against:
        return "L"
    return "D"


def sum_int(values: List[Any]) -> int:
    total = 0
    for value in values:
        parsed = safe_int(value)
        if parsed is not None:
            total += parsed
    return total


def sum_numeric(values: List[Any]) -> float:
    total = 0.0
    for value in values:
        parsed = safe_numeric(value)
        if parsed is not None:
            total += parsed
    return total


@dataclass
class TeamStatRow:
    source: str
    source_match_id: str
    source_team_id: str
    team_name: str
    team_side: str
    opponent_team_source_id: Optional[str]
    opponent_team_name: Optional[str]
    competition: Optional[str]
    match_datetime: Optional[str]
    match_date_text: Optional[str]
    score_for: Optional[int]
    score_against: Optional[int]
    result_code: Optional[str]
    summary_goals: Optional[int]
    summary_assists: Optional[int]
    summary_red_cards: Optional[int]
    summary_yellow_cards: Optional[int]
    summary_corners_won: Optional[int]
    summary_shots: Optional[int]
    summary_shots_on_target: Optional[int]
    summary_blocked_shots: Optional[int]
    summary_passes: Optional[int]
    summary_crosses: Optional[int]
    summary_tackles: Optional[int]
    summary_offsides: Optional[int]
    summary_fouls_conceded: Optional[int]
    summary_fouls_won: Optional[int]
    summary_saves: Optional[int]
    details_accurate_pass: Optional[int]
    details_hit_woodwork: Optional[int]
    details_attempts_ibox: Optional[int]
    details_attempts_obox: Optional[int]
    details_headed_shots: Optional[int]
    details_expected_goals: Optional[float]
    details_goal_kicks: Optional[int]
    details_total_throws: Optional[int]
    details_out_of_box_goals: Optional[int]
    details_right_foot_goals: Optional[int]
    details_left_foot_goals: Optional[int]
    details_headed_goals: Optional[int]
    details_penalty_goals: Optional[int]
    details_freekick_goals: Optional[int]
    details_fantasy_assist: Optional[int]
    opta_player_count: Optional[int]
    opta_starter_count: Optional[int]
    opta_substitute_count: Optional[int]
    opta_points_total: Optional[float]
    opta_minutes_total: Optional[int]
    opta_goals_total: Optional[int]
    opta_shots_on_target_total: Optional[int]
    opta_shots_off_target_total: Optional[int]
    opta_shots_blocked_total: Optional[int]
    opta_own_goals_total: Optional[int]
    opta_assists_total: Optional[int]
    opta_passes_total: Optional[float]
    opta_crosses_total: Optional[float]
    opta_tackles_total: Optional[int]
    opta_interceptions_total: Optional[int]
    opta_fouls_won_total: Optional[int]
    opta_fouls_conceded_total: Optional[int]
    opta_offsides_total: Optional[int]
    opta_cards_yellow_total: Optional[int]
    opta_cards_red_total: Optional[int]
    opta_goals_conceded_total: Optional[int]
    opta_penalties_won_total: Optional[int]
    opta_saves_total: Optional[int]
    opta_penalties_saved_total: Optional[int]
    raw_summary_totals: Dict[str, Any]
    raw_details_totals: Dict[str, Any]
    raw_opta_totals: Dict[str, Any]

    def to_row_dict(self) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "source": self.source,
            "source_match_id": self.source_match_id,
            "source_team_id": self.source_team_id,
            "team_name": self.team_name,
            "team_side": self.team_side,
            "opponent_team_source_id": self.opponent_team_source_id,
            "opponent_team_name": self.opponent_team_name,
            "competition": self.competition,
            "match_datetime": self.match_datetime,
            "match_date_text": self.match_date_text,
            "score_for": self.score_for,
            "score_against": self.score_against,
            "result_code": self.result_code,
            "summary_goals": self.summary_goals,
            "summary_assists": self.summary_assists,
            "summary_red_cards": self.summary_red_cards,
            "summary_yellow_cards": self.summary_yellow_cards,
            "summary_corners_won": self.summary_corners_won,
            "summary_shots": self.summary_shots,
            "summary_shots_on_target": self.summary_shots_on_target,
            "summary_blocked_shots": self.summary_blocked_shots,
            "summary_passes": self.summary_passes,
            "summary_crosses": self.summary_crosses,
            "summary_tackles": self.summary_tackles,
            "summary_offsides": self.summary_offsides,
            "summary_fouls_conceded": self.summary_fouls_conceded,
            "summary_fouls_won": self.summary_fouls_won,
            "summary_saves": self.summary_saves,
            "details_accurate_pass": self.details_accurate_pass,
            "details_hit_woodwork": self.details_hit_woodwork,
            "details_attempts_ibox": self.details_attempts_ibox,
            "details_attempts_obox": self.details_attempts_obox,
            "details_headed_shots": self.details_headed_shots,
            "details_expected_goals": self.details_expected_goals,
            "details_goal_kicks": self.details_goal_kicks,
            "details_total_throws": self.details_total_throws,
            "details_out_of_box_goals": self.details_out_of_box_goals,
            "details_right_foot_goals": self.details_right_foot_goals,
            "details_left_foot_goals": self.details_left_foot_goals,
            "details_headed_goals": self.details_headed_goals,
            "details_penalty_goals": self.details_penalty_goals,
            "details_freekick_goals": self.details_freekick_goals,
            "details_fantasy_assist": self.details_fantasy_assist,
            "opta_player_count": self.opta_player_count,
            "opta_starter_count": self.opta_starter_count,
            "opta_substitute_count": self.opta_substitute_count,
            "opta_points_total": self.opta_points_total,
            "opta_minutes_total": self.opta_minutes_total,
            "opta_goals_total": self.opta_goals_total,
            "opta_shots_on_target_total": self.opta_shots_on_target_total,
            "opta_shots_off_target_total": self.opta_shots_off_target_total,
            "opta_shots_blocked_total": self.opta_shots_blocked_total,
            "opta_own_goals_total": self.opta_own_goals_total,
            "opta_assists_total": self.opta_assists_total,
            "opta_passes_total": self.opta_passes_total,
            "opta_crosses_total": self.opta_crosses_total,
            "opta_tackles_total": self.opta_tackles_total,
            "opta_interceptions_total": self.opta_interceptions_total,
            "opta_fouls_won_total": self.opta_fouls_won_total,
            "opta_fouls_conceded_total": self.opta_fouls_conceded_total,
            "opta_offsides_total": self.opta_offsides_total,
            "opta_cards_yellow_total": self.opta_cards_yellow_total,
            "opta_cards_red_total": self.opta_cards_red_total,
            "opta_goals_conceded_total": self.opta_goals_conceded_total,
            "opta_penalties_won_total": self.opta_penalties_won_total,
            "opta_saves_total": self.opta_saves_total,
            "opta_penalties_saved_total": self.opta_penalties_saved_total,
            "raw_summary_totals": self.raw_summary_totals,
            "raw_details_totals": self.raw_details_totals,
            "raw_opta_totals": self.raw_opta_totals,
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

    def _endpoint(self, schema: str, table: str) -> str:
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
                self._endpoint(RAW_SCHEMA, RAW_TABLE),
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

    def target_exists(self, source: str, source_match_id: str, source_team_id: str) -> bool:
        params = {
            "select": "id",
            "source": f"eq.{source}",
            "source_match_id": f"eq.{source_match_id}",
            "source_team_id": f"eq.{source_team_id}",
            "limit": "1",
        }
        response = self.session.get(
            self._endpoint(TARGET_SCHEMA, TARGET_TABLE),
            headers=self._schema_headers(TARGET_SCHEMA),
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        self._raise_for_status(response, "TARGET EXISTS CHECK")
        payload = response.json()
        return len(payload) > 0

    def insert_row(self, row: Dict[str, Any]) -> None:
        response = self.session.post(
            self._endpoint(TARGET_SCHEMA, TARGET_TABLE),
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
            "source_team_id": f"eq.{row['source_team_id']}",
        }
        response = self.session.patch(
            self._endpoint(TARGET_SCHEMA, TARGET_TABLE),
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


def get_section_map(sections: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    mapped: Dict[str, Dict[str, Any]] = {}
    for section in sections or []:
        team_source_id = section.get("team_source_id")
        if not team_source_id:
            continue
        mapped[str(team_source_id)] = section
    return mapped


def aggregate_opta_team_section(section: Dict[str, Any]) -> Dict[str, Any]:
    table = (section or {}).get("table") or {}
    rows = table.get("rows") or []

    starters = 0
    substitutes = 0
    valid_player_rows = []

    for row in rows:
        if not row.get("source_player_id"):
            continue
        valid_player_rows.append(row)
        status = (row.get("lineup_status") or "").lower()
        if status == "starter":
            starters += 1
        elif status == "substitute":
            substitutes += 1

    def stat_values(key: str) -> List[Any]:
        return [(row.get("stats") or {}).get(key) for row in valid_player_rows]

    aggregated = {
        "player_count": len(valid_player_rows),
        "starter_count": starters,
        "substitute_count": substitutes,
        "points_total": round(sum_numeric(stat_values("points")), 3),
        "minutes_total": sum_int(stat_values("minutes_played")),
        "goals_total": sum_int(stat_values("goals")),
        "shots_on_target_total": sum_int(stat_values("shots_on_target")),
        "shots_off_target_total": sum_int(stat_values("shots_off_target")),
        "shots_blocked_total": sum_int(stat_values("shots_blocked")),
        "own_goals_total": sum_int(stat_values("own_goals")),
        "assists_total": sum_int(stat_values("assists")),
        "passes_total": round(sum_numeric(stat_values("passes")), 3),
        "crosses_total": round(sum_numeric(stat_values("crosses")), 3),
        "tackles_total": sum_int(stat_values("tackles")),
        "interceptions_total": sum_int(stat_values("interceptions")),
        "fouls_won_total": sum_int(stat_values("fouls_won")),
        "fouls_conceded_total": sum_int(stat_values("fouls_conceded")),
        "offsides_total": sum_int(stat_values("offsides")),
        "cards_yellow_total": sum_int(stat_values("cards_yellow")),
        "cards_red_total": sum_int(stat_values("cards_red")),
        "goals_conceded_total": sum_int(stat_values("goals_conceeded")),
        "penalties_won_total": sum_int(stat_values("penalties_won")),
        "saves_total": sum_int(stat_values("saves_total")),
        "penalties_saved_total": sum_int(stat_values("penalties_saved")),
    }
    return aggregated


def iter_team_stat_rows(staging_row: Dict[str, Any]) -> Iterator[TeamStatRow]:
    payload = staging_row.get("payload") or {}
    source = staging_row.get("source") or SOURCE_FILTER
    source_match_id = staging_row.get("source_match_id") or ""

    match_info = (payload.get("match_summary") or {}).get("match_info") or {}
    home_team = match_info.get("home_team") or {}
    away_team = match_info.get("away_team") or {}

    summary_map = get_section_map((payload.get("match_summary") or {}).get("player_stats_sections") or [])
    details_map = get_section_map((payload.get("match_details") or {}).get("details_sections") or [])
    opta_map = get_section_map((payload.get("opta_points_stats") or {}).get("stats_sections") or [])

    team_specs = [
        {
            "team_side": "home",
            "team": home_team,
            "opponent": away_team,
            "score_for": safe_int(home_team.get("score")),
            "score_against": safe_int(away_team.get("score")),
        },
        {
            "team_side": "away",
            "team": away_team,
            "opponent": home_team,
            "score_for": safe_int(away_team.get("score")),
            "score_against": safe_int(home_team.get("score")),
        },
    ]

    for spec in team_specs:
        team = spec["team"]
        opponent = spec["opponent"]
        source_team_id = team.get("source_team_id") or ""
        team_name = team.get("name") or ""

        if not source_team_id or not team_name:
            continue

        summary_section = summary_map.get(source_team_id) or {}
        details_section = details_map.get(source_team_id) or {}
        opta_section = opta_map.get(source_team_id) or {}

        summary_totals = (((summary_section.get("table") or {}).get("totals") or {}).get("stats") or {})
        details_totals = (((details_section.get("table") or {}).get("totals") or {}).get("stats") or {})
        opta_totals = aggregate_opta_team_section(opta_section) if opta_section else {}

        yield TeamStatRow(
            source=source,
            source_match_id=source_match_id,
            source_team_id=source_team_id,
            team_name=team_name,
            team_side=spec["team_side"],
            opponent_team_source_id=opponent.get("source_team_id"),
            opponent_team_name=opponent.get("name"),
            competition=match_info.get("competition"),
            match_datetime=safe_iso_from_ms(match_info.get("raw_match_date_ms")),
            match_date_text=match_info.get("match_date_text"),
            score_for=spec["score_for"],
            score_against=spec["score_against"],
            result_code=result_code(spec["score_for"], spec["score_against"]),
            summary_goals=safe_int(summary_totals.get("Goals")),
            summary_assists=safe_int(summary_totals.get("Assists")),
            summary_red_cards=safe_int(summary_totals.get("Red cards")),
            summary_yellow_cards=safe_int(summary_totals.get("Yellow cards")),
            summary_corners_won=safe_int(summary_totals.get("Corners won")),
            summary_shots=safe_int(summary_totals.get("Shots")),
            summary_shots_on_target=safe_int(summary_totals.get("Shots on target")),
            summary_blocked_shots=safe_int(summary_totals.get("Blocked shots")),
            summary_passes=safe_int(summary_totals.get("Passes")),
            summary_crosses=safe_int(summary_totals.get("Crosses")),
            summary_tackles=safe_int(summary_totals.get("Tackles")),
            summary_offsides=safe_int(summary_totals.get("Offsides")),
            summary_fouls_conceded=safe_int(summary_totals.get("Fouls conceded")),
            summary_fouls_won=safe_int(summary_totals.get("Fouls won")),
            summary_saves=safe_int(summary_totals.get("Saves")),
            details_accurate_pass=safe_int(details_totals.get("accuratePass")),
            details_hit_woodwork=safe_int(details_totals.get("hitWoodwork")),
            details_attempts_ibox=safe_int(details_totals.get("attemptsIbox")),
            details_attempts_obox=safe_int(details_totals.get("attemptsObox")),
            details_headed_shots=safe_int(details_totals.get("attHdTotal")),
            details_expected_goals=safe_numeric(details_totals.get("expectedGoals")),
            details_goal_kicks=safe_int(details_totals.get("goalKicks")),
            details_total_throws=safe_int(details_totals.get("totalThrows")),
            details_out_of_box_goals=safe_int(details_totals.get("attOboxGoal")),
            details_right_foot_goals=safe_int(details_totals.get("attRfGoal")),
            details_left_foot_goals=safe_int(details_totals.get("attLfGoal")),
            details_headed_goals=safe_int(details_totals.get("attHdGoal")),
            details_penalty_goals=safe_int(details_totals.get("attPenGoal")),
            details_freekick_goals=safe_int(details_totals.get("attFreekickGoal")),
            details_fantasy_assist=safe_int(details_totals.get("fantasyAssist")),
            opta_player_count=safe_int(opta_totals.get("player_count")),
            opta_starter_count=safe_int(opta_totals.get("starter_count")),
            opta_substitute_count=safe_int(opta_totals.get("substitute_count")),
            opta_points_total=safe_numeric(opta_totals.get("points_total")),
            opta_minutes_total=safe_int(opta_totals.get("minutes_total")),
            opta_goals_total=safe_int(opta_totals.get("goals_total")),
            opta_shots_on_target_total=safe_int(opta_totals.get("shots_on_target_total")),
            opta_shots_off_target_total=safe_int(opta_totals.get("shots_off_target_total")),
            opta_shots_blocked_total=safe_int(opta_totals.get("shots_blocked_total")),
            opta_own_goals_total=safe_int(opta_totals.get("own_goals_total")),
            opta_assists_total=safe_int(opta_totals.get("assists_total")),
            opta_passes_total=safe_numeric(opta_totals.get("passes_total")),
            opta_crosses_total=safe_numeric(opta_totals.get("crosses_total")),
            opta_tackles_total=safe_int(opta_totals.get("tackles_total")),
            opta_interceptions_total=safe_int(opta_totals.get("interceptions_total")),
            opta_fouls_won_total=safe_int(opta_totals.get("fouls_won_total")),
            opta_fouls_conceded_total=safe_int(opta_totals.get("fouls_conceded_total")),
            opta_offsides_total=safe_int(opta_totals.get("offsides_total")),
            opta_cards_yellow_total=safe_int(opta_totals.get("cards_yellow_total")),
            opta_cards_red_total=safe_int(opta_totals.get("cards_red_total")),
            opta_goals_conceded_total=safe_int(opta_totals.get("goals_conceded_total")),
            opta_penalties_won_total=safe_int(opta_totals.get("penalties_won_total")),
            opta_saves_total=safe_int(opta_totals.get("saves_total")),
            opta_penalties_saved_total=safe_int(opta_totals.get("penalties_saved_total")),
            raw_summary_totals=summary_totals,
            raw_details_totals=details_totals,
            raw_opta_totals=opta_totals,
        )


def collect_rows(staging_rows: List[Dict[str, Any]]) -> List[TeamStatRow]:
    collected: List[TeamStatRow] = []
    for staging_row in staging_rows:
        collected.extend(list(iter_team_stat_rows(staging_row)))
    return collected


def run_loader() -> None:
    setup_logging()
    logging.info("Staging -> football.match_team_stats load başladı...")

    load_environment()
    supabase_url = require_env(SUPABASE_URL_ENV_CANDIDATES, "SUPABASE_URL")
    supabase_key = require_env(SUPABASE_KEY_ENV_CANDIDATES, "SUPABASE_KEY")

    client = SupabaseRestClient(supabase_url, supabase_key)

    staging_rows = client.fetch_staging_rows(SOURCE_FILTER)
    team_rows = collect_rows(staging_rows)

    total = len(team_rows)
    inserted = 0
    updated = 0
    skipped = 0
    failed = 0

    logging.info(f"Yüklenecek takım satırı: {total}")

    for idx, team_row in enumerate(team_rows, start=1):
        try:
            logging.info(
                f"{idx}/{total} işleniyor | match_id={team_row.source_match_id} | "
                f"team_id={team_row.source_team_id}"
            )

            if not team_row.source_team_id or not team_row.team_name:
                skipped += 1
                logging.warning(
                    f"SKIP | match_id={team_row.source_match_id} | "
                    f"team_id={team_row.source_team_id}"
                )
                continue

            row_dict = team_row.to_row_dict()
            exists = client.target_exists(
                team_row.source,
                team_row.source_match_id,
                team_row.source_team_id,
            )

            if exists:
                client.update_row(row_dict)
                updated += 1
                logging.info(
                    f"UPDATE OK | match_id={team_row.source_match_id} | "
                    f"team_id={team_row.source_team_id}"
                )
            else:
                client.insert_row(row_dict)
                inserted += 1
                logging.info(
                    f"INSERT OK | match_id={team_row.source_match_id} | "
                    f"team_id={team_row.source_team_id}"
                )
        except Exception as exc:
            failed += 1
            logging.exception(
                f"FAIL | match_id={team_row.source_match_id} | "
                f"team_id={team_row.source_team_id} | hata={exc}"
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

from __future__ import annotations

import csv
import json
import logging
import math
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests
from dotenv import load_dotenv


# ============================================================
# AYARLAR
# ============================================================
SOURCE_NAME = "opta"
SCHEMA_NAME = "raw"
TABLE_NAME = "match_json_staging"
PAGE_SIZE = 500

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "data" / "audit"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LOG_LEVEL = logging.INFO

# Audit toleransları
TOTALS_FLOAT_TOLERANCE = 0.01
TIMELINE_IS_REQUIRED = False


# ============================================================
# LOGGING
# ============================================================
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(message)s",
)


# ============================================================
# ENV / CONFIG
# ============================================================
def load_environment() -> None:
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logging.info(f".env bulundu: {env_path}")
    else:
        logging.warning(f".env bulunamadı: {env_path}")


# ============================================================
# SUPABASE REST CLIENT
# ============================================================
class SupabaseRestClient:
    def __init__(self, base_url: str, api_key: str, schema_name: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.schema_name = schema_name
        self.session = requests.Session()

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Accept-Profile": self.schema_name,
            "Content-Profile": self.schema_name,
        }

    def fetch_all_payload_rows(self, table_name: str, source_name: str, page_size: int = 500) -> List[Dict[str, Any]]:
        all_rows: List[Dict[str, Any]] = []
        offset = 0

        while True:
            url = f"{self.base_url}/rest/v1/{table_name}"
            params = {
                "select": "source_match_id,payload",
                "source": f"eq.{source_name}",
                "order": "source_match_id.asc",
            }
            headers = self._headers()
            headers["Range-Unit"] = "items"
            headers["Range"] = f"{offset}-{offset + page_size - 1}"

            response = self.session.get(url, headers=headers, params=params, timeout=60)
            if response.status_code >= 400:
                detail = safe_json(response)
                raise RuntimeError(
                    f"FETCH başarısız | HTTP {response.status_code} | cevap: {detail}"
                )

            rows = response.json()
            if not rows:
                break

            all_rows.extend(rows)
            logging.info(f"Fetch edildi: {len(rows)} satır | toplam={len(all_rows)}")

            if len(rows) < page_size:
                break

            offset += page_size

        return all_rows


# ============================================================
# YARDIMCI FONKSIYONLAR
# ============================================================
def safe_json(response: requests.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return response.text


def to_payload_dict(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, str):
        return json.loads(payload)
    raise TypeError(f"Beklenmeyen payload tipi: {type(payload).__name__}")


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and not math.isnan(value)


def almost_equal(a: Any, b: Any, tolerance: float = TOTALS_FLOAT_TOLERANCE) -> bool:
    if not is_number(a) or not is_number(b):
        return False
    return abs(float(a) - float(b)) <= tolerance


def get_nested(data: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    current = data
    for key in path:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current


# ============================================================
# AUDIT CHECKLERI
# ============================================================
def collect_player_rows_from_summary(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    sections = get_nested(payload, ["match_summary", "player_stats_sections"], []) or []
    for section in sections:
        table_rows = get_nested(section, ["table", "rows"], []) or []
        rows.extend(table_rows)
    return rows


def collect_player_rows_from_opta(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    sections = get_nested(payload, ["opta_points_stats", "stats_sections"], []) or []
    for section in sections:
        table_rows = get_nested(section, ["table", "rows"], []) or []
        rows.extend(table_rows)
    return rows


def collect_player_rows_from_details(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    sections = get_nested(payload, ["match_details", "details_sections"], []) or []
    for section in sections:
        table_rows = get_nested(section, ["table", "rows"], []) or []
        rows.extend(table_rows)
    return rows


def count_missing_player_ids(rows: List[Dict[str, Any]]) -> int:
    return sum(1 for row in rows if not row.get("source_player_id"))


def collect_incidents(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    incidents = get_nested(payload, ["match_summary", "incidents"], {}) or {}
    home = incidents.get("home", []) or []
    away = incidents.get("away", []) or []
    timeline = incidents.get("timeline", []) or []
    return home, away, timeline


def count_undefined_incident_ids(incidents: List[Dict[str, Any]]) -> int:
    bad_values = {"undefined", "Undefined", "UNDEFINED"}
    return sum(1 for inc in incidents if inc.get("source_incident_id") in bad_values)


def count_duplicate_incident_keys(incidents: List[Dict[str, Any]]) -> int:
    keys = [inc.get("incident_key") for inc in incidents if inc.get("incident_key")]
    counts = Counter(keys)
    return sum(1 for _, cnt in counts.items() if cnt > 1)


def count_bad_xg_values(payload: Dict[str, Any]) -> int:
    bad_count = 0
    sections = get_nested(payload, ["match_details", "details_sections"], []) or []

    for section in sections:
        rows = get_nested(section, ["table", "rows"], []) or []
        for row in rows:
            stats = row.get("stats", {}) or {}
            if "expectedGoals" in stats:
                value = stats.get("expectedGoals")
                if value is not None and not is_number(value):
                    bad_count += 1

        totals_stats = get_nested(section, ["table", "totals", "stats"], {}) or {}
        if "expectedGoals" in totals_stats:
            total_value = totals_stats.get("expectedGoals")
            if total_value is not None and not is_number(total_value):
                bad_count += 1

    return bad_count


def compare_team_totals_with_all(
    sections: List[Dict[str, Any]],
    table_key: str,
) -> List[Dict[str, Any]]:
    """
    All section total ile takım section total toplamını kıyaslar.
    """
    all_section = None
    team_sections: List[Dict[str, Any]] = []

    for section in sections:
        title = (section.get("section_title") or "").strip().lower()
        if title == "all":
            all_section = section
        else:
            team_sections.append(section)

    if not all_section or len(team_sections) < 2:
        return []

    all_totals = get_nested(all_section, [table_key, "totals", "stats"], {}) or {}
    if not all_totals:
        return []

    mismatches: List[Dict[str, Any]] = []
    team_total_dicts = [get_nested(sec, [table_key, "totals", "stats"], {}) or {} for sec in team_sections]

    for stat_key, all_value in all_totals.items():
        if not is_number(all_value):
            continue

        candidate_values = []
        valid = True
        for team_totals in team_total_dicts:
            val = team_totals.get(stat_key)
            if not is_number(val):
                valid = False
                break
            candidate_values.append(float(val))

        if not valid:
            continue

        team_sum = sum(candidate_values)
        if not almost_equal(float(all_value), team_sum):
            mismatches.append(
                {
                    "stat_key": stat_key,
                    "all_value": float(all_value),
                    "team_sum": float(team_sum),
                }
            )

    return mismatches


def audit_single_match(row: Dict[str, Any]) -> Dict[str, Any]:
    payload = to_payload_dict(row["payload"])
    match_id = row.get("source_match_id") or ""

    summary_info = get_nested(payload, ["match_summary", "match_info"], {}) or {}
    opta_info = get_nested(payload, ["opta_points_stats", "match_info"], {}) or {}
    details_info = get_nested(payload, ["match_details", "match_info"], {}) or {}

    summary_status = get_nested(payload, ["match_summary", "page_status", "status"], "missing")
    opta_status = get_nested(payload, ["opta_points_stats", "page_status", "status"], "missing")
    details_status = get_nested(payload, ["match_details", "page_status", "status"], "missing")
    overall_status = payload.get("overall_status", "missing")

    summary_sections = get_nested(payload, ["match_summary", "player_stats_sections"], []) or []
    opta_sections = get_nested(payload, ["opta_points_stats", "stats_sections"], []) or []
    detail_sections = get_nested(payload, ["match_details", "details_sections"], []) or []

    summary_rows = collect_player_rows_from_summary(payload)
    opta_rows = collect_player_rows_from_opta(payload)
    details_rows = collect_player_rows_from_details(payload)

    home_incidents, away_incidents, timeline = collect_incidents(payload)
    all_incidents = home_incidents + away_incidents

    summary_totals_mismatches = compare_team_totals_with_all(summary_sections, "table")
    details_totals_mismatches = compare_team_totals_with_all(detail_sections, "table")

    missing_team_ids = 0
    for info in (summary_info, opta_info, details_info):
        home_team_id = get_nested(info, ["home_team", "source_team_id"])
        away_team_id = get_nested(info, ["away_team", "source_team_id"])
        if not home_team_id:
            missing_team_ids += 1
        if not away_team_id:
            missing_team_ids += 1

    summary_missing_player_ids = count_missing_player_ids(summary_rows)
    opta_missing_player_ids = count_missing_player_ids(opta_rows)
    details_missing_player_ids = count_missing_player_ids(details_rows)
    bad_xg_count = count_bad_xg_values(payload)
    undefined_incident_ids = count_undefined_incident_ids(all_incidents)
    duplicate_incident_keys = count_duplicate_incident_keys(all_incidents)

    issue_types: List[str] = []
    warning_types: List[str] = []

    if overall_status != "ok":
        issue_types.append("overall_status_not_ok")
    if summary_status != "ok":
        issue_types.append("summary_status_not_ok")
    if opta_status != "ok":
        issue_types.append("opta_status_not_ok")
    if details_status != "ok":
        issue_types.append("details_status_not_ok")
    if missing_team_ids > 0:
        issue_types.append("missing_team_ids")
    if summary_missing_player_ids > 0:
        issue_types.append("summary_missing_player_ids")
    if opta_missing_player_ids > 0:
        issue_types.append("opta_missing_player_ids")
    if details_missing_player_ids > 0:
        issue_types.append("details_missing_player_ids")
    if bad_xg_count > 0:
        issue_types.append("bad_xg_values")
    if undefined_incident_ids > 0:
        issue_types.append("undefined_incident_ids")
    if duplicate_incident_keys > 0:
        issue_types.append("duplicate_incident_keys")
    if summary_totals_mismatches:
        issue_types.append("summary_totals_mismatch")
    if details_totals_mismatches:
        issue_types.append("details_totals_mismatch")

    if len(summary_sections) != 3:
        warning_types.append("summary_section_count_unexpected")
    if len(opta_sections) != 3:
        warning_types.append("opta_section_count_unexpected")
    if len(detail_sections) != 3:
        warning_types.append("detail_section_count_unexpected")
    if TIMELINE_IS_REQUIRED and len(timeline) == 0:
        warning_types.append("empty_timeline")
    if len(all_incidents) == 0:
        warning_types.append("no_incidents")

    home_name = get_nested(summary_info, ["home_team", "name"], "") or ""
    away_name = get_nested(summary_info, ["away_team", "name"], "") or ""
    fixture = f"{home_name} - {away_name}".strip(" -")

    return {
        "source_match_id": match_id,
        "fixture": fixture,
        "match_date_text": summary_info.get("match_date_text", ""),
        "overall_status": overall_status,
        "summary_status": summary_status,
        "opta_status": opta_status,
        "details_status": details_status,
        "summary_sections": len(summary_sections),
        "opta_sections": len(opta_sections),
        "details_sections": len(detail_sections),
        "incidents_home_count": len(home_incidents),
        "incidents_away_count": len(away_incidents),
        "timeline_count": len(timeline),
        "missing_team_ids": missing_team_ids,
        "summary_missing_player_ids": summary_missing_player_ids,
        "opta_missing_player_ids": opta_missing_player_ids,
        "details_missing_player_ids": details_missing_player_ids,
        "bad_xg_count": bad_xg_count,
        "summary_totals_mismatch_count": len(summary_totals_mismatches),
        "details_totals_mismatch_count": len(details_totals_mismatches),
        "undefined_incident_ids": undefined_incident_ids,
        "duplicate_incident_keys": duplicate_incident_keys,
        "issue_count": len(issue_types),
        "warning_count": len(warning_types),
        "issue_types": issue_types,
        "warning_types": warning_types,
        "issue_details": {
            "summary_totals_mismatches": summary_totals_mismatches,
            "details_totals_mismatches": details_totals_mismatches,
        },
    }


# ============================================================
# RAPORLAMA
# ============================================================
def write_csv_report(rows: List[Dict[str, Any]], output_path: Path) -> None:
    if not rows:
        logging.warning("CSV yazılmadı: satır yok")
        return

    flat_rows: List[Dict[str, Any]] = []
    for row in rows:
        flat_rows.append(
            {
                "source_match_id": row["source_match_id"],
                "fixture": row["fixture"],
                "match_date_text": row["match_date_text"],
                "overall_status": row["overall_status"],
                "summary_status": row["summary_status"],
                "opta_status": row["opta_status"],
                "details_status": row["details_status"],
                "summary_sections": row["summary_sections"],
                "opta_sections": row["opta_sections"],
                "details_sections": row["details_sections"],
                "incidents_home_count": row["incidents_home_count"],
                "incidents_away_count": row["incidents_away_count"],
                "timeline_count": row["timeline_count"],
                "missing_team_ids": row["missing_team_ids"],
                "summary_missing_player_ids": row["summary_missing_player_ids"],
                "opta_missing_player_ids": row["opta_missing_player_ids"],
                "details_missing_player_ids": row["details_missing_player_ids"],
                "bad_xg_count": row["bad_xg_count"],
                "summary_totals_mismatch_count": row["summary_totals_mismatch_count"],
                "details_totals_mismatch_count": row["details_totals_mismatch_count"],
                "undefined_incident_ids": row["undefined_incident_ids"],
                "duplicate_incident_keys": row["duplicate_incident_keys"],
                "issue_count": row["issue_count"],
                "warning_count": row["warning_count"],
                "issue_types": " | ".join(row["issue_types"]),
                "warning_types": " | ".join(row["warning_types"]),
            }
        )

    with output_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(flat_rows[0].keys()))
        writer.writeheader()
        writer.writerows(flat_rows)


def write_json_report(data: Any, output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def build_summary(audit_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    issue_counter = Counter()
    warning_counter = Counter()

    for row in audit_rows:
        issue_counter.update(row["issue_types"])
        warning_counter.update(row["warning_types"])

    problem_matches = [row for row in audit_rows if row["issue_count"] > 0]
    warning_matches = [row for row in audit_rows if row["warning_count"] > 0]

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total_matches": len(audit_rows),
        "issue_match_count": len(problem_matches),
        "warning_match_count": len(warning_matches),
        "issue_type_counts": dict(issue_counter),
        "warning_type_counts": dict(warning_counter),
        "problem_match_ids": [row["source_match_id"] for row in problem_matches],
        "warning_match_ids": [row["source_match_id"] for row in warning_matches],
    }


def print_summary(summary: Dict[str, Any]) -> None:
    logging.info("=" * 60)
    logging.info("STAGING AUDIT ÖZETİ")
    logging.info(f"Toplam maç          : {summary['total_matches']}")
    logging.info(f"Issue olan maç      : {summary['issue_match_count']}")
    logging.info(f"Warning olan maç    : {summary['warning_match_count']}")

    if summary["issue_type_counts"]:
        logging.info("Issue kırılımı:")
        for key, value in summary["issue_type_counts"].items():
            logging.info(f"  - {key}: {value}")
    else:
        logging.info("Issue kırılımı: yok")

    if summary["warning_type_counts"]:
        logging.info("Warning kırılımı:")
        for key, value in summary["warning_type_counts"].items():
            logging.info(f"  - {key}: {value}")
    else:
        logging.info("Warning kırılımı: yok")

    logging.info("=" * 60)


# ============================================================
# MAIN
# ============================================================
def main() -> None:
    logging.info("Staging audit başladı...")
    load_environment()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
    )

    if not supabase_url:
        raise RuntimeError("SUPABASE_URL bulunamadı")
    if not supabase_key:
        raise RuntimeError("SUPABASE_SECRET_KEY / SERVICE_ROLE / KEY bulunamadı")

    client = SupabaseRestClient(
        base_url=supabase_url,
        api_key=supabase_key,
        schema_name=SCHEMA_NAME,
    )

    rows = client.fetch_all_payload_rows(
        table_name=TABLE_NAME,
        source_name=SOURCE_NAME,
        page_size=PAGE_SIZE,
    )

    if not rows:
        logging.warning("Audit edilecek satır bulunamadı")
        return

    logging.info(f"Audit edilecek staging satırı: {len(rows)}")

    audit_rows: List[Dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        match_id = row.get("source_match_id", "")
        logging.info(f"{index}/{len(rows)} audit ediliyor | match_id={match_id}")
        try:
            audit_rows.append(audit_single_match(row))
        except Exception as exc:
            logging.exception(f"Audit başarısız | match_id={match_id} | hata={exc}")
            audit_rows.append(
                {
                    "source_match_id": match_id,
                    "fixture": "",
                    "match_date_text": "",
                    "overall_status": "audit_failed",
                    "summary_status": "audit_failed",
                    "opta_status": "audit_failed",
                    "details_status": "audit_failed",
                    "summary_sections": 0,
                    "opta_sections": 0,
                    "details_sections": 0,
                    "incidents_home_count": 0,
                    "incidents_away_count": 0,
                    "timeline_count": 0,
                    "missing_team_ids": 0,
                    "summary_missing_player_ids": 0,
                    "opta_missing_player_ids": 0,
                    "details_missing_player_ids": 0,
                    "bad_xg_count": 0,
                    "summary_totals_mismatch_count": 0,
                    "details_totals_mismatch_count": 0,
                    "undefined_incident_ids": 0,
                    "duplicate_incident_keys": 0,
                    "issue_count": 1,
                    "warning_count": 0,
                    "issue_types": ["audit_failed"],
                    "warning_types": [],
                    "issue_details": {},
                }
            )

    summary = build_summary(audit_rows)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = OUTPUT_DIR / f"staging_audit_report_{timestamp}.csv"
    json_path = OUTPUT_DIR / f"staging_audit_report_{timestamp}.json"
    summary_path = OUTPUT_DIR / f"staging_audit_summary_{timestamp}.json"

    write_csv_report(audit_rows, csv_path)
    write_json_report(audit_rows, json_path)
    write_json_report(summary, summary_path)

    logging.info(f"CSV rapor yazıldı   : {csv_path}")
    logging.info(f"JSON rapor yazıldı  : {json_path}")
    logging.info(f"Özet rapor yazıldı  : {summary_path}")

    print_summary(summary)
    logging.info("Staging audit tamamlandı.")


if __name__ == "__main__":
    main()

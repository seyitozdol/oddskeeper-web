import csv
import json
from pathlib import Path
from datetime import datetime


PROJECT_ROOT = Path(__file__).resolve().parents[2]
JSON_PATH = PROJECT_ROOT / "data" / "raw" / "opta_unified_matches" / "all_matches.json"
AUDIT_DIR = PROJECT_ROOT / "data" / "audit"


def first_existing(d: dict, keys: list[str]):
    for key in keys:
        if key in d:
            return d.get(key)
    return None


def is_nonempty(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, (list, tuple, set)):
        return len(value) > 0
    if isinstance(value, dict):
        if not value:
            return False
        # dict içindeki herhangi bir dolu değer yeterli
        return any(is_nonempty(v) for v in value.values())
    if isinstance(value, (int, float)):
        return True
    return True


def to_text(value) -> str:
    if value is None:
        return ""
    return str(value)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main():
    if not JSON_PATH.exists():
        print(f"HATA: JSON bulunamadı -> {JSON_PATH}")
        return

    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    data = load_json(JSON_PATH)

    if not isinstance(data, list):
        print("HATA: all_matches.json beklenen formatta değil. Liste olması gerekiyordu.")
        return

    rows = []
    seen_ids = set()
    duplicate_ids = set()

    ok_count = 0
    failed_count = 0
    missing_summary_count = 0
    missing_opta_count = 0
    missing_details_count = 0

    for item in data:
        if not isinstance(item, dict):
            continue

        match_id = first_existing(item, ["match_id", "source_match_id", "id"])
        home_team = first_existing(item, ["home_team", "home_team_name"])
        away_team = first_existing(item, ["away_team", "away_team_name"])
        overall_status = first_existing(item, ["overall_status", "status", "general_status"])

        summary_value = first_existing(
            item,
            ["match_summary", "summary", "summary_sections", "summary_data"]
        )
        opta_value = first_existing(
            item,
            ["opta_points_stats", "opta_points", "opta_points_sections", "opta_stats"]
        )
        details_value = first_existing(
            item,
            ["match_details", "details", "match_details_sections", "details_data"]
        )

        summary_present = is_nonempty(summary_value)
        opta_present = is_nonempty(opta_value)
        details_present = is_nonempty(details_value)

        if match_id in seen_ids:
            duplicate_ids.add(match_id)
        else:
            seen_ids.add(match_id)

        if overall_status == "ok":
            ok_count += 1
        else:
            failed_count += 1

        if not summary_present:
            missing_summary_count += 1
        if not opta_present:
            missing_opta_count += 1
        if not details_present:
            missing_details_count += 1

        problem = (
            overall_status != "ok"
            or not summary_present
            or not opta_present
            or not details_present
        )

        rows.append({
            "match_id": to_text(match_id),
            "home_team": to_text(home_team),
            "away_team": to_text(away_team),
            "overall_status": to_text(overall_status),
            "summary_present": summary_present,
            "opta_points_present": opta_present,
            "match_details_present": details_present,
            "problem": problem,
        })

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = AUDIT_DIR / f"all_matches_quick_check_{timestamp}.csv"

    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "match_id",
                "home_team",
                "away_team",
                "overall_status",
                "summary_present",
                "opta_points_present",
                "match_details_present",
                "problem",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    problem_rows = [r for r in rows if r["problem"]]

    print("=" * 60)
    print("ALL_MATCHES.JSON HIZLI KONTROL")
    print("=" * 60)
    print(f"Toplam maç                : {len(rows)}")
    print(f"overall_status = ok       : {ok_count}")
    print(f"overall_status != ok      : {failed_count}")
    print(f"Summary eksik             : {missing_summary_count}")
    print(f"Opta Points eksik         : {missing_opta_count}")
    print(f"Match Details eksik       : {missing_details_count}")
    print(f"Duplicate match_id        : {len(duplicate_ids)}")
    print(f"Problemli maç sayısı      : {len(problem_rows)}")
    print(f"CSV rapor                 : {csv_path}")
    print("=" * 60)

    if problem_rows:
        print("İLK 20 PROBLEMLİ MAÇ:")
        for row in problem_rows[:20]:
            print(
                f"- {row['match_id']} | "
                f"status={row['overall_status']} | "
                f"summary={row['summary_present']} | "
                f"opta={row['opta_points_present']} | "
                f"details={row['match_details_present']} | "
                f"{row['home_team']} - {row['away_team']}"
            )
    else:
        print("Problemli maç yok. JSON temiz görünüyor.")


if __name__ == "__main__":
    main()
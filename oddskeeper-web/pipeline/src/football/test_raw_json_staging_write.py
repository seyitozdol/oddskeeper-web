import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALL_MATCHES_PATH = PROJECT_ROOT / "data" / "raw" / "opta_unified_matches" / "all_matches.json"


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"{name} bulunamadı. .env dosyanı kontrol et.")
    return value


def load_first_usable_match():
    if not ALL_MATCHES_PATH.exists():
        raise FileNotFoundError(f"Dosya bulunamadı: {ALL_MATCHES_PATH}")

    with open(ALL_MATCHES_PATH, "r", encoding="utf-8") as f:
        matches = json.load(f)

    if not isinstance(matches, list) or not matches:
        raise ValueError("all_matches.json boş veya beklenen formatta değil.")

    for match in matches:
        normalized = match.get("normalized_urls", {})
        source_match_id = normalized.get("source_match_id")

        if not source_match_id:
            continue

        return match

    raise ValueError("Yazılabilecek uygun maç kaydı bulunamadı.")


def build_staging_row(match: dict) -> dict:
    normalized = match.get("normalized_urls", {})

    return {
        "source": "opta",
        "source_match_id": normalized.get("source_match_id"),
        "source_season_slug": normalized.get("source_season_slug"),
        "input_url": match.get("input_url"),
        "match_summary_status": match.get("match_summary", {}).get("status"),
        "opta_points_status": match.get("opta_points_stats", {}).get("status"),
        "match_details_status": match.get("match_details", {}).get("status"),
        "payload": match,
    }


def upsert_staging_row(supabase_url: str, supabase_key: str, row: dict):
    url = f"{supabase_url}/rest/v1/match_json_staging"
    params = {
        "on_conflict": "source_match_id"
    }

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Accept-Profile": "raw",
        "Content-Profile": "raw",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    response = requests.post(
        url,
        params=params,
        headers=headers,
        json=row,
        timeout=30
    )

    print("Status code:", response.status_code)
    print("Response text:", response.text)

    response.raise_for_status()

    try:
        return response.json()
    except Exception:
        return None


def main():
    load_dotenv(PROJECT_ROOT / ".env")

    supabase_url = get_required_env("SUPABASE_URL")
    supabase_key = get_required_env("SUPABASE_SECRET_KEY")

    print(f".env bulundu: {PROJECT_ROOT / '.env'}")
    print("Staging raw write testi başlıyor...")

    match = load_first_usable_match()
    row = build_staging_row(match)

    print("Yazılacak source_match_id:", row["source_match_id"])
    print("Season slug:", row["source_season_slug"])
    print("Summary status:", row["match_summary_status"])
    print("Opta Points status:", row["opta_points_status"])
    print("Match Details status:", row["match_details_status"])

    result = upsert_staging_row(supabase_url, supabase_key, row)

    print("\nYazma testi başarılı.")
    print("Dönen kayıt:", result)


if __name__ == "__main__":
    main()
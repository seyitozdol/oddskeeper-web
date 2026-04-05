import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase_url = os.getenv("SUPABASE_URL")
supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY")

supabase: Client | None = None

if supabase_url and supabase_secret_key:
    supabase = create_client(supabase_url, supabase_secret_key)


@app.get("/")
def root():
    return {"message": "Odds Keeper API çalışıyor"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/supabase-test")
def supabase_test():
    return {
        "env_file_exists": env_path.exists(),
        "env_file_path": str(env_path),
        "supabase_url_var": bool(supabase_url),
        "supabase_secret_key_var": bool(supabase_secret_key),
        "client_created": supabase is not None,
    }


@app.get("/staging-preview")
def staging_preview():
    if supabase is None:
        return {"ok": False, "error": "Supabase client oluşmadı"}

    try:
        response = (
            supabase
            .schema("raw")
            .table("match_json_staging")
            .select("id, source, source_match_id, created_at, payload")
            .limit(3)
            .execute()
        )

        rows = response.data if hasattr(response, "data") else []

        preview_rows = []

        for row in rows:
            payload = row.get("payload") or {}
            match_details = payload.get("match_details") or {}
            match_info = match_details.get("match_info") or {}

            home_team = (match_info.get("home_team") or {}).get("name")
            away_team = (match_info.get("away_team") or {}).get("name")
            home_score = (match_info.get("home_team") or {}).get("score")
            away_score = (match_info.get("away_team") or {}).get("score")
            referee = match_info.get("referee")
            venue = match_info.get("venue")

            preview_rows.append({
                "id": row.get("id"),
                "source": row.get("source"),
                "source_match_id": row.get("source_match_id"),
                "created_at": row.get("created_at"),
                "home_team": home_team,
                "away_team": away_team,
                "score": f"{home_score}-{away_score}" if home_score is not None and away_score is not None else None,
                "referee": referee,
                "venue": venue,
            })

        return {
            "ok": True,
            "row_count": len(preview_rows),
            "rows": preview_rows,
        }

    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
        }
@app.get("/staging-match/{match_id}")
def staging_match_detail(match_id: int):
    if supabase is None:
        return {"ok": False, "error": "Supabase client oluşmadı"}

    try:
        response = (
            supabase
            .schema("raw")
            .table("match_json_staging")
            .select("*")
            .eq("id", match_id)
            .limit(1)
            .execute()
        )

        rows = response.data if hasattr(response, "data") else []

        if not rows:
            return {
                "ok": False,
                "error": "Maç bulunamadı",
            }

        row = rows[0]
        payload = row.get("payload") or {}
        match_details = payload.get("match_details") or {}
        match_info = match_details.get("match_info") or {}
        match_summary = payload.get("match_summary") or {}
        opta_points_stats = payload.get("opta_points_stats") or {}

        home_team_data = match_info.get("home_team") or {}
        away_team_data = match_info.get("away_team") or {}

        home_team = home_team_data.get("name")
        away_team = away_team_data.get("name")
        home_score = home_team_data.get("score")
        away_score = away_team_data.get("score")

        details_sections = match_details.get("details_sections") or []
        player_stats_sections = match_summary.get("player_stats_sections") or []

        result = {
            "id": row.get("id"),
            "source": row.get("source"),
            "source_match_id": row.get("source_match_id"),
            "created_at": row.get("created_at"),

            "match_summary_status": row.get("match_summary_status"),
            "opta_points_status": row.get("opta_points_status"),
            "match_details_status": row.get("match_details_status"),

            "overall_status": payload.get("overall_status"),
            "match_details_page_status": match_details.get("page_status"),
            "match_summary_page_status": match_summary.get("page_status"),

            "home_team": home_team,
            "away_team": away_team,
            "home_team_id": home_team_data.get("source_team_id"),
            "away_team_id": away_team_data.get("source_team_id"),
            "score": f"{home_score}-{away_score}" if home_score is not None and away_score is not None else None,

            "referee": match_info.get("referee"),
            "venue": match_info.get("venue"),
            "competition": match_info.get("competition"),
            "match_date_text": match_info.get("match_date_text"),
            "attendance_text": match_info.get("attendance_text"),
            "match_url": match_info.get("match_url"),

            "winner_side": match_info.get("winner_side"),
            "winner_team_source_id": match_info.get("winner_team_source_id"),

            "details_sections_count": len(details_sections) if isinstance(details_sections, list) else 0,
            "player_stats_sections_count": len(player_stats_sections) if isinstance(player_stats_sections, list) else 0,
            "opta_points_stats_keys": list(opta_points_stats.keys()) if isinstance(opta_points_stats, dict) else [],
        }

        return {
            "ok": True,
            "match": result,
        }

    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
        }
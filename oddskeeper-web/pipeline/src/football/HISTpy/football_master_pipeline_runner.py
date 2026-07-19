import json
import logging
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

# ========================
# CONFIG
# ========================
BASE_DIR = Path(r"C:\Users\zygom\PycharmProjects\oddskeeper")
SRC_DIR = BASE_DIR / "src" / "football"
LOG_DIR = BASE_DIR / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

PIPELINE_NAME = "football_master_pipeline"
PIPELINE_VERSION = "v1"
SOURCE_NAME = "opta"
BATCH_LABEL = "manual_batch"
INPUT_PATH = str(BASE_DIR / "data" / "raw" / "opta_unified_matches" / "all_matches.json")

# Parse step mevcut haliyle interaktif olabilir. O yüzden default kapalı.
ENABLE_PARSE = False
ENABLE_DB_RUN_LOG = True
CONTINUE_ON_NONCRITICAL_STEP_FAILURE = False

STEPS = [
    {
        "name": "parse",
        "script": "parse_backup2_integrated_v5.py",
        "enabled": ENABLE_PARSE,
        "critical": True,
    },
    {
        "name": "staging_bulk_write",
        "script": "bulk_write_match_json_staging_v2.py",
        "enabled": True,
        "critical": True,
    },
    {
        "name": "staging_audit",
        "script": "audit_match_json_staging_v2.py",
        "enabled": True,
        "critical": True,
    },
    {
        "name": "load_matches",
        "script": "load_staging_to_football_matches.py",
        "enabled": True,
        "critical": True,
    },
    {
        "name": "load_match_incidents",
        "script": "load_staging_to_football_match_incidents.py",
        "enabled": True,
        "critical": True,
    },
    {
        "name": "load_player_stats_opta_points",
        "script": "load_staging_to_football_match_player_stats_opta_points.py",
        "enabled": True,
        "critical": True,
    },
    {
        "name": "load_player_stats_details",
        "script": "load_staging_to_football_match_player_stats_details.py",
        "enabled": True,
        "critical": True,
    },
    {
        "name": "load_team_stats",
        "script": "load_staging_to_football_match_team_stats.py",
        "enabled": True,
        "critical": True,
    },
]


# ========================
# LOGGING
# ========================
def setup_logging() -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = LOG_DIR / f"{PIPELINE_NAME}_{ts}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return log_path


# ========================
# MODELS
# ========================
@dataclass
class StepResult:
    step_name: str
    script_path: str
    enabled: bool
    critical: bool
    status: str
    returncode: Optional[int]
    started_at: str
    finished_at: str
    duration_seconds: float
    summary: Dict[str, Any]
    stdout_tail: str
    stderr_tail: str
    error_message: Optional[str] = None


# ========================
# HELPERS
# ========================
def load_environment() -> None:
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logging.info(f".env bulundu: {env_path}")
    else:
        logging.warning(f".env bulunamadı: {env_path}")


def tail_text(text: str, max_chars: int = 4000) -> str:
    if not text:
        return ""
    text = text.strip()
    return text[-max_chars:]


def parse_summary_from_output(output_text: str) -> Dict[str, Any]:
    summary: Dict[str, Any] = {}
    patterns = {
        "Toplam": r"Toplam\s*:\s*(\d+)",
        "Inserted": r"Inserted\s*:\s*(\d+)",
        "Updated": r"Updated\s*:\s*(\d+)",
        "Skipped": r"Skipped\s*:\s*(\d+)",
        "Failed": r"Failed\s*:\s*(\d+)",
        "IssueOlanMac": r"Issue olan maç\s*:\s*(\d+)",
        "WarningOlanMac": r"Warning olan maç\s*:\s*(\d+)",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, output_text)
        if match:
            summary[key] = int(match.group(1))
    return summary


# ========================
# DB CLIENT FOR etl.load_runs
# ========================
class EtlRunsClient:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.api_key = (
            os.getenv("SUPABASE_SECRET_KEY")
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_KEY")
            or ""
        )
        self.enabled = bool(self.base_url and self.api_key)
        if not self.enabled:
            logging.warning("ETL run DB log devre dışı: Supabase env eksik.")

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
            "Accept-Profile": "etl",
            "Content-Profile": "etl",
        }

    def _url(self) -> str:
        return f"{self.base_url}/rest/v1/load_runs"

    def create_run(self, payload: Dict[str, Any]) -> Optional[int]:
        if not self.enabled:
            return None
        response = requests.post(self._url(), headers=self._headers(), json=payload, timeout=60)
        if response.status_code not in (200, 201):
            logging.warning(f"ETL run create başarısız: HTTP {response.status_code} | {response.text}")
            return None
        data = response.json()
        if isinstance(data, list) and data:
            return data[0].get("id")
        return None

    def update_run(self, run_id: int, payload: Dict[str, Any]) -> bool:
        if not self.enabled or not run_id:
            return False
        params = {"id": f"eq.{run_id}"}
        response = requests.patch(self._url(), headers=self._headers(), params=params, json=payload, timeout=60)
        if response.status_code not in (200, 204):
            logging.warning(f"ETL run update başarısız: HTTP {response.status_code} | {response.text}")
            return False
        return True


# ========================
# RUNNER
# ========================
def run_step(step: Dict[str, Any]) -> StepResult:
    script_path = SRC_DIR / step["script"]
    started_at_dt = datetime.now()
    start_ts = time.perf_counter()

    if not step["enabled"]:
        finished_at_dt = datetime.now()
        return StepResult(
            step_name=step["name"],
            script_path=str(script_path),
            enabled=False,
            critical=step["critical"],
            status="skipped",
            returncode=None,
            started_at=started_at_dt.isoformat(timespec="seconds"),
            finished_at=finished_at_dt.isoformat(timespec="seconds"),
            duration_seconds=0.0,
            summary={},
            stdout_tail="",
            stderr_tail="",
            error_message=None,
        )

    if not script_path.exists():
        finished_at_dt = datetime.now()
        return StepResult(
            step_name=step["name"],
            script_path=str(script_path),
            enabled=True,
            critical=step["critical"],
            status="failed",
            returncode=-1,
            started_at=started_at_dt.isoformat(timespec="seconds"),
            finished_at=finished_at_dt.isoformat(timespec="seconds"),
            duration_seconds=0.0,
            summary={},
            stdout_tail="",
            stderr_tail="",
            error_message=f"Script bulunamadı: {script_path}",
        )

    logging.info(f"STEP başladı: {step['name']} | script={script_path.name}")
    proc = subprocess.run(
        [sys.executable, str(script_path)],
        capture_output=True,
        text=True,
        cwd=str(SRC_DIR),
    )
    duration = round(time.perf_counter() - start_ts, 3)
    finished_at_dt = datetime.now()

    stdout_tail = tail_text(proc.stdout)
    stderr_tail = tail_text(proc.stderr)
    summary = parse_summary_from_output((proc.stdout or "") + "\n" + (proc.stderr or ""))

    status = "success" if proc.returncode == 0 else "failed"
    error_message = None if proc.returncode == 0 else f"returncode={proc.returncode}"

    if proc.stdout:
        logging.info(f"STEP stdout tail ({step['name']}):\n{stdout_tail}")
    if proc.stderr:
        logging.warning(f"STEP stderr tail ({step['name']}):\n{stderr_tail}")

    logging.info(
        f"STEP bitti: {step['name']} | status={status} | returncode={proc.returncode} | duration={duration}s"
    )

    return StepResult(
        step_name=step["name"],
        script_path=str(script_path),
        enabled=True,
        critical=step["critical"],
        status=status,
        returncode=proc.returncode,
        started_at=started_at_dt.isoformat(timespec="seconds"),
        finished_at=finished_at_dt.isoformat(timespec="seconds"),
        duration_seconds=duration,
        summary=summary,
        stdout_tail=stdout_tail,
        stderr_tail=stderr_tail,
        error_message=error_message,
    )


def build_run_summary(step_results: List[StepResult]) -> Dict[str, Any]:
    return {
        "steps": [asdict(s) for s in step_results],
    }


def decide_final_status(step_results: List[StepResult]) -> str:
    enabled_steps = [s for s in step_results if s.enabled]
    failed_critical = [s for s in enabled_steps if s.status == "failed" and s.critical]
    failed_noncritical = [s for s in enabled_steps if s.status == "failed" and not s.critical]
    skipped_steps = [s for s in step_results if s.status == "skipped"]

    if failed_critical:
        return "failed"
    if failed_noncritical or skipped_steps:
        return "partial"
    return "success"


def main() -> None:
    log_path = setup_logging()
    logging.info("Master pipeline başladı...")
    logging.info(f"Log dosyası: {log_path}")
    load_environment()

    etl_client = EtlRunsClient()
    enabled_steps = [s for s in STEPS if s["enabled"]]

    initial_payload = {
        "pipeline_name": PIPELINE_NAME,
        "pipeline_version": PIPELINE_VERSION,
        "source": SOURCE_NAME,
        "batch_label": BATCH_LABEL,
        "input_path": INPUT_PATH,
        "parse_enabled": ENABLE_PARSE,
        "status": "running",
        "total_steps": len(enabled_steps),
        "completed_steps": 0,
        "failed_steps": 0,
        "run_summary": {"steps": []},
        "error_summary": None,
    }

    run_id: Optional[int] = None
    if ENABLE_DB_RUN_LOG:
        run_id = etl_client.create_run(initial_payload)
        if run_id:
            logging.info(f"ETL run oluşturuldu | run_id={run_id}")
        else:
            logging.warning("ETL run DB kaydı oluşturulamadı. Pipeline devam edecek.")

    step_results: List[StepResult] = []

    for step in STEPS:
        result = run_step(step)
        step_results.append(result)

        completed_steps = sum(1 for s in step_results if s.status == "success")
        failed_steps = sum(1 for s in step_results if s.status == "failed")

        if run_id:
            etl_client.update_run(
                run_id,
                {
                    "completed_steps": completed_steps,
                    "failed_steps": failed_steps,
                    "run_summary": build_run_summary(step_results),
                },
            )

        if result.status == "failed" and result.critical and not CONTINUE_ON_NONCRITICAL_STEP_FAILURE:
            logging.error(f"Kritik step fail oldu, pipeline durduruluyor: {result.step_name}")
            break

    final_status = decide_final_status(step_results)
    completed_steps = sum(1 for s in step_results if s.status == "success")
    failed_steps = sum(1 for s in step_results if s.status == "failed")
    error_messages = [f"{s.step_name}: {s.error_message}" for s in step_results if s.error_message]

    if run_id:
        etl_client.update_run(
            run_id,
            {
                "status": final_status,
                "completed_steps": completed_steps,
                "failed_steps": failed_steps,
                "finished_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "run_summary": build_run_summary(step_results),
                "error_summary": " | ".join(error_messages) if error_messages else None,
            },
        )

    logging.info("=" * 60)
    logging.info("MASTER PIPELINE ÖZETİ")
    logging.info(f"Pipeline : {PIPELINE_NAME}")
    logging.info(f"Version  : {PIPELINE_VERSION}")
    logging.info(f"Status   : {final_status}")
    logging.info(f"Run ID   : {run_id}")
    logging.info(f"Enabled  : {len(enabled_steps)}")
    logging.info(f"Success  : {completed_steps}")
    logging.info(f"Failed   : {failed_steps}")
    logging.info("=" * 60)

    if final_status == "failed":
        sys.exit(1)


if __name__ == "__main__":
    main()

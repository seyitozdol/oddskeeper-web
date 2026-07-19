from __future__ import annotations

import argparse
import logging
import subprocess
import sys
from pathlib import Path

LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)


def run_step(name: str, cmd: list[str], workdir: Path) -> int:
    logging.info("STEP başladı: %s", name)
    logging.info("CMD: %s", " ".join(cmd))
    completed = subprocess.run(cmd, cwd=str(workdir))
    logging.info("STEP bitti: %s | returncode=%s", name, completed.returncode)
    return completed.returncode


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="V4 phase1: batch materialize + batch staging write")
    parser.add_argument("--csv-path", required=True, help="Bu batch için kullanılan CSV yolu")
    parser.add_argument("--batch-label", required=True, help="Örn: 2026-04-12_week31")
    parser.add_argument(
        "--all-matches-path",
        default="data/raw/opta_unified_matches/all_matches.json",
        help="parse sonrası oluşan all_matches.json yolu",
    )
    return parser


def main() -> None:
    setup_logging()
    args = build_arg_parser().parse_args()
    workdir = Path.cwd()

    materialize_script = workdir / "src" / "football" / "materialize_batch_from_all_matches_v1.py"
    bulk_script = workdir / "src" / "football" / "bulk_write_match_json_staging_batch_v1.py"

    if not materialize_script.exists():
        raise FileNotFoundError(f"Script bulunamadı: {materialize_script}")
    if not bulk_script.exists():
        raise FileNotFoundError(f"Script bulunamadı: {bulk_script}")

    batch_dir = workdir / "data" / "raw" / "opta_batches" / args.batch_label
    batch_json = batch_dir / "batch_matches.json"

    rc1 = run_step(
        "materialize_batch",
        [
            sys.executable,
            str(materialize_script),
            "--csv-path", args.csv_path,
            "--batch-label", args.batch_label,
            "--all-matches-path", args.all_matches_path,
        ],
        workdir,
    )
    if rc1 != 0:
        raise SystemExit(rc1)

    rc2 = run_step(
        "staging_bulk_write_batch",
        [
            sys.executable,
            str(bulk_script),
            "--batch-json", str(batch_json),
        ],
        workdir,
    )
    raise SystemExit(rc2)


if __name__ == "__main__":
    main()

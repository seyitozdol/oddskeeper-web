from __future__ import annotations

import argparse
import csv
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

LOG_FORMAT = "%(asctime)s | %(levelname)s | %(message)s"
MATCH_ID_PATTERN = re.compile(r"/([a-z0-9]{20,})/(?:opta-player-stats|match-summary|match-details|fixtures)?", re.IGNORECASE)


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)


def project_root() -> Path:
    return Path(__file__).resolve().parents[0]


class BatchMaterializer:
    def __init__(
        self,
        csv_path: Path,
        all_matches_path: Path,
        output_root: Path,
        batch_label: str,
        source_name: str = "opta",
    ) -> None:
        self.csv_path = csv_path
        self.all_matches_path = all_matches_path
        self.output_root = output_root
        self.batch_label = batch_label
        self.source_name = source_name
        self.batch_dir = self.output_root / self.batch_label
        self.single_matches_dir = self.batch_dir / "single_matches"

    def run(self) -> None:
        match_ids = self._load_match_ids_from_csv()
        all_matches = self._load_all_matches()
        filtered = self._filter_matches(all_matches, match_ids)
        self._write_outputs(match_ids, filtered)
        logging.info("============================================================")
        logging.info("BATCH MATERIALIZE ÖZETİ")
        logging.info("CSV maç id sayısı      : %s", len(match_ids))
        logging.info("JSON eşleşen maç sayısı: %s", len(filtered))
        logging.info("Batch klasörü          : %s", self.batch_dir)
        logging.info("============================================================")

    def _load_match_ids_from_csv(self) -> list[str]:
        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV bulunamadı: {self.csv_path}")

        with self.csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise ValueError("CSV başlıkları okunamadı.")

            ids: list[str] = []
            seen: set[str] = set()
            for row in reader:
                match_id = self._extract_match_id_from_row(row)
                if not match_id:
                    continue
                if match_id in seen:
                    continue
                seen.add(match_id)
                ids.append(match_id)

        if not ids:
            raise ValueError("CSV içinden hiç match_id çıkarılamadı.")

        logging.info("CSV bulundu: %s", self.csv_path)
        logging.info("CSV içinden çıkarılan unique maç sayısı: %s", len(ids))
        return ids

    def _extract_match_id_from_row(self, row: dict[str, str]) -> str | None:
        candidate_columns = [
            "source_match_id",
            "match_id",
            "id",
            "url",
            "match_url",
            "stats_url",
            "link",
        ]
        for col in candidate_columns:
            raw = (row.get(col) or "").strip()
            if not raw:
                continue
            extracted = self._extract_match_id(raw)
            if extracted:
                return extracted

        for raw in row.values():
            value = (raw or "").strip()
            if not value:
                continue
            extracted = self._extract_match_id(value)
            if extracted:
                return extracted
        return None

    def _extract_match_id(self, raw: str) -> str | None:
        value = raw.strip().strip('"').strip("'")
        if not value:
            return None
        if re.fullmatch(r"[a-z0-9]{20,}", value, flags=re.IGNORECASE):
            return value
        m = MATCH_ID_PATTERN.search(value)
        if m:
            return m.group(1)
        return None

    def _load_all_matches(self) -> list[dict[str, Any]]:
        if not self.all_matches_path.exists():
            raise FileNotFoundError(f"all_matches.json bulunamadı: {self.all_matches_path}")
        with self.all_matches_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("all_matches.json beklenen formatta değil; liste olmalı.")
        logging.info("all_matches.json bulundu: %s", self.all_matches_path)
        logging.info("all_matches içindeki kayıt sayısı: %s", len(data))
        return data

    def _filter_matches(self, all_matches: list[dict[str, Any]], match_ids: list[str]) -> list[dict[str, Any]]:
        wanted = set(match_ids)
        filtered: list[dict[str, Any]] = []
        found: set[str] = set()

        for item in all_matches:
            if not isinstance(item, dict):
                continue
            match_id = self._get_match_id(item)
            if not match_id:
                continue
            if match_id not in wanted:
                continue
            filtered.append(item)
            found.add(match_id)

        missing = [mid for mid in match_ids if mid not in found]
        if missing:
            logging.warning("CSV'de olup all_matches.json içinde bulunamayan maç sayısı: %s", len(missing))
            for mid in missing[:20]:
                logging.warning("Eksik match_id: %s", mid)
        return filtered

    def _get_match_id(self, item: dict[str, Any]) -> str | None:
        for key in ("source_match_id", "match_id", "id"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _write_outputs(self, match_ids: list[str], filtered: list[dict[str, Any]]) -> None:
        self.single_matches_dir.mkdir(parents=True, exist_ok=True)

        batch_matches_path = self.batch_dir / "batch_matches.json"
        batch_match_ids_path = self.batch_dir / "batch_match_ids.txt"
        manifest_path = self.batch_dir / "batch_manifest.json"

        with batch_matches_path.open("w", encoding="utf-8") as f:
            json.dump(filtered, f, ensure_ascii=False, indent=2)

        with batch_match_ids_path.open("w", encoding="utf-8") as f:
            for match_id in match_ids:
                f.write(f"{match_id}\n")

        for item in filtered:
            match_id = self._get_match_id(item)
            if not match_id:
                continue
            single_path = self.single_matches_dir / f"{match_id}.json"
            with single_path.open("w", encoding="utf-8") as f:
                json.dump(item, f, ensure_ascii=False, indent=2)

        manifest = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "batch_label": self.batch_label,
            "source": self.source_name,
            "csv_path": str(self.csv_path),
            "all_matches_path": str(self.all_matches_path),
            "csv_match_count": len(match_ids),
            "json_match_count": len(filtered),
            "missing_match_count": max(0, len(match_ids) - len(filtered)),
            "batch_matches_path": str(batch_matches_path),
            "batch_match_ids_path": str(batch_match_ids_path),
            "single_matches_dir": str(self.single_matches_dir),
        }
        with manifest_path.open("w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        logging.info("batch_matches.json yazıldı : %s", batch_matches_path)
        logging.info("batch_match_ids.txt yazıldı: %s", batch_match_ids_path)
        logging.info("batch_manifest.json yazıldı: %s", manifest_path)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="all_matches.json içinden batch klasörü üretir.")
    parser.add_argument("--csv-path", required=True, help="Yeni batch için kullanılan CSV yolu")
    parser.add_argument("--batch-label", required=True, help="Örn: 2026-04-12_week31")
    parser.add_argument(
        "--all-matches-path",
        default=str(Path("data/raw/opta_unified_matches/all_matches.json")),
        help="Kaynak all_matches.json yolu",
    )
    parser.add_argument(
        "--output-root",
        default=str(Path("data/raw/opta_batches")),
        help="Batch klasörlerinin ana dizini",
    )
    return parser


def main() -> None:
    setup_logging()
    parser = build_arg_parser()
    args = parser.parse_args()

    root = Path.cwd()
    csv_path = (root / args.csv_path).resolve() if not Path(args.csv_path).is_absolute() else Path(args.csv_path)
    all_matches_path = (
        (root / args.all_matches_path).resolve()
        if not Path(args.all_matches_path).is_absolute()
        else Path(args.all_matches_path)
    )
    output_root = (
        (root / args.output_root).resolve()
        if not Path(args.output_root).is_absolute()
        else Path(args.output_root)
    )

    materializer = BatchMaterializer(
        csv_path=csv_path,
        all_matches_path=all_matches_path,
        output_root=output_root,
        batch_label=args.batch_label,
    )
    materializer.run()


if __name__ == "__main__":
    main()

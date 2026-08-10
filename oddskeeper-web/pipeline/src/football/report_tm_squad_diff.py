# -*- coding: utf-8 -*-
"""Transfermarkt kadrolari ile bizim kadrolari KIYASLAR (rapor, DB'ye yazmaz).

Amac: API-Football kadro guncellemeleri gecikir (or. Salah), Transfermarkt
transferi saatler icinde isler. TM'de olup bizde OLMAYAN oyuncular = eksik
transfer listesi; bizde olup TM'de olmayanlar = muhtemel ayrilanlar.

fetch_transfermarkt_values.py'nin TM cekme/eslestirme yardimcilarini kullanir.
Cikti stdout: takim basina iki liste + ozet. Cron loguna eklenebilir.

Kullanim: python report_tm_squad_diff.py [--min-value-k N]
  --min-value-k: TM degeri bu esigin (bin EUR) altindaki eksikleri gizle
                 (genc/altyapi gurultusunu keser; varsayilan 0 = hepsi).
"""
from __future__ import annotations

import os
import re
import sys

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_transfermarkt_values import (  # noqa: E402
    BASE, LEAGUE_URL, fetch, norm, parse_squad, _name_match, _our_name_variants,
)

STOPWORDS = {
    "fk", "sk", "as", "jk", "spor", "kulubu", "istanbul", "ankara",
    "buyuksehir", "belediye", "belediyesi", "genclik",
}


def main() -> None:
    min_value = 0
    for i, a in enumerate(sys.argv):
        if a == "--min-value-k" and i + 1 < len(sys.argv):
            min_value = int(sys.argv[i + 1]) * 1000

    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    league_html = fetch(LEAGUE_URL)
    club_links = re.findall(
        r'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/(\d+)"', league_html
    )
    clubs: dict[str, str] = {}
    for tm_slug, tm_id, _season in club_links:
        clubs.setdefault(tm_id, tm_slug)

    cur.execute(
        """
        select distinct tm.team_slug, tm.display_name
        from ref.team_mapping tm
        join football.team_squad_current s on s.source_team_id = tm.source_team_id
        where tm.is_active
        """
    )
    our_teams = cur.fetchall()

    def match_team(tm_slug: str):
        tm_tokens = set(norm(tm_slug.replace("-", " ")).split()) - STOPWORDS
        best, best_score = None, 0
        for team_slug, display_name in our_teams:
            tokens = (
                set(norm(display_name).split()) | set(norm(team_slug).split("-"))
            ) - STOPWORDS
            score = len(tm_tokens & tokens)
            if score > best_score:
                best, best_score = team_slug, score
        return best if best_score > 0 else None

    total_missing = total_gone = 0
    missing_all: list[tuple[str, str, str]] = []
    for tm_id, tm_slug in clubs.items():
        team_slug = match_team(tm_slug)
        if not team_slug:
            print(f"UYARI: kulup eslenemedi: {tm_slug}")
            continue
        squad_url = f"{BASE}/{clubs[tm_id]}/kader/verein/{tm_id}/saison_id/2026/plus/1"
        players = parse_squad(fetch(squad_url))

        cur.execute(
            """
            select apifootball_player_id, player_slug, player_name,
                   coalesce(full_name, ''), coalesce(first_name, ''),
                   coalesce(last_name, ''), birth_date
            from analytics.player_current_info_v1
            where current_team_slug = %s
            """,
            (team_slug,),
        )
        ours = cur.fetchall()

        matched_our_ids: set = set()
        missing = []  # TM'de var, bizde yok
        for p in players:
            cands = [c for c in ours
                     if any(_name_match(p["name"], v) for v in _our_name_variants(c))]
            if p["birth"]:
                bc = [c for c in cands if c[6] == p["birth"]]
                if bc:
                    cands = bc
            if cands:
                matched_our_ids.add(cands[0][0])
            else:
                if p["value"] is not None and p["value"] < min_value:
                    continue
                val = f"€{p['value']/1e6:.1f}m" if p["value"] else "-"
                missing.append((p["name"], val))

        gone = [c[2] or c[3] for c in ours if c[0] not in matched_our_ids]

        if missing or gone:
            print(f"\n=== {team_slug} (TM {len(players)} / biz {len(ours)}) ===")
        if missing:
            print("  TM'DE VAR, BIZDE YOK (eksik transfer?):")
            for nm, val in missing:
                print(f"    + {nm}  {val}")
                missing_all.append((team_slug, nm, val))
        if gone:
            print("  BIZDE VAR, TM KADROSUNDA YOK (ayrilmis olabilir):")
            for nm in gone:
                print(f"    - {nm}")
        total_missing += len(missing)
        total_gone += len(gone)

    print(f"\nOZET: TM'de olup bizde olmayan {total_missing} oyuncu; "
          f"bizde olup TM'de olmayan {total_gone} oyuncu.")


if __name__ == "__main__":
    main()

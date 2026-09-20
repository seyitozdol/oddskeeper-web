"""BSL kadro denetimini yeniden kurar (futbol build_squad_audit.py'nin basketbol karşılığı).

Yalnız DB okur/yazar (dış istek YOK) → VPS'te her sabah ve her maç yüklemesinden sonra koşar.
Girdi: basketball.team_rosters (sezon kadromuz) + basketball.realgm_roster_snapshot (referans,
fetch_realgm_bsl_rosters.py yazar) + analytics.bb_pm_player_ids (participant id) + foto kaynakları.
Çıktı: basketball.squad_audit (sezon için baştan yazılır) → analytics.bb_squad_audit_v1 → sayfa
/dashboard/squad-audit?sport=basketball.

Eşleme kimlikle: players.realgm_player_id. Id'si olmayan kadro oyuncusu için yalnız TAM isim
(normalize token kümesi); fuzzy yok (ölçümde soyad-kademesi eşleşmelerin yarısı yanlıştı).

    python src/basketball/build_bsl_squad_audit.py [--season-label 2026-2027] [--dry-run]
"""
import argparse
import os
import sys
from collections import defaultdict

import psycopg2
from dotenv import load_dotenv

from identity import current_season_label, name_key

REALGM_MIN_ROSTER = 8      # RealGM bu kadar oyuncu listelemiyorsa o takımı kapsamıyor say
SOURCE_LABEL = {"realgm": "RealGM", "sofascore": "SofaScore", "flashscore": "FlashScore", "tbf": "TBF",
                "manual": "manual"}


def run(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    season = args.season_label or current_season_label()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute("""
        select ro.team_slug, coalesce(t.team_name, ro.team_slug), ro.player_slug, p.player_name,
               p.realgm_player_id, p.sofascore_player_id, ro.source, ro.confirmed,
               exists (select 1 from analytics.bb_pm_player_ids i
                       where i.league = 'basketball' and i.player_slug = ro.player_slug
                         and coalesce(i.external_id, '') <> '') as has_pid,
               exists (select 1 from euroleague.player_bsl_link l
                       join euroleague.players ep on ep.person_code = l.person_code
                       where l.bsl_player_slug = ro.player_slug and ep.image_url is not null) as has_euro_photo,
               exists (select 1 from basketball.player_match_stats s
                       where s.player_slug = ro.player_slug and s.season_label = ro.season_label
                         and s.team_slug = ro.team_slug) as played_here,
               (select (array_agg(s.team_name order by s.season_label desc, s.week desc nulls last))[1]
                  from basketball.player_match_stats s
                 where s.player_slug = ro.player_slug and s.team_slug <> ro.team_slug) as prev_team
        from basketball.team_rosters ro
        join basketball.players p on p.player_slug = ro.player_slug
        left join basketball.teams t on t.team_slug = ro.team_slug
        where ro.season_label = %s""", (season,))
    cols = ["team_slug", "team_name", "slug", "name", "realgm", "sofa", "source", "confirmed",
            "has_pid", "has_euro_photo", "played_here", "prev_team"]
    roster = [dict(zip(cols, r)) for r in cur.fetchall()]
    team_name = {r["team_slug"]: r["team_name"] for r in roster}

    cur.execute("""select team_slug, realgm_player_id, player_name, position, fetched_at
                   from basketball.realgm_roster_snapshot where season_label = %s""", (season,))
    ref = defaultdict(list)
    fetched_at = None
    for team, rid, name, pos, at in cur.fetchall():
        ref[team].append({"id": rid, "name": name, "pos": pos})
        fetched_at = max(fetched_at, at) if fetched_at else at
    cur.execute("select team_slug, team_name from basketball.teams")
    team_name = {**dict(cur.fetchall()), **team_name}

    out = []          # (section, team_slug, team_name, player_slug, player_name, detail)
    by_team = defaultdict(list)
    for r in roster:
        by_team[r["team_slug"]].append(r)

    for team in sorted(set(by_team) | set(ref)):
        ours, theirs = by_team.get(team, []), ref.get(team, [])
        covered = len(theirs) >= REALGM_MIN_ROSTER
        ref_ids = {x["id"] for x in theirs}
        ref_keys = {name_key(x["name"]) for x in theirs}
        our_ids = {r["realgm"] for r in ours if r["realgm"]}
        our_keys = {name_key(r["name"]) for r in ours}
        if covered:
            for r in ours:
                in_ref = (r["realgm"] in ref_ids) if r["realgm"] else (name_key(r["name"]) in ref_keys)
                if not in_ref and not r["played_here"]:
                    # dile bağımsız: üyeliğin kaynağı + (varsa) geldiği takım
                    why = SOURCE_LABEL.get(r["source"], r["source"])
                    if r["prev_team"]:
                        why += f" · ← {r['prev_team']}"
                    out.append(("ours_not_ref", team, team_name[team], r["slug"], r["name"], why))
        for x in theirs:                      # RealGM listeliyor, bizim o takım kadromuzda yok
            if x["id"] not in our_ids and name_key(x["name"]) not in our_keys:
                out.append(("ref_not_ours", team, team_name.get(team, team), None, x["name"], x["pos"]))

    for r in roster:
        if not r["has_pid"]:
            # bu sezon maça çıkmış oyuncu öncelikli (çizgi üretilecek oyuncu): GP işareti
            out.append(("no_participant_id", r["team_slug"], r["team_name"], r["slug"], r["name"],
                        "GP" if r["played_here"] else None))
        if not r["sofa"] and not r["has_euro_photo"]:
            out.append(("no_photo", r["team_slug"], r["team_name"], r["slug"], r["name"], None))

    counts = defaultdict(int)
    for row in out:
        counts[row[0]] += 1
    uncovered = sorted(team_name[t] for t in by_team if len(ref.get(t, [])) < REALGM_MIN_ROSTER)
    print(f"[bsl-audit] sezon {season} | kadro {len(roster)} | RealGM goruntusu {fetched_at} | "
          f"kapsanmayan takim: {uncovered}")
    print(f"[bsl-audit] {dict(counts)}")
    if args.dry_run:
        conn.close()
        return
    cur.execute("delete from basketball.squad_audit where season_label = %s", (season,))
    for section, team, tname, slug, name, detail in out:
        cur.execute("""insert into basketball.squad_audit
                           (section, season_label, team_slug, team_name, player_slug, player_name, detail, ref_fetched_at)
                       values (%s,%s,%s,%s,%s,%s,%s,%s)""", (section, season, team, tname, slug, name, detail, fetched_at))
    conn.commit()
    conn.close()
    print(f"[bsl-audit] yazildi: {len(out)} satir")


def main():
    ap = argparse.ArgumentParser(description="BSL kadro denetimi (DB-only)")
    ap.add_argument("--season-label", help="vars. guncel sezon")
    ap.add_argument("--dry-run", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()

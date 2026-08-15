# -*- coding: utf-8 -*-
"""Kadro denetim listelerini hesaplar ve football.squad_audit'a yazar.

Sitedeki herkese acik 3 sekmeli sayfanin (header, What's New yani) veri
kaynagi; sabah TM cron zincirinin (run_tsl_squad_refresh.sh) SON adimi olarak
kosulur (TM kadrolari + bizim kadrolar en guncel halinde olsun diye):

  ours_not_tm       : bizde olup Transfermarkt kadrosunda olmayanlar (tsl + tff1)
  tm_not_ours       : TM'de olup bizde olmayanlar (tsl + tff1)
  no_participant_id : PSM participant id'si (pm_player_ids.external_id) bos
                      olan oyuncular (futbol; tsl slug, tff1 sofascore id bazli)

TSL tarafi report_tm_squad_diff ile ayni eslestirmeyi kullanir; TFF1 tarafi
TM TR2 kadrolarini tff1 sezon kadrosuyla (sofascore_player_info dogum tarihli)
esler. Tablo her kosuda bastan yazilir (delete + insert, tek transaction).

Kullanim: python build_squad_audit.py
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
    "buyuksehir", "belediye", "belediyesi", "genclik", "sportif", "faaliyetler",
}

Row = tuple[str, str, str, str, str | None]  # section, league, team, player, detail


def _fmt_val(v: int | None) -> str | None:
    if not v:
        return None
    return f"€{v / 1e6:.1f}m" if v >= 1_000_000 else f"€{round(v / 1000)}k"


def _clubs_from_league(league_html: str) -> dict[str, str]:
    clubs: dict[str, str] = {}
    for tm_slug, tm_id, _s in re.findall(
        r'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/(\d+)"', league_html
    ):
        clubs.setdefault(tm_id, tm_slug)
    return clubs


def _match_team(tm_slug: str, our_teams: list[tuple[str, str]]) -> str | None:
    """TM kulup slug'i -> bizim takim anahtari (token kesisimi)."""
    tm_tokens = set(norm(tm_slug.replace("-", " ")).split()) - STOPWORDS
    best, best_score = None, 0
    for key, display in our_teams:
        tokens = (set(norm(display).split()) | set(norm(key).split("-"))) - STOPWORDS
        score = len(tm_tokens & tokens)
        if score > best_score:
            best, best_score = key, score
    return best if best_score > 0 else None


def audit_tsl(cur) -> list[Row]:
    rows: list[Row] = []
    clubs = _clubs_from_league(fetch(LEAGUE_URL))

    cur.execute(
        """select distinct tm.team_slug, tm.display_name
           from ref.team_mapping tm
           join football.team_squad_current s on s.source_team_id = tm.source_team_id
           where tm.is_active"""
    )
    our_teams = cur.fetchall()

    for tm_id, tm_slug in clubs.items():
        team_slug = _match_team(tm_slug, our_teams)
        if not team_slug:
            continue
        team_display = next((d for k, d in our_teams if k == team_slug), team_slug)
        players = parse_squad(fetch(f"{BASE}/{tm_slug}/kader/verein/{tm_id}/saison_id/2026/plus/1"))

        cur.execute(
            """select apifootball_player_id, player_slug, player_name,
                      coalesce(full_name, ''), coalesce(first_name, ''),
                      coalesce(last_name, ''), birth_date
               from analytics.player_current_info_v1
               where current_team_slug = %s""",
            (team_slug,),
        )
        ours = cur.fetchall()

        matched: set = set()
        for p in players:
            cands = [c for c in ours
                     if any(_name_match(p["name"], v) for v in _our_name_variants(c))]
            if not cands:
                # Ad-soyad sirasi ters yazilmis kayitlar (API-Football'da sik:
                # "Dorgeles Nene" -> "N. Dorgeles", "Thalisson" -> "Thalisson Kelven").
                # Ters sira + guclu token kesisimi; yoksa bu oyuncular zaten
                # kadromuzdayken "eksik" gorunuyordu.
                rev = " ".join(reversed(norm(p["name"]).split()))
                tt = {t for t in norm(p["name"]).split() if len(t) >= 4}
                cands = [c for c in ours
                         if any(_name_match(rev, v) for v in _our_name_variants(c))
                         or any(tt and len(tt & {t for t in norm(v).split() if len(t) >= 4})
                                >= min(2, len(tt)) for v in _our_name_variants(c))]
            if p["birth"]:
                bc = [c for c in cands if c[6] == p["birth"]]
                if bc:
                    cands = bc
            if cands:
                matched.add(cands[0][0])
            else:
                rows.append(("tm_not_ours", "tsl", team_display, p["name"], _fmt_val(p["value"])))
        for c in ours:
            if c[0] not in matched:
                rows.append(("ours_not_tm", "tsl", team_display, c[3] or c[2], None))
    return rows


def audit_tff1(cur) -> list[Row]:
    rows: list[Row] = []
    clubs = _clubs_from_league(fetch(f"{BASE}/1-lig/startseite/wettbewerb/TR2"))

    # Bizim TFF1 kadrosu: tff1_squad_v1 (TM uyeligi + oynayanlar). Onceden yalnizca
    # SEZON ISTATISTIGI olan oyunculara bakiliyordu; henuz mac oynamamis transferler
    # kadroda olmalarina ragmen "TM'de var bizde yok" listesinde cikiyordu.
    cur.execute("select max(season_label) from analytics.tff1_player_season_stats_v1")
    season = cur.fetchone()[0]
    cur.execute(
        """select s.player_id, coalesce(s.player_name, s.player_id), s.team_name,
                  coalesce(s.birth_date, i.birth_date)
           from analytics.tff1_squad_v1 s
           left join football.sofascore_player_info i
                  on i.sofascore_player_id = s.player_id
           where s.team_name is not null and s.membership_source = 'tm'
           union
           select p.player_id, coalesce(p.player_name, p.player_id), p.team_name,
                  i2.birth_date
           from analytics.tff1_player_season_stats_v1 p
           left join football.sofascore_player_info i2
                  on i2.sofascore_player_id = p.player_id
           where p.season_label = %s and p.team_name is not null""",
        (season,),
    )
    ours_all = cur.fetchall()
    teams = sorted({r[2] for r in ours_all})
    our_teams = [(t, t) for t in teams]

    by_team: dict[str, list] = {}
    for r in ours_all:
        by_team.setdefault(r[2], []).append(r)

    for tm_id, tm_slug in clubs.items():
        team_name = _match_team(tm_slug, our_teams)
        if not team_name:
            continue
        players = parse_squad(fetch(f"{BASE}/{tm_slug}/kader/verein/{tm_id}/saison_id/2026/plus/1"))
        ours = by_team.get(team_name, [])

        matched: set = set()
        for p in players:
            cands = [c for c in ours if _name_match(p["name"], c[1])
                     or _name_match(" ".join(reversed(norm(p["name"]).split())), c[1])]
            if p["birth"]:
                bc = [c for c in cands if c[3] == p["birth"]]
                if bc:
                    cands = bc
                elif not cands:
                    bc2 = [c for c in ours if c[3] == p["birth"]]
                    if len(bc2) == 1:
                        cands = bc2
            if cands:
                matched.add(cands[0][0])
            else:
                rows.append(("tm_not_ours", "tff1", team_name, p["name"], _fmt_val(p["value"])))
        for c in ours:
            if c[0] not in matched:
                rows.append(("ours_not_tm", "tff1", team_name, c[1], None))
    return rows


def audit_participant_ids(cur) -> list[Row]:
    rows: list[Row] = []
    # TSL: pm_player_ids slug bazli.
    cur.execute(
        """select i.current_team_name, coalesce(i.full_name, i.player_name)
           from analytics.player_current_info_v1 i
           where not exists (
             select 1 from analytics.pm_player_ids p
             where p.league = 'tsl' and p.player_slug = i.player_slug
               and coalesce(p.external_id, '') <> '')"""
    )
    for team, player in cur.fetchall():
        rows.append(("no_participant_id", "tsl", team or "?", player or "?", None))

    # TFF1: pm_player_ids player_slug = sofascore player_id.
    cur.execute("select max(season_label) from analytics.tff1_player_season_stats_v1")
    season = cur.fetchone()[0]
    cur.execute(
        """select s.team_name, coalesce(s.player_name, s.player_id)
           from analytics.tff1_player_season_stats_v1 s
           where s.season_label = %s and s.team_name is not null
             and not exists (
               select 1 from analytics.pm_player_ids p
               where p.league = 'tff1' and p.player_slug = s.player_id
                 and coalesce(p.external_id, '') <> '')""",
        (season,),
    )
    for team, player in cur.fetchall():
        rows.append(("no_participant_id", "tff1", team, player, None))
    return rows


def main() -> None:
    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    rows = audit_tsl(cur) + audit_tff1(cur) + audit_participant_ids(cur)

    counts: dict[str, int] = {}
    for r in rows:
        counts[r[0]] = counts.get(r[0], 0) + 1
    print("squad_audit:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))

    cur.execute("delete from football.squad_audit")
    cur.executemany(
        """insert into football.squad_audit (section, league, team_name, player_name, detail)
           values (%s, %s, %s, %s, %s)""",
        rows,
    )
    conn.commit()
    conn.close()
    print(f"yazildi: {len(rows)} satir")


if __name__ == "__main__":
    main()

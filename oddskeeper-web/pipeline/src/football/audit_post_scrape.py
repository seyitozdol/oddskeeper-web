# -*- coding: utf-8 -*-
"""Maç-sonrası scrape DENETIMI: belirli event id'ler için beslenen TUM tablolarda
aktarım hatası / null / eslesme (mapping) / yazim sorunu var mi tarar.

Kullanim:
  .venv\\Scripts\\python.exe src\\football\\audit_post_scrape.py 16483640 16483634 ...
  (arguman yoksa: bugun oynanmis ama scrape'i eksik/tam maclari otomatik bulur)

READ-ONLY (yalniz SELECT). Cikti: her mac icin PASS/ISSUE listesi + ozet.
"""

import os
import re
import sys
import io
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

TRACKED_TEAM_STATS = [
    "summary_shots", "summary_shots_on_target", "summary_corners_won",
    "summary_fouls_conceded", "summary_offsides", "summary_saves",
    "summary_tackles", "details_goal_kicks", "details_total_throws",
]
# Mojibake (encoding bozulmasi) tespiti: SADECE gercek bozulma isaretleri —
# replacement char (U+FFFD) veya cift-encode dizileri (Ã.., Å¸, â€). Dogru Turkce/
# Lehce harfler (ş ı ğ ü ö ç ł ń) BURAYA GIRMEZ (yanlis-pozitif olmasin).
MOJIBAKE = re.compile("�|Ã.|Å¸|â€")


def league_of(cur, source_match_id):
    cur.execute("""select case when competition ilike '%%per Lig%%' then 'tsl'
                    when competition ilike '%%1. Lig%%' or competition ilike '%%1.Lig%%'
                         or competition ilike '%%irinci Lig%%' then 'tff1' else competition end,
                    season_label, competition
             from football.matches where source='sofascore' and source_match_id=%s limit 1""",
                (str(source_match_id),))
    r = cur.fetchone()
    return r if r else (None, None, None)


def audit_match(cur, eid):
    issues = []
    ok = []
    league, season, comp = league_of(cur, eid)
    if not league:
        return [f"[HIGH] football.matches'te YOK (metadata gelmemis)"], [], None, None
    season_msm = (season or "").replace("/", "-")

    # 1) team_stats: 2 satir, null olmayan izlenen metrikler
    cur.execute(
        f"select team_side, team_name, source_team_id, score_for, score_against, "
        f"{', '.join(TRACKED_TEAM_STATS)} from football.match_team_stats "
        f"where source='sofascore' and source_match_id=%s",
        (str(eid),))
    trows = cur.fetchall()
    if len(trows) != 2:
        issues.append(f"[HIGH] team_stats satir sayisi {len(trows)} (2 olmali)")
    else:
        ok.append("team_stats 2 satir")
    for tr in trows:
        side, tname, stid, sf, sa = tr[0], tr[1], tr[2], tr[3], tr[4]
        stats = tr[5:]
        nulls = [TRACKED_TEAM_STATS[i] for i, v in enumerate(stats) if v is None]
        if nulls:
            issues.append(f"[MED] {tname} ({side}) null metrik: {', '.join(nulls)}")
        if sf is None or sa is None:
            issues.append(f"[HIGH] {tname} ({side}) skor null ({sf}-{sa})")
        if tname and MOJIBAKE.search(tname):
            issues.append(f"[MED] takim adi bozuk yazim: {tname!r}")
        # team mapping
        cur.execute("select team_slug from ref.team_mapping where source_team_id=%s", (str(stid),))
        m = cur.fetchone()
        if not m:
            issues.append(f"[HIGH] takim MAPLENMEMIS: {tname} (sofascore id {stid}) -> views'ten DUSER")
        else:
            ok.append(f"{tname}->{m[0]}")

    # 2) player_stats_details: sayi, null ad/dk, iki takim, mapping
    cur.execute("""select count(*), count(*) filter (where player_name is null),
        count(distinct source_team_id),
        count(*) filter (where (raw_stats->>'minutesPlayed') is null),
        count(*) filter (where coalesce((raw_stats->>'minutesPlayed')::int,0)>0)
        from football.match_player_stats_details where source='sofascore' and source_match_id=%s""",
                (str(eid),))
    pc, pnull, pteams, pminnull, pplayed = cur.fetchone()
    if pc == 0:
        issues.append("[HIGH] player_stats_details BOS (oyuncu verisi gelmemis)")
    else:
        ok.append(f"player rows={pc} (oynayan {pplayed})")
    if pc and pteams != 2:
        issues.append(f"[HIGH] player detayinda takim sayisi {pteams} (2 olmali; tek taraf gelmis)")
    if pnull:
        issues.append(f"[MED] {pnull} oyuncu adi NULL")
    # mojibake in player names
    cur.execute("""select player_name from football.match_player_stats_details
        where source='sofascore' and source_match_id=%s and player_name is not null""", (str(eid),))
    bad = [n[0] for n in cur.fetchall() if MOJIBAKE.search(n[0] or "")]
    if bad:
        issues.append(f"[MED] {len(bad)} oyuncu adinda bozuk yazim: {bad[:3]}")
    # player mapping / dusme kontrolu — LIGE OZGU (PSM/profil farkli besleniyor):
    #  TSL: sofascore->opta kopru gerekli (yoksa profil/PSM'den duser).
    #  1.Lig: oyuncu sofascore id ile dogrudan kimlik; tff1_player_match_log_v1'de
    #         gorunmeli (yoksa tff1 profil/PSM'den duser).
    if league == "tsl":
        cur.execute("""select count(*) filter (where pm.opta_player_id is null)
            from football.match_player_stats_details d
            left join ref.sofascore_opta_player_map pm on pm.sofascore_player_id=d.source_player_id
            where d.source='sofascore' and d.source_match_id=%s
              and coalesce((d.raw_stats->>'minutesPlayed')::int,0)>0""", (str(eid),))
        unmapped = cur.fetchone()[0]
        if unmapped:
            issues.append(f"[HIGH] {unmapped} oynayan oyuncu MAPLENMEMIS (sofascore->opta) -> profil/PSM'den DUSER")
        else:
            ok.append("tum oynayanlar opta'ya maple")
    elif league == "tff1":
        cur.execute("""select count(*) filter (where l.player_id is null)
            from football.match_player_stats_details d
            left join analytics.tff1_player_match_log_v1 l
              on l.match_id=d.source_match_id and l.player_id=d.source_player_id
            where d.source='sofascore' and d.source_match_id=%s
              and coalesce((d.raw_stats->>'minutesPlayed')::int,0)>0""", (str(eid),))
        missing = cur.fetchone()[0]
        if missing:
            issues.append(f"[HIGH] {missing} oynayan oyuncu tff1 mac logunda YOK -> 1.Lig profil/PSM'den DUSER")
        else:
            ok.append("tum oynayanlar tff1 logunda")

    # 3) downstream: msm_team_match_log bu maci gordu mu (iki takim)
    if league in ("tsl", "tff1"):
        cur.execute("""select count(distinct team_slug) from analytics.msm_team_match_log_v1
            where league=%s and season=%s and source_match_id=%s""", (league, season_msm, str(eid)))
        msm_teams = cur.fetchone()[0]
        if msm_teams < 2:
            issues.append(f"[HIGH] MSM mac logunda takim sayisi {msm_teams} (2 olmali) -> Teams/model bu maci gormuyor")
        else:
            ok.append("MSM logunda 2 takim")

    return issues, ok, league, comp


def find_todays_matches(cur):
    cur.execute("""select fixture_id from analytics.tsl_ss_fixtures_v1 where fixture_datetime < now()
        and fixture_datetime > now() - interval '18 hours'
      union select fixture_id from analytics.tff1_fixtures_v1 where fixture_datetime < now()
        and fixture_datetime > now() - interval '18 hours'""")
    return [str(r[0]) for r in cur.fetchall()]


def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    eids = [a for a in sys.argv[1:] if a.isdigit()]
    if not eids:
        eids = find_todays_matches(cur)
    print(f"=== POST-SCRAPE AUDIT @ {datetime.now(timezone.utc).isoformat()} | {len(eids)} mac ===")
    total_high = 0
    for eid in eids:
        issues, ok, league, comp = audit_match(cur, eid)
        highs = sum(1 for i in issues if i.startswith("[HIGH]"))
        total_high += highs
        tag = "OK" if not issues else ("FAIL" if highs else "WARN")
        print(f"\n[{tag}] event {eid} ({comp or '?'})")
        for i in issues:
            print("   ", i)
        if not issues:
            print("    tum kontroller PASS:", "; ".join(ok[:6]))
    print(f"\n=== SONUC: {len(eids)} mac, toplam HIGH sorun = {total_high} ===")
    cur.close()
    conn.close()
    return 1 if total_high else 0


if __name__ == "__main__":
    sys.exit(main())

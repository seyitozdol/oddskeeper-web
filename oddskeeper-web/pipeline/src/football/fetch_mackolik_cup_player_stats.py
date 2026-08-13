"""Kupa maclarindaki OYUNCU-BASI istatistigi Mackolik app endpoint'inden ceker
(Faz 5, opsiyon B). Kaynak: /statistics-service/match/{match_mid}/player/{player_mid}/stats
(match_mid = raw.match.mid, player_mid = lineup player.mid; ikisi de uuid-dash).

football.mackolik_player_match_stats (header) + football.mackolik_player_match_metrics (long).
Resumable: (match_uuid, player_id) zaten varsa atlar. Idempotent.

Kullanim:
    python src/football/fetch_mackolik_cup_player_stats.py            # tum eksik oyuncu-maclar
    python src/football/fetch_mackolik_cup_player_stats.py --limit 50 # test
"""
import os
import sys
import time
import argparse

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_mackolik_app as mk  # noqa: E402  (_get + token)

PIPELINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV = dotenv_values(os.path.join(PIPELINE_DIR, ".env"))

# Tekil metrik adlari -> kanonik anahtar.
SINGLE = {
    "Topla Buluşma": "touches", "Pas İsabeti (%)": "pass_accuracy_pct", "Kilit Pas": "key_passes",
    "Asist Beklentisi (xA)": "xa", "Gol Beklentisi (xG)": "xg", "RCS Top. Bul.": "touches_opp_box",
    "Kaçırdığı Gol Pozisyonu": "big_chances_missed", "Aldığı Faul": "fouls_won", "Ofsayt": "offsides",
    "İsabetli Şut Gol Beklentisi (xGOT)": "xgot", "Uzaklaştırma": "clearances", "Pas Arası": "interceptions",
    "Top Kapma": "tackles", "Engellediği Şut": "blocks", "Yaptığı Faul": "fouls",
    "Sahipsiz Top Kazanma": "recoveries", "Toplam Kurtarış": "saves",
}
# Cift metrikler ("a/b") -> (birinci_anahtar, ikinci_anahtar).
PAIR = {
    "Pas (İs/T)": ("accurate_pass", "passes_total"),
    "Uzun Pas (İs/T)": ("accurate_long", "long_balls"),
    "Orta (İs/T)": ("accurate_cross", "crosses"),
    "Şut (İs/T)": ("shots_on_target", "shots_total"),
    "Şut (CSİ/CSD)": ("shots_inbox", "shots_outbox"),
    "Çalım (Baş/T)": ("dribbles_won", "dribbles"),
    "İkili Mücadele (Baş/T)": ("duels_won", "duels"),
    "Hava Topu (Baş/T)": ("aerials_won", "aerials"),
}


def _num(s):
    if s is None:
        return None
    s = str(s).strip().replace("%", "").replace(",", ".")
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_stats(j):
    """{goals,assists,minutesPlayed,groups[]} -> {metric_key: value}."""
    out = {}
    out["goals_total"] = _num(j.get("goals"))
    out["assists_total"] = _num(j.get("assists"))
    out["minutes"] = _num(j.get("minutesPlayed"))
    for g in j.get("groups", []) or []:
        for st in g.get("stats", []) or []:
            name = st.get("name")
            val = st.get("value")
            if name in SINGLE:
                out[SINGLE[name]] = _num(val)
            elif name in PAIR:
                a, b = PAIR[name]
                parts = str(val).split("/")
                if len(parts) == 2:
                    out[a] = _num(parts[0])
                    out[b] = _num(parts[1])
    return {k: v for k, v in out.items() if v is not None}


def player_stats(match_mid, player_mid):
    r = mk._get(
        f"/statistics-service/match/{match_mid}/player/{player_mid}/stats",
        {"language": "tr", "country": "tr"},
    )
    if r.status_code != 200 or not r.content:
        return None
    return r.json()


def iter_lineup_players(raw, team_a_id, team_b_id):
    lu = raw.get("lineup") or {}
    for side, team_id in (("team_A", team_a_id), ("team_B", team_b_id)):
        for p in ((lu.get(side) or {}).get("players") or []):
            pl = p.get("player") or {}
            pid, pmid = pl.get("id"), pl.get("mid")
            if pid is not None and pmid:
                yield pid, pl.get("uuid"), pmid, team_id


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="test: ilk N maç")
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()

    conn = psycopg2.connect(ENV["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        "select match_uuid, team_a_id, team_b_id, raw #> '{match,mid}' as match_mid, raw "
        "from football.mackolik_matches where raw is not null "
        "and jsonb_array_length(coalesce(raw #> '{lineup,team_A,players}','[]')) > 0 "
        "order by match_datetime"
    )
    matches = cur.fetchall()
    if args.limit:
        matches = matches[: args.limit]

    # zaten cekilmis (match,player) seti
    cur.execute("select match_uuid, player_id from football.mackolik_player_match_stats")
    done = set(cur.fetchall())

    tot_players = tot_metrics = errors = skipped = 0
    for mi, (muuid, ta, tb, mmid, raw) in enumerate(matches, 1):
        mmid = mmid if isinstance(mmid, str) else (raw.get("match", {}) or {}).get("mid")
        if not mmid:
            continue
        for pid, puuid, pmid, team_id in iter_lineup_players(raw, ta, tb):
            if (muuid, pid) in done:
                skipped += 1
                continue
            try:
                j = player_stats(mmid, pmid)
            except Exception as e:  # noqa: BLE001
                errors += 1
                print(f"  HATA {muuid} p{pid}: {str(e)[:80]}")
                time.sleep(args.sleep)
                continue
            metrics = parse_stats(j) if j else {}
            cur.execute(
                """insert into football.mackolik_player_match_stats
                   (match_uuid, player_id, player_uuid, player_mid, team_id, minutes, goals, assists)
                   values (%s,%s,%s,%s,%s,%s,%s,%s)
                   on conflict (match_uuid, player_id) do update set fetched_at=now()""",
                (muuid, pid, puuid, pmid, team_id,
                 int(metrics.get("minutes")) if metrics.get("minutes") is not None else None,
                 int(metrics.get("goals_total") or 0), int(metrics.get("assists_total") or 0)),
            )
            if metrics:
                psycopg2.extras.execute_values(
                    cur,
                    """insert into football.mackolik_player_match_metrics (match_uuid, player_id, metric_key, value)
                       values %s on conflict (match_uuid, player_id, metric_key) do update set value=excluded.value""",
                    [(muuid, pid, k, v) for k, v in metrics.items()],
                )
                tot_metrics += len(metrics)
            tot_players += 1
            done.add((muuid, pid))
            time.sleep(args.sleep)
        if mi % 10 == 0 or mi == len(matches):
            conn.commit()
            print(f"  {mi}/{len(matches)} maç · {tot_players} yeni oyuncu · {tot_metrics} metrik · {skipped} atlandi · {errors} hata")
    conn.commit()
    cur.close()
    conn.close()
    print(f"BITTI: {tot_players} oyuncu-maç, {tot_metrics} metrik, {skipped} atlandi, {errors} hata")


if __name__ == "__main__":
    main()

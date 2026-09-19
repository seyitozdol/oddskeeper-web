"""fetch_flashscore_bsl.py saf ayrıştırıcı testleri (ağ/DB gerektirmez).

    python src/basketball/test_fetch_flashscore_bsl.py

Örnek feed parçaları 2026-09-19'da canlı beslemeden alındı (Beşiktaş 75-77 Fenerbahçe, final).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_flashscore_bsl import (  # noqa: E402
    blocks, build_rows, parse_players, parse_team_stats, season_label_of, week_of,
)

GAME = {"mid": "nPacC96M", "ts": 1781888400, "round": "Final",
        "home": {"id": "hE4Gkj9l", "name": "Besiktas", "code": "BES", "pts": 75},
        "away": {"id": "rDhoZR1l", "name": "Fenerbahce", "code": "FEN", "pts": 77}}

PSN = ("PA÷Overall¬~TT÷¬~PF÷Player¬~PF÷PTS¬~PF÷REB¬~PF÷AST¬~PF÷MIN¬~PF÷FGM¬~PF÷FGA¬~PF÷2PM¬~PF÷2PA¬~"
       "PF÷3PM¬~PF÷3PA¬~PF÷FTM¬~PF÷FTA¬~PF÷+/-¬~PF÷OR¬~PF÷DR¬~PF÷PF¬~PF÷ST¬~PF÷TO¬~PF÷BS¬~PF÷BA¬~PF÷TFS¬~"
       "PJ÷Dotson D.¬PK÷/player/dotson-devon/htMm729K/¬PL÷USA¬PM÷200¬PN÷BES¬"
       "PC÷15|2|4|28:38|5|13|1|5|4|8|1|2|2|1|1|2|1|2|-|-|-¬~"
       "PJ÷Sanli S.¬PK÷/player/sanli-sertac/WEpS8w76/¬PL÷Turkey¬PM÷191¬PN÷BES¬"
       "PC÷9|5|1|24:41|3|3|2|2|1|1|2|2|-7|-|4|3|1|-|1|-|-¬~"
       "PJ÷Horton-Tucker T.¬PK÷/player/horton-tucker-talen/abc12345/¬PN÷FEN¬"
       "PC÷12|3|2|20:00|4|9|3|6|1|3|3|4|5|1|2|2|-|1|-|-|-¬~"
       "PJ÷Bench B.¬PK÷/player/bench-bob/zzz99999/¬PN÷FEN¬PC÷-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-¬~"
       "PA÷Besiktas¬~PJ÷Dotson D.¬PK÷/player/dotson-devon/htMm729K/¬PN÷BES¬PC÷15|2|4|28:38|5|13|1|5|4|8|1|2|2|1|1|2|1|2|-|-|-¬~")

ST = ("SE÷Match¬~SG÷2-point field goals made¬SH÷12¬SI÷19¬~SG÷Total rebounds¬SH÷31¬SI÷41¬~"
      "SG÷Personal fouls¬SH÷19¬SI÷18¬~SE÷1st Quarter¬~SG÷Total rebounds¬SH÷9¬SI÷9¬~")


def test_blocks():
    assert blocks("A÷1¬B÷2¬~C÷3¬~") == [{"A": "1", "B": "2"}, {"C": "3"}]


def test_week_and_season():
    assert week_of("Round 7") == 7 and week_of("Final") == 33 and week_of("Semi-finals") == 32
    assert week_of("Quarter-finals") == 31 and week_of(None) is None
    assert season_label_of(1781888400) == "2025-2026"        # 19 Haziran 2026
    assert season_label_of(1790352000) == "2026-2027"        # 25 Eylül 2026


def test_parse_players_first_section_only_and_played_only():
    rows = parse_players(PSN, GAME)
    assert [r["fs_player_id"] for r in rows] == ["htMm729K", "WEpS8w76", "abc12345"]   # DNP + 2. bölüm yok
    d = rows[0]
    assert (d["player_name"], d["side"], d["source_team_id"]) == ("Devon Dotson", "home", "hE4Gkj9l")
    assert (d["seconds_played"], d["points"], d["fg2m"], d["fg2a"], d["fg3m"], d["fg3a"]) == (1718, 15, 1, 5, 4, 8)
    assert (d["ftm"], d["fta"], d["oreb"], d["dreb"], d["treb"], d["assists"]) == (1, 2, 1, 1, 2, 4)
    assert rows[2]["player_name"] == "Talen Horton Tucker" and rows[2]["side"] == "away"


def test_missing_offensive_rebound_cell_is_repaired():
    sanli = parse_players(PSN, GAME)[1]
    assert (sanli["treb"], sanli["dreb"], sanli["oreb"]) == (5, 4, 1)      # OR hücresi "-" gelmişti


def test_team_stats_match_section_only():
    home, away = parse_team_stats(ST)
    assert (home["treb"], away["treb"], home["fg2m"], away["fouls_committed"]) == (31, 41, 12, 18)


def test_build_rows():
    team_rows, player_rows = build_rows(GAME, parse_players(PSN, GAME), parse_team_stats(ST))
    h = next(t for t in team_rows if t["home_away"] == "Home")
    assert (h["season_label"], h["week"], h["match_date"], h["points"], h["opp_points"]) == ("2025-2026", 33, "2026-06-19", 75, 77)
    assert h["source_team_id"] == "hE4Gkj9l" and h["opp_source_team_id"] == "rDhoZR1l" and h["treb"] == 31
    assert all(p["fs_match_id"] == "nPacC96M" for p in player_rows)


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)

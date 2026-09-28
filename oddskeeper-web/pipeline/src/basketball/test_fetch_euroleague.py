"""fetch_euroleague.py saf fonksiyon testleri (ag/DB gerektirmez).

    python src/basketball/test_fetch_euroleague.py

Saat ornekleri 2026-09-28'de canli API'den: E2026 gc 4 (Barcelona-Efes) date 20:30 (Madrid), utcDate 18:30Z.
"""
import os
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_euroleague import (  # noqa: E402
    box_ready, normalize, schedule_diff, schedule_rows, season_of, select_due, select_settle,
    stats_diff, to_utc, waiting_log_due,
)

UTC = timezone.utc
NOW = datetime(2026, 9, 28, 19, 0, tzinfo=UTC)


def dt(*a):
    return datetime(*a, tzinfo=UTC)


def club(code, name):
    return {"code": code, "name": name, "abbreviatedName": name, "editorialName": name,
            "images": {"crest": f"https://x/{code}.png"}}


def player(code, secs, pts, start=False):
    return {"player": {"person": {"code": code, "name": f"P {code}", "country": {"code": "TUR"},
                                  "birthDate": "2000-01-02T00:00:00", "height": 200},
                       "positionName": "Guard", "dorsal": "7", "images": {}, "externalId": 1},
            "stats": {"timePlayed": secs, "points": pts, "startFive": start, "assistances": 1}}


META = {"gameCode": 4, "identifier": "E2026_4", "round": 1, "played": True,
        "phaseType": {"code": "RS", "name": "Regular Season"},
        "date": "2026-09-24T20:30:00", "utcDate": "2026-09-24T18:30:00Z",
        "local": {"club": club("BAR", "FC Barcelona"), "score": 89},
        "road": {"club": club("IST", "Anadolu Efes Istanbul"), "score": 82}}


def stats_of(n_home=5, n_away=5, dnp=True, totals=True):
    def side(prefix, n, pts):
        pl = [player(f"{prefix}{k}", 600.0 + k, 10) for k in range(n)]
        if dnp:
            pl.append(player(f"{prefix}X", 0, 0))          # oynamadi
        return {"players": pl, "total": {"points": pts, "timePlayed": 2400.0} if totals else None}
    return {"local": side("H", n_home, 89), "road": side("A", n_away, 82)}


def test_to_utc():
    assert to_utc({"utcDate": "2026-09-24T18:30:00Z", "date": "2026-09-24T20:30:00"}) == dt(2026, 9, 24, 18, 30)
    assert to_utc({"date": "2026-09-24T20:30:00"}) == dt(2026, 9, 24, 18, 30)        # yaz: CEST +2
    assert to_utc({"date": "2027-01-13T20:30:00"}) == dt(2027, 1, 13, 19, 30)        # kis: CET +1
    assert to_utc({"utcDate": "2027-01-13T19:30:00Z"}).utcoffset() == timedelta(0)
    assert to_utc({}) is None


def test_rows_carry_utc_date():
    gr, tdims = schedule_rows(META, "E", "E2026", "2026-2027")
    assert gr["game_date"] == dt(2026, 9, 24, 18, 30) and gr["played"] is True
    assert (gr["home_score"], gr["away_score"]) == (89, 82) and [t["team_code"] for t in tdims] == ["BAR", "IST"]
    gr, _, trows, pdims, prows = normalize(META, stats_of(), "E", "E2026", "2026-2027")
    assert gr["game_date"] == dt(2026, 9, 24, 18, 30)
    assert all(r["game_date"] == dt(2026, 9, 24, 18, 30) for r in trows + prows)
    assert len(prows) == 10 and not any(r["person_code"].endswith("X") for r in prows)   # DNP atlandi
    assert pdims[0]["birth_date"] == "2000-01-02T00:00:00"                               # takvim tarihi, UTC degil


def test_box_ready():
    assert box_ready(stats_of()) == (True, 10)
    assert box_ready(stats_of(4, 5)) == (False, 9)
    assert box_ready(stats_of(totals=False)) == (False, 10)
    assert box_ready({"local": {"players": [], "total": None}, "road": {"players": [], "total": None}}) == (False, 0)
    assert box_ready(None) == (False, 0)


def test_season_code_boundary():
    assert season_of("E", date(2026, 6, 30)) == ("2025-2026", "E2025")
    assert season_of("E", date(2026, 7, 1)) == ("2026-2027", "E2026")
    assert season_of("U", date(2027, 1, 15)) == ("2026-2027", "U2026")


def test_select_due():
    h = timedelta(hours=1)
    rows = [
        {"game_code": 1, "game_date": NOW - 3 * h, "stats_updated_at": None},                    # vadesi geldi
        {"game_code": 2, "game_date": NOW - 2 * h, "stats_updated_at": None},                    # min yas dolmadi
        {"game_code": 3, "game_date": NOW - timedelta(days=15), "stats_updated_at": None},       # max yas asildi
        {"game_code": 4, "game_date": NOW - 3 * h, "stats_updated_at": NOW - h},                 # zaten yuklu
        {"game_code": 5, "game_date": None, "stats_updated_at": None},
        {"game_code": 6, "game_date": NOW - timedelta(days=3), "stats_updated_at": None},        # kacirilmis, telafi
        {"game_code": 7, "game_date": NOW + 20 * h, "stats_updated_at": None},                   # gelecek
    ]
    assert [r["game_code"] for r in select_due(rows, NOW, 2.5, 14)] == [6, 1]


def test_select_settle():
    h = timedelta(hours=1)
    t1 = NOW - 21 * h
    rows = [
        {"game_code": 1, "game_date": t1, "stats_updated_at": t1 + 2.5 * h},                     # kontrol edilecek
        {"game_code": 2, "game_date": NOW - 19 * h, "stats_updated_at": NOW - 16 * h},           # daha erken
        {"game_code": 3, "game_date": t1, "stats_updated_at": t1 + 20 * h},                      # zaten kontrol edildi
        {"game_code": 4, "game_date": t1, "stats_updated_at": None},                             # yuklu degil
        {"game_code": 5, "game_date": NOW - timedelta(days=15), "stats_updated_at": NOW - timedelta(days=15)},
    ]
    assert [r["game_code"] for r in select_settle(rows, NOW, 14, 20)] == [1]


def _db_like(rows):
    """DB'den okunmus gibi: numeric -> Decimal."""
    return [dict(r, minutes=Decimal(str(r["minutes"]))) if "minutes" in r else dict(r) for r in rows]


def test_stats_diff():
    _, _, trows, _, prows = normalize(META, stats_of(), "E", "E2026", "2026-2027")
    assert stats_diff(_db_like(prows), _db_like(trows), prows, trows) == (0, [])
    changed = [dict(r, points=r["points"] + 2) if r["person_code"] == "H0" else r for r in prows]
    assert stats_diff(_db_like(prows), _db_like(trows), changed, trows) == (1, [])
    dropped = [r for r in prows if r["person_code"] != "A1"]
    assert stats_diff(_db_like(prows), _db_like(trows), dropped, trows) == (1, ["A1"])
    tchanged = [dict(trows[0], treb=40), trows[1]]
    assert stats_diff(_db_like(prows), _db_like(trows), prows, tchanged) == (1, [])


def _g(gc, when, home="BAR", away="IST", played=False):
    return {"competition": "U", "season_code": "U2026", "season_label": "2026-2027", "game_code": gc,
            "identifier": f"U2026_{gc}", "round": 1, "phase_code": "RS", "phase_name": "Regular Season",
            "game_date": when, "played": played, "home_team_code": home, "home_team_name": home,
            "away_team_code": away, "away_team_name": away, "home_score": None, "away_score": None}


def _t(code, name=None):
    return {"competition": "U", "season_code": "U2026", "season_label": "2026-2027", "team_code": code,
            "team_name": name or code, "abbr_name": code, "editorial_name": code, "crest_url": None}


def test_schedule_diff():
    old, new_t = dt(2026, 9, 29, 18, 0), dt(2026, 9, 30, 16, 0)
    api = {1: _g(1, new_t), 2: _g(2, old), 3: _g(3, old, "BOS", "TTK"), 7: _g(7, old)}
    db = {1: _g(1, old), 2: _g(2, old), 7: _g(7, new_t),
          4: _g(4, old, "MCO", "TTK"),                       # bayat: oynanmamis, statsiz -> silinir
          5: _g(5, old),                                     # API'de yok ama stats'i var -> kalir
          6: _g(6, old, played=True)}                        # oynanmis -> kalir
    api_teams = {"BAR": _t("BAR"), "IST": _t("IST", "Anadolu Efes Istanbul"), "BOS": _t("BOS"), "TTK": _t("TTK")}
    db_teams = {"BAR": _t("BAR"), "IST": _t("IST", "Anadolu Efes"), "TTK": _t("TTK"),
                "MCO": _t("MCO"),                            # hic bir API macinda yok, statsiz -> silinir
                "OLD": _t("OLD")}                            # API'de yok ama stats'i var -> kalir
    d = schedule_diff(api, db, api_teams, db_teams, stat_games={5, 7}, stat_teams={"OLD"})
    assert d["new"] == [3] and sorted(d["changed"]) == [1, 7] and d["delete"] == [4]
    assert d["moved"] == {7: old}                            # yalniz statli macin saati yayilir
    assert d["team_new"] == ["BOS"] and d["team_changed"] == ["IST"] and d["team_delete"] == ["MCO"]
    # ayni saat, farkli tz gosterimi (DB UTC okur) degisiklik sayilmaz
    same = {2: dict(_g(2, old), game_date=old.astimezone(timezone(timedelta(hours=2))))}
    assert schedule_diff({2: _g(2, old)}, same, {}, {}, set(), set())["changed"] == []


def test_waiting_log_once():
    six = timedelta(hours=6)
    assert waiting_log_due(six, 10) and waiting_log_due(six + timedelta(minutes=9), 10)
    assert not waiting_log_due(six + timedelta(minutes=10), 10)
    assert not waiting_log_due(six - timedelta(minutes=1), 10)


def test_once_at_stuck_and_first_due():
    import fetch_euroleague as fe
    # box-score eksik: ilk vade turunda (tip-off + 2.5 s) bir kez, 24 saatte bir kez HATA
    assert fe.once_at(timedelta(hours=2.5), 2.5, 10)
    assert not fe.once_at(timedelta(hours=2.5, minutes=10), 2.5, 10)
    assert fe.once_at(timedelta(hours=fe.STUCK_H, minutes=3), fe.STUCK_H, 10)
    assert not fe.once_at(timedelta(hours=fe.STUCK_H, minutes=11), fe.STUCK_H, 10)


def test_api_get_rate_limit_raises():
    import email.message
    import urllib.error
    import fetch_euroleague as fe
    hdr = email.message.Message()
    hdr["Retry-After"] = "139"

    def boom(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", hdr, None)
    real = fe.urllib.request.urlopen
    fe.urllib.request.urlopen = boom
    try:
        try:
            fe.api_get("https://example.invalid/x")
            raise AssertionError("RateLimited bekleniyordu")
        except fe.RateLimited as e:
            assert e.code == 429 and e.retry_after == "139"
            assert not isinstance(e, fe.NET_ERRORS)   # gecici ag hatasi gibi mac mac yutulmaz, turu durdurur
    finally:
        fe.urllib.request.urlopen = real


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
    print("OK")

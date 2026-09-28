"""match_euroleague_bsl.py saf kademe testleri (ag/DB gerektirmez).

    python src/basketball/test_match_euroleague_bsl.py        # ya da: pytest src/basketball/test_match_euroleague_bsl.py

Ornekler 2026-09-28 olcumunden: EL/EC API 26/27 kayitli kadrolari (/people) ve 25/26
euroleague.players satirlari; BSL tarafi basketball.players (isim + dogum tarihi) gercek degerleri.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from match_euroleague_bsl import (  # noqa: E402
    MANUAL_LINKS, canonical, classify, given_related, global_suggestions, make_cand, make_person,
    person_sets, review_worthy, season_code,
)


def slug_of(res):
    tier, reason, hits = res
    return (tier, hits[0]["slug"]) if tier else (reason, sorted(c["slug"] for c in hits))


# ---- BSL kulup adaylari (team_rosters 2026-2027 ornekleri) ----
FB = [make_cand("braxton-key", "Braxton Key", "1997-02-14"),
      make_cand("chris-silva", "Chris Silva", "1996-09-19"),
      make_cand("talen-horton-tucker", "Talen Horton-tucker", "2000-11-25"),
      make_cand("wade-baldwin-iv", "Wade Baldwin Iv", "1996-03-29"),
      make_cand("william-clyburn", "William Clyburn", "1990-05-17"),
      make_cand("shane-larkin", "Shane Larkin", "1992-10-02")]
BES = [make_cand("eugene-omoruyi", "Eugene Omoruyi", "1997-02-14"),
       make_cand("anthony-brown", "Anthony Brown", "1992-10-10"),
       make_cand("vitto-brown", "Vitto Brown", "1995-07-31"),
       make_cand("david-michael-de-julius", "David Michael De Julius", "1999-08-09")]
TTK = [make_cand("tim-schneider", "Tim Schneider", "1997-09-01"),
       make_cand("kyle-allman", "Kyle Allman", "1997-09-01")]
IST = [make_cand("collin-malcolm", "Collin Malcolm", "1997-07-02"),
       make_cand("malcolm-collins", "Malcolm Collins", "1990-09-27"),
       make_cand("georgios-papagiannis", "Georgios Papagiannis", "1997-07-03"),
       make_cand("santiago-yusta", "Santiago Yusta", "1997-04-28"),
       make_cand("fatts-russell", "Fatts Russell", "1998-05-06")]
TOF = [make_cand("gabe-brown", "Gabe Brown", "2000-03-05"),
       make_cand("terrell-carter", "Terrell Carter", "1996-01-06"),
       make_cand("shavar-reynolds", "Shavar Reynolds", "1998-05-11"),
       make_cand("bryce-tyler-jones", "Bryce Tyler Jones", "1994-10-12"),
       make_cand("zach-nutall", "Zach Nutall", "1999-12-16"),
       make_cand("ahmet-berkay-gonul", "Ahmet Berkay Gonul", "2007-06-22")]


def no_bd(cands):
    """Ayni adaylar dogum tarihi BOS (T2 yolunu sinamak icin)."""
    return [dict(c, bd=None) for c in cands]


def test_season_code():
    assert season_code("E", "2026-2027") == "E2026"
    assert season_code("U", "2025-2026") == "U2025"


def test_person_sets_passport_and_display():
    # pasaport ad kumesinde virgul ("ISIAHA, TYRIN") ve soyadda Jr/II/IV atilir
    assert person_sets("MIKE, ISIAHA", "ISIAHA, TYRIN", "MIKE") == ({"mike"}, {"isiaha", "tyrin"})
    assert person_sets("CARTER II, TERRELL", "TERRELL NIKKO", "CARTER II")[0] == {"carter"}
    assert person_sets("BALDWIN IV, WADE", "WADE M", "BALDWIN IV")[0] == {"baldwin"}
    assert person_sets("REYNOLDS JR, SHAVAR", "SHAVAR LEWIS", "REYNOLDS JR")[0] == {"reynolds"}
    assert person_sets("YUSTA, SANTI", "SANTIAGO", "YUSTA GARCIA") == ({"yusta", "garcia"}, {"santi", "santiago"})
    assert person_sets("SILVA, CHRIS", "JUNIOR CHRISTOPHER", "OBAME CORREIA SILVA") == (
        {"silva", "obame", "correia"}, {"chris", "junior", "christopher"})
    assert person_sets("DEJULIUS, DAVID", "DAVID MICHAEL", "DE JULIUS")[0] == {"dejulius", "de", "julius"}
    assert person_sets("HORTON TUCKER, TALEN", "TALEN JALEE", "TUCKER")[0] == {"horton", "tucker"}
    assert person_sets("THURMAN, TRE'SHAWN", "TRESHAWN MARCEL", "THURMAN")[1] == {"treshawn", "marcel"}
    # virgulsuz ad: son token soyad
    assert person_sets("Shane Larkin") == ({"larkin"}, {"shane"})


def test_given_related():
    assert given_related({"vittorio"}, ["vitto"])
    assert given_related({"zachary", "markeith"}, ["zach"])
    assert given_related({"santi", "santiago"}, ["santiago"])
    assert given_related({"will", "william", "dalen"}, ["william"])
    assert not given_related({"daron"}, ["fatts"])          # takma ad: T2 baglamaz
    assert not given_related({"perry", "linnard", "pj"}, ["jo"])  # 3 harften kisa onek sayilmaz
    assert not given_related({"anthony", "lejohn"}, ["vitto"])


def test_club_gate_same_birth_date_key_omoruyi():
    # Braxton Key (FB) ve Eugene Omoruyi (BES) ayni gun (1997-02-14): kulup kapisi + soyad ayirir
    key = make_person("014168", "KEY, BRAXTON", "BRAXTON ELLIS", "KEY", "1997-02-14T00:00:00")
    omo = make_person("014207", "OMORUYI, EUGENE", "EUGENE TANWA", "OMORUYI", "1997-02-14T00:00:00")
    assert slug_of(classify(key, FB)) == ("T1", "braxton-key")
    assert slug_of(classify(omo, BES)) == ("T1", "eugene-omoruyi")
    assert slug_of(classify(key, BES)) == ("no-bsl-candidate", [])     # yanlis kulupte baglanmaz
    # T3 (tum BSL) onerisi dogum tarihi TEK BASINA yetmez, soyad da ister
    assert [c["slug"] for c in global_suggestions(key, FB + BES)] == ["braxton-key"]
    assert [c["slug"] for c in global_suggestions(key, FB + BES, exclude={"braxton-key"})] == []


def test_birth_date_window_schneider_allman():
    # TTK: Allman BSL 09-01, EL 09-02 (+-1 gun); Schneider 09-01 ayni pencerede -> soyad ayirir
    allman = make_person("011924", "ALLMAN, KYLE", "KYLE", "ALLMAN", "1997-09-02")
    schneider = make_person("006251", "SCHNEIDER, TIM", "TIM", "SCHNEIDER", "1997-09-01")
    assert slug_of(classify(allman, TTK)) == ("T1", "kyle-allman")
    assert slug_of(classify(schneider, TTK)) == ("T1", "tim-schneider")


def test_malcolm_collins_papagiannis():
    malcolm = make_person("012609", "MALCOLM, COLLIN", "COLLIN ANTHONY", "MALCOLM", "1997-07-02")
    papa = make_person("005844", "PAPAGIANNIS, GEORGIOS", "GEORGIOS", "PAPAGIANNIS", "1997-07-03")
    collins = make_person("X", "COLLINS, MALCOLM", "MALCOLM", "COLLINS", "1990-09-27")
    assert slug_of(classify(malcolm, IST)) == ("T1", "collin-malcolm")
    assert slug_of(classify(papa, IST)) == ("T1", "georgios-papagiannis")
    assert slug_of(classify(collins, IST)) == ("T1", "malcolm-collins")
    # Collin Malcolm kadroda olmasa, "Malcolm Collins" soyad-token'i tutar ama ASLA baglanmaz
    without = [c for c in IST if c["slug"] != "collin-malcolm"]
    assert slug_of(classify(malcolm, without)) == ("bd-mismatch", ["malcolm-collins"])


def test_brown_birth_date_typo_not_auto():
    # Vitto Brown: EL 1995-07-13, BSL 1995-07-31 (rakam takasi). Iki tarih de dolu ve tutmuyor ->
    # T2 CALISMAZ (adas/orta ad riski), inceleme 'bd-mismatch'; Vitto MANUAL_LINKS ile bagli.
    vitto = make_person("013365", "BROWN, VITTO", "VITTORIO", "BROWN", "1995-07-13")
    anthony = make_person("009025", "BROWN, ANTHONY", "ANTHONY LEJOHN", "BROWN", "1992-10-10")
    tier, hits = slug_of(classify(vitto, BES))
    assert tier == "bd-mismatch" and "vitto-brown" in hits
    assert slug_of(classify(vitto, no_bd(BES))) == ("T2", "vitto-brown")   # tarih eksikse T2 baglar
    assert slug_of(classify(anthony, BES)) == ("T1", "anthony-brown")
    # Vitto kadroda yoksa Anthony Brown'a ASLA baglanmaz (soyad tutar, ad/dogum tutmaz)
    without = [c for c in BES if c["slug"] != "vitto-brown"]
    assert slug_of(classify(vitto, without)) == ("bd-mismatch", ["anthony-brown"])
    # Gabriel/Gabe onek degil ama dogum tarihi tutuyor -> T1
    gabe = make_person("014945", "BROWN, GABRIEL", "GABRIEL THOMAS", "BROWN", "2000-03-05")
    assert slug_of(classify(gabe, TOF)) == ("T1", "gabe-brown")


def test_passport_given_with_comma_isiaha_mike():
    mike = make_person("011836", "MIKE, ISIAHA", "ISIAHA, TYRIN", "MIKE", "1997-08-11")
    bah = [make_cand("isiaha-mike", "Isiaha Mike", None), make_cand("malachi-flynn", "Malachi Flynn", "1998-05-09")]
    assert slug_of(classify(mike, bah)) == ("T2", "isiaha-mike")
    assert slug_of(classify(mike, [dict(bah[0], bd=mike["bd"])])) == ("T1", "isiaha-mike")


def test_yusta_garcia():
    yusta = make_person("005368", "YUSTA, SANTI", "SANTIAGO", "YUSTA GARCIA", "1997-04-28")
    assert slug_of(classify(yusta, IST)) == ("T1", "santiago-yusta")
    santi = [make_cand("santi-yusta", "Santi Yusta", None)]
    assert slug_of(classify(yusta, santi)) == ("T2", "santi-yusta")


def test_fatts_russell_nickname():
    russell = make_person("013943", "RUSSELL, DARON", "DARON", "RUSSELL", "1998-05-06")
    assert slug_of(classify(russell, IST)) == ("T1", "fatts-russell")
    # dogum tarihi yoksa takma ad (Fatts/Daron) T2'yi gecemez -> inceleme, baglama yok
    assert slug_of(classify(russell, no_bd(IST))) == ("bd-mismatch", ["fatts-russell"])


def test_de_julius():
    dj = make_person("013250", "DEJULIUS, DAVID", "DAVID MICHAEL", "DE JULIUS", "1999-08-09")
    assert slug_of(classify(dj, BES)) == ("T1", "david-michael-de-julius")
    assert slug_of(classify(dj, no_bd(BES))) == ("T2", "david-michael-de-julius")


def test_generational_suffixes():
    carter = make_person("014940", "CARTER II, TERRELL", "TERRELL NIKKO", "CARTER II", "1996-01-06")
    reynolds = make_person("014097", "REYNOLDS JR, SHAVAR", "SHAVAR LEWIS", "REYNOLDS JR", "1998-05-11")
    jones = make_person("012621", "JONES, BRYCE", "BRYCE TYLER", "JONES JR", "1994-10-12")
    baldwin = make_person("009863", "BALDWIN IV, WADE", "WADE M", "BALDWIN IV", "1996-03-29")
    assert slug_of(classify(carter, TOF)) == ("T1", "terrell-carter")
    assert slug_of(classify(reynolds, TOF)) == ("T1", "shavar-reynolds")
    assert slug_of(classify(jones, TOF)) == ("T1", "bryce-tyler-jones")
    assert slug_of(classify(baldwin, FB)) == ("T1", "wade-baldwin-iv")
    assert slug_of(classify(carter, no_bd(TOF))) == ("T2", "terrell-carter")
    assert slug_of(classify(baldwin, no_bd(FB))) == ("T2", "wade-baldwin-iv")
    two = [make_cand("terrell-carter-ii", "Terrell Carter II", None)]
    assert slug_of(classify(carter, two)) == ("T2", "terrell-carter-ii")


def test_obame_correia_silva():
    silva = make_person("014220", "SILVA, CHRIS", "JUNIOR CHRISTOPHER", "OBAME CORREIA SILVA", "1996-09-19")
    assert slug_of(classify(silva, FB)) == ("T1", "chris-silva")
    assert slug_of(classify(silva, no_bd(FB))) == ("T2", "chris-silva")


def test_prefix_given_names_without_birth_date():
    nutall = make_person("015111", "NUTALL, ZACH", "ZACHARY MARKEITH", "NUTALL", None)
    clyburn = make_person("004888", "CLYBURN, WILL", "WILLIAM DALEN", "CLYBURN", "1990-05-17")
    tucker = make_person("014124", "HORTON TUCKER, TALEN", "TALEN JALEE", "TUCKER", "2000-11-25")
    gonul = make_person("014938", "GONUL, BERKAY", "AHMET BERKAY", "GONUL", "2007-06-22")
    assert slug_of(classify(nutall, TOF)) == ("T2", "zach-nutall")
    assert slug_of(classify(clyburn, FB)) == ("T1", "william-clyburn")
    # iki tarih de dolu ve uzak: ad oneki tutsa da T2 baglamaz (Chris/Christian Brown adas riski)
    chris = make_person("X1", "BROWN, CHRIS", "CHRISTOPHER", "BROWN", "1990-01-01")
    assert slug_of(classify(chris, [make_cand("christian-brown", "Christian Brown", "2003-06-06")]))[0] == "bd-mismatch"
    tyler = make_person("X2", "JONES, BRYCE", "BRYCE TYLER", "JONES", "1994-10-12")
    assert slug_of(classify(tyler, [make_cand("tyler-jones", "Tyler Jones", "2004-03-03")]))[0] == "bd-mismatch"
    assert slug_of(classify(clyburn, no_bd(FB))) == ("T2", "william-clyburn")
    assert slug_of(classify(tucker, FB)) == ("T1", "talen-horton-tucker")
    assert slug_of(classify(tucker, no_bd(FB))) == ("T2", "talen-horton-tucker")
    assert slug_of(classify(gonul, TOF)) == ("T1", "ahmet-berkay-gonul")


def test_ambiguous_never_links():
    brown = make_person("009025", "BROWN, ANTHONY", "ANTHONY LEJOHN", "BROWN", "1992-10-10")
    dup = BES + [make_cand("anthony-lejohn-brown", "Anthony Lejohn Brown", "1992-10-10")]
    assert slug_of(classify(brown, dup)) == ("ambiguous", ["anthony-brown", "anthony-lejohn-brown"])
    dup_nobd = no_bd(dup)
    assert slug_of(classify(brown, dup_nobd))[0] == "ambiguous"


def test_canonical_alias():
    merges = {"deshane-davis-larkin": "shane-larkin", "caleb-homesley": "caleb-homesly", "a": "b", "b": "a"}
    assert canonical("deshane-davis-larkin", merges) == "shane-larkin"
    assert canonical("caleb-homesley", merges) == "caleb-homesly"
    assert canonical("shane-larkin", merges) == "shane-larkin"
    assert canonical("a", merges) in ("a", "b")                         # dongu korumasi
    # alias slug'a bagli bag -> kanonik aday T1 ile ayni sonuc: catisma yok
    larkin = make_person("007200", "LARKIN, SHANE", "DESHANE DAVIS", "LARKIN", "1992-10-02")
    assert slug_of(classify(larkin, FB)) == ("T1", canonical("deshane-davis-larkin", merges))


def test_review_worthy():
    assert review_worthy(True, "no-bsl-candidate", [])        # EL'de oynadi, eslesmedi -> inceleme
    assert not review_worthy(False, "no-bsl-candidate", [])   # yalniz kayitli, aday yok -> sessiz
    # yalniz kayitli + kulupte aday yok: kulup disi T3 onerisi olsa bile SESSIZ (sezon basi bos alarm)
    assert not review_worthy(False, "no-bsl-candidate", [{"slug": "x"}])
    assert review_worthy(False, "bd-mismatch", [{"slug": "x"}])
    assert review_worthy(False, "ambiguous", [{"slug": "x"}, {"slug": "y"}])


def test_manual_links_include_gultekin():
    assert MANUAL_LINKS["007653"] == "yavuz-gultekin"
    assert all(v == v.lower() and " " not in v for v in MANUAL_LINKS.values())


# ---- Linker akisi, sahte cursor ile (gercek DB'ye dokunmaz) ----
class FakeCursor:
    """Linker'in SQL'lerine hazir cevap veren sahte cursor; yazmalari kaydeder."""

    def __init__(self, links=(), reviews=()):
        """reviews: {(kind, source, source_id): (status, reason)} ya da anahtar listesi (acik, reason yok)."""
        self.links = {pc: [s, src] for pc, s, src in links}
        self.reviews = dict(reviews) if isinstance(reviews, dict) else {k: ("open", None) for k in reviews}
        self.writes, self.rows, self.rowcount = [], [], 0

    def execute(self, sql, params=None):
        s = " ".join(sql.split()).lower()
        self.rows, self.rowcount = [], 0
        if s.startswith(("insert", "update", "delete")):
            self.writes.append((s, params))
            if "into basketball.identity_review" in s:
                # gercek SQL: yeni -> ekle; resolved ya da sebep degisti (ignored haric) -> yeniden ac
                key, reason = (params[0], params[1], params[2]), params[7]
                allow = params[9] if len(params) > 9 else True      # tam kanitli tur mu (Linker.complete)
                old = self.reviews.get(key)
                hit = old is None or (old[0] != "ignored" and
                                      (old[0] == "resolved" or (allow and old[1] != reason)))
                self.rowcount = 1 if hit else 0
                if hit:
                    self.reviews[key] = ("open", reason)
            elif "update basketball.identity_review" in s:
                key = ("player", params[0], params[1])
                self.rowcount = 1 if self.reviews.get(key, ("",))[0] == "open" else 0
                if self.rowcount:
                    self.reviews[key] = ("resolved", self.reviews[key][1])
            elif "into euroleague.player_bsl_link" in s:
                self.rowcount = 0 if params[0] in self.links else 1
                self.links.setdefault(params[0], [params[1], "x"])
            else:
                self.rowcount = 1
        elif "from analytics.bb_pm_player_merges" in s:
            self.rows = [("deshane-davis-larkin", "shane-larkin")]
        elif "from basketball.players where team_slug" in s or "from basketball.player_match_stats" in s:
            self.rows = []
        elif "from basketball.players" in s:
            self.rows = [(c["slug"], c["name"], c["bd"], None) for c in FB + BES + TTK]
            self.rows.append(("deshane-davis-larkin", "Deshane Davis Larkin", None, None))
        elif "from basketball.teams" in s:
            self.rows = [("fenerbahce",), ("besiktas",), ("turk-telekom",), ("tofas",)]
        elif "from euroleague.team_bsl_link" in s:
            self.rows = [("ULK", "fenerbahce"), ("BES", "besiktas"), ("TTK", "turk-telekom")]
        elif "from euroleague.player_bsl_link" in s:
            self.rows = [(pc, v[0], v[1]) for pc, v in self.links.items()]
        elif "from euroleague.teams" in s:
            self.rows = [("E", "ULK"), ("E", "BES"), ("U", "TTK")]
        elif "from basketball.team_rosters" in s:
            team = params[1]
            self.rows = [(c["slug"],) for c in {"fenerbahce": FB, "besiktas": BES, "turk-telekom": TTK}[team]]
        elif "from basketball.identity_review" in s and "status='open'" in s:
            self.rows = [(k[2], v[1]) for k, v in self.reviews.items() if k[0] == "player" and v[0] == "open"]
        elif "from basketball.identity_review" in s:
            old = self.reviews.get(tuple(params))
            self.rows = [old] if old else []
        elif "from euroleague.player_match_stats" in s or "from euroleague.players" in s:
            self.rows = []
        else:
            raise AssertionError(f"beklenmeyen SQL: {s[:80]}")

    def fetchall(self):
        return list(self.rows)

    def fetchone(self):
        return self.rows[0] if self.rows else None


def _linker(cur, dry):
    import io
    from contextlib import redirect_stdout
    from match_euroleague_bsl import Linker
    buf = io.StringIO()
    with redirect_stdout(buf):
        lk = Linker(cur, "2026-2027", dry, False)
    return lk, buf


def _persons(*people):
    P = {}
    for club, per in people:
        p = make_person(per["code"], per["name"], per.get("pn", ""), per.get("ps", ""), per.get("bd"))
        p.update(clubs={club}, reg=True, box=per.get("box", False))
        P[p["code"]] = p
    return P


def test_linker_review_printed_once():
    import io
    from contextlib import redirect_stdout
    cur = FakeCursor()
    lk, _ = _linker(cur, dry=False)
    out = io.StringIO()
    with redirect_stdout(out):
        lk.review("player", "999", "DOE, JOHN", "besiktas", "", "no-bsl-candidate", [])
        lk.review("player", "999", "DOE, JOHN", "besiktas", "", "no-bsl-candidate", [])
        lk.flush()
    assert out.getvalue().count("[kimlik] INCELEME player euroleague=999") == 1   # 10 dk cron tekrar bildirmez
    assert lk.n["review_new"] == 1


def test_linker_dry_run_never_writes():
    import io
    from contextlib import redirect_stdout
    cur = FakeCursor(links=[("007200", "deshane-davis-larkin", "auto")])
    lk, _ = _linker(cur, dry=True)
    P = _persons(("ULK", {"code": "014168", "name": "KEY, BRAXTON", "bd": "1997-02-14"}),
                 ("TTK", {"code": "011924", "name": "ALLMAN, KYLE", "bd": "1997-09-02"}),
                 ("BES", {"code": "900001", "name": "DOE, JOHN", "bd": "1990-01-01", "box": True}))
    out = io.StringIO()
    with redirect_stdout(out):
        lk.fix_aliases()
        lk.decide_team({"code": "BUR", "name": "Tofas Bursa", "country": {"code": "TUR"}})
        lk.apply_teams()
        lk.link_persons(P)
        lk.flush()
    assert cur.writes == []                                      # kuru kosu: tek bir yazma bile yok
    text = out.getvalue()
    assert "alias duzeltildi: 007200 deshane-davis-larkin -> shane-larkin" in text
    assert "takim baglandi: BUR 'Tofas Bursa' -> tofas" in text
    assert "baglandi: 014168 'KEY, BRAXTON' (ULK) -> braxton-key [T1]" in text
    assert "baglandi: 011924 'ALLMAN, KYLE' (TTK) -> kyle-allman [T1]" in text
    assert "INCELEME player euroleague=900001" in text           # oynadi ama eslesmedi -> inceleme
    assert lk.n["T1"] == 2 and lk.n["alias"] == 1 and lk.n["team_new"] == 1


def test_linker_conflict_never_overwrites():
    import io
    from contextlib import redirect_stdout
    # 014168 elle/eskiden baska slug'a bagli; taze T1 braxton-key diyor -> inceleme, bag AYNEN kalir
    cur = FakeCursor(links=[("014168", "chris-silva", "auto")])
    lk, _ = _linker(cur, dry=False)
    P = _persons(("ULK", {"code": "014168", "name": "KEY, BRAXTON", "bd": "1997-02-14"}))
    out = io.StringIO()
    with redirect_stdout(out):
        lk.link_persons(P)
        lk.flush()
    assert not [w for w in cur.writes if "player_bsl_link" in w[0]]
    assert [w[1][6] for w in cur.writes if "identity_review" in w[0]] == ["chris-silva"]   # assigned = mevcut bag
    assert "(link-conflict;" in out.getvalue() and lk.n["conflict"] == 1


def test_linker_silent_for_registered_without_candidate():
    import io
    from contextlib import redirect_stdout
    cur = FakeCursor()
    lk, _ = _linker(cur, dry=False)
    P = _persons(("BES", {"code": "900002", "name": "GENC, OYUNCU", "bd": "2009-01-01"}))
    out = io.StringIO()
    with redirect_stdout(out):
        lk.link_persons(P)
        lk.flush()
    assert cur.writes == [] and out.getvalue() == "" and lk.n["silent"] == 1


def test_linker_output_buffered_until_flush():
    import io
    from contextlib import redirect_stdout
    cur = FakeCursor()
    lk, _ = _linker(cur, dry=False)
    out = io.StringIO()
    with redirect_stdout(out):
        lk.review("player", "998", "DOE, JANE", "besiktas", "", "no-bsl-candidate", [])
    assert out.getvalue() == ""                  # commit oncesi hicbir sey basilmaz (rollback'te ntfy yok)
    with redirect_stdout(out):
        lk.flush()
    assert "INCELEME player euroleague=998" in out.getvalue()


def test_linker_review_reopens_when_problem_changes():
    import io
    from contextlib import redirect_stdout
    key = ("player", "euroleague", "014168")
    # daha once kapanmis (resolved) kayit: yeni sorun (link-conflict) -> YENIDEN ACILIR ve bildirilir
    cur = FakeCursor(reviews={key: ("resolved", "no-bsl-candidate")})
    lk, _ = _linker(cur, dry=False)
    out = io.StringIO()
    with redirect_stdout(out):
        lk.review("player", "014168", "KEY, BRAXTON", "fenerbahce", "chris-silva", "link-conflict", [])
        lk.review("player", "014168", "KEY, BRAXTON", "fenerbahce", "chris-silva", "link-conflict", [])
        lk.flush()
    assert out.getvalue().count("INCELEME player euroleague=014168") == 1   # ayni sebep acikken tekrar yok
    assert cur.reviews[key] == ("open", "link-conflict")
    # 'ignored' kayit hic dokunulmaz
    cur2 = FakeCursor(reviews={key: ("ignored", "no-bsl-candidate")})
    lk2, _ = _linker(cur2, dry=False)
    out2 = io.StringIO()
    with redirect_stdout(out2):
        lk2.review("player", "014168", "KEY, BRAXTON", "fenerbahce", "", "ambiguous", [])
        lk2.flush()
    assert out2.getvalue() == "" and cur2.reviews[key][0] == "ignored"


def test_linker_incomplete_run_keeps_open_reason():
    import io
    from contextlib import redirect_stdout
    key = ("player", "euroleague", "900010")
    cur = FakeCursor(reviews={key: ("open", "bd-mismatch")})
    lk, _ = _linker(cur, dry=False)
    out = io.StringIO()
    with redirect_stdout(out):
        lk.complete = False     # kadrosuz yukleme turu: sebep degistirilmez, bildirim yok
        lk.review("player", "900010", "BROWN, JOHN", "fenerbahce", "", "no-bsl-candidate", [])
        lk.flush()
    assert out.getvalue() == "" and cur.reviews[key] == ("open", "bd-mismatch")
    with redirect_stdout(out):
        lk.complete = True      # sabah --people turu (tam kanit): sebep guncellenir, bir kez bildirilir
        lk.review("player", "900010", "BROWN, JOHN", "fenerbahce", "", "no-bsl-candidate", [])
        lk.flush()
    assert out.getvalue().count("INCELEME player euroleague=900010") == 1
    assert cur.reviews[key] == ("open", "no-bsl-candidate")


def test_linker_conflict_closes_only_on_confirmation():
    key = ("player", "euroleague", "014168")
    # bagli chris-silva, acik link-conflict; bu turda kulupte teyit yok (aday yok) -> KAPANMAZ
    cur = FakeCursor(links=[("014168", "chris-silva", "auto")], reviews={key: ("open", "link-conflict")})
    lk, _ = _linker(cur, dry=False)
    lk.link_persons(_persons(("TTK", {"code": "014168", "name": "KEY, BRAXTON", "bd": "1997-02-14"})))
    assert cur.reviews[key] == ("open", "link-conflict")
    # taze esleme mevcut bagi teyit ediyor -> kapanir
    cur2 = FakeCursor(links=[("014168", "braxton-key", "auto")], reviews={key: ("open", "link-conflict")})
    lk2, _ = _linker(cur2, dry=False)
    lk2.link_persons(_persons(("ULK", {"code": "014168", "name": "KEY, BRAXTON", "bd": "1997-02-14"})))
    assert cur2.reviews[key][0] == "resolved"


def test_linker_resolves_open_review_when_already_linked():
    cur = FakeCursor(links=[("014168", "braxton-key", "manual-sql")],
                     reviews={("player", "euroleague", "014168"): ("open", "no-bsl-candidate")})
    lk, _ = _linker(cur, dry=False)
    lk.link_persons(_persons(("ULK", {"code": "014168", "name": "KEY, BRAXTON", "bd": "1997-02-14"})))
    assert cur.reviews[("player", "euroleague", "014168")][0] == "resolved"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
    print("OK")

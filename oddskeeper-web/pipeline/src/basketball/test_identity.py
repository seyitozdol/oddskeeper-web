"""identity.py saf fonksiyon testleri (DB/tarayıcı gerektirmez).

    python src/basketball/test_identity.py        # ya da: pytest src/basketball/test_identity.py

Örnekler 2026-09-19 kaynak ölçümünden (RealGM / SofaScore / TBF-kökenli DB isimleri).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from identity import display_name, fuzzy_tier, match_team_slug, name_key, name_tokens, slugify  # noqa: E402


def test_name_key_folds_tbf_casing_artifacts():
    assert name_key("Deshane Davıs Larkın") == name_key("DESHANE DAVIS LARKIN")
    assert name_key("Kadi̇r Bayram") == name_key("KADİR BAYRAM")           # İ.lower() → i + U+0307
    assert name_key("P.J. Dozier") == name_key("Pj Dozier")
    assert name_key("Tre'Shawn Thurman") == name_key("Tre’shawn Thurman")


def test_name_key_drops_generational_suffix():
    assert name_key("Bonzie Colson Iı") == name_key("BONZIE COLSON II") == frozenset({"bonzie", "colson"})
    assert name_key("Shavar Reynolds, Jr.") == name_key("Shavar Reynolds")


def test_fuzzy_tier_never_equal_for_exact():
    assert fuzzy_tier(name_tokens("Furkan Korkmaz"), name_tokens("FURKAN KORKMAZ")) is None


def test_fuzzy_tiers():
    assert fuzzy_tier(name_tokens("Akif Egemen Güven"), name_tokens("Egemen Güven")) == "subset"
    assert fuzzy_tier(name_tokens("Scottie Wilbekin"), name_tokens("Scott Wilbekin")) == "surname+firstprefix"
    assert fuzzy_tier(name_tokens("Vitto Brown"), name_tokens("Anthony Brown")) == "surname"    # FARKLI kişiler
    assert fuzzy_tier(name_tokens("David DeJulius"), name_tokens("David Michael De Julius")) == "glued"
    assert fuzzy_tier(name_tokens("Mike James"), name_tokens("Jordan Loyd")) is None


def test_team_keywords_survive_sponsor_names():
    assert match_team_slug("Beşiktaş GAİN") == "besiktas"
    assert match_team_slug("Fenerbahçe Beko") == "fenerbahce"
    assert match_team_slug("Aliağa Petkimspor") == "aliaga-petkim-spor"
    assert match_team_slug("Glint Körfez Basket") == "manisa-basket"
    assert match_team_slug("Yukatel Merkezefendi Belediyesi Basket") == "merkezefendi-belediyesi"
    assert match_team_slug("Çayırova Belediyespor") == "cayirova-belediyesi"
    assert match_team_slug("Bandırma Bordo") == "bandirma-bordo"
    assert match_team_slug("Bilinmeyen Kulüp") is None


def test_display_name():
    assert display_name("JITAURIOUS TYKYVION GORDON") == "Jitaurious Tykyvion Gordon"   # I→i (Türkçe harf yok)
    assert display_name("HÜSEYİN GÖKSENİN KÖKSAL") == "Hüseyin Göksenin Köksal"
    assert display_name("YİĞİT ILGAZ") == "Yiğit Ilgaz"
    assert display_name("TALEN HORTON-TUCKER") == "Talen Horton-Tucker"
    assert display_name("Shane Larkin") == "Shane Larkin"                               # zaten düzgün → dokunma


def test_slugify():
    assert slugify("Çayırova Belediyesi") == "cayirova-belediyesi"
    assert slugify("Ömer Can İlyasoğlu") == "omer-can-ilyasoglu"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)

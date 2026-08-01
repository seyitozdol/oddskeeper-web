"""EL/EC oyuncularini BSL oyuncularina esle (Turk takimlari icinde), person_code ->
basketball player_slug -> euroleague.player_bsl_link. Boylece BSL oyuncu detayinda
EL/EC istatistigi gosterilir.

Esleme takim-kisitli (team_bsl_link kopruleri): yalniz ayni Turk kulubunun EL ve BSL
kadrolari karsilastirilir -> yanlis eslesme riski dusuk. Isim normalize Turkce-katlamali
(ad+soyad token kumesi). Idempotent (person_code PK).

Kullanim: python match_euroleague_bsl.py [--dry-run]
"""
import argparse
import os
import re
import sys
import unicodedata

import psycopg2
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")


SUFFIXES = {"jr", "sr", "ii", "iii", "iv"}

# Otomatik eslemenin yakalayamadigi takma-ad vakalari (person_code -> BSL slug).
# Nicholas/Nick, Perry/PJ, Scott/Scottie, Chris Silva/Obame Correia Silva.
MANUAL_LINKS = {
    # EuroLeague (Efes/Fenerbahce)
    "010391": "nick-weiler-babb",   # Nicholas Alan Weiler-Babb (Efes)
    "012742": "pj-dozier",          # Perry Linnard Dozier Jr (Efes)
    "006661": "scottie-wilbekin",   # Scott Jordan Wilbekin (Fenerbahce)
    "014220": "chris-silva",        # Junior Christopher Obame Correia Silva (Fenerbahce)
    # EuroCup (Besiktas/Turk Telekom)
    "008967": "matt-thomas",        # Matthew William Thomas (Besiktas)
    "013365": "vitto-brown",        # Vittorio Brown (Besiktas)
    "012760": "kris-bankston",      # Kristeon Lamar Bankston (Turk Telekom)
}


def fold_tokens(s: str) -> frozenset:
    for a, b in [("İ", "i"), ("I", "i"), ("ı", "i"), ("Ş", "s"), ("ş", "s"),
                 ("Ğ", "g"), ("ğ", "g"), ("Ç", "c"), ("ç", "c"),
                 ("Ö", "o"), ("ö", "o"), ("Ü", "u"), ("ü", "u")]:
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return frozenset(t for t in s.split() if len(t) > 1 and t not in SUFFIXES)


def match_player(el_surname: frozenset, el_given: frozenset, bsl_tokens: frozenset) -> bool:
    # EL passport SOYADI BSL isminde tam gecmeli (guclu sinyal) + en az bir ad token'i ortak.
    # Boylece orta-ad farki (Talen [Horton] Tucker) sorun olmaz, yanlis eslesme riski dusuk.
    if not el_surname or not bsl_tokens:
        return False
    if not (el_surname <= bsl_tokens):
        return False
    return bool(el_given & bsl_tokens)


def run(dry):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()

    # BSL birlestirmeleri (alias -> kanonik slug); esleseni kanonige cozeriz.
    cur.execute("select alias_slug, canonical_slug from analytics.bb_pm_player_merges where league='basketball'")
    canon = {a: c for a, c in cur.fetchall()}

    cur.execute("select team_code, bsl_team_slug from euroleague.team_bsl_link")
    pairs = cur.fetchall()
    matched, unmatched = [], []
    for el_code, bsl_slug in pairs:
        cur.execute("""select distinct person_code, coalesce(passport_name,''), coalesce(passport_surname,''), name
                       from euroleague.players where team_code=%s""", (el_code,))
        el_players = cur.fetchall()
        cur.execute("select player_slug, player_name from basketball.players where team_slug=%s", (bsl_slug,))
        bsl_players = [(slug, name, fold_tokens(name)) for slug, name in cur.fetchall()]
        for pcode, pn, ps, name in el_players:
            el_sur = fold_tokens(ps) or fold_tokens((name.split(",")[0] if "," in name else name))
            el_giv = fold_tokens(pn) or fold_tokens((name.split(",")[1] if "," in name else ""))
            hit = next((b for b in bsl_players if match_player(el_sur, el_giv, b[2])), None)
            if not hit and pcode in MANUAL_LINKS:
                hit = (MANUAL_LINKS[pcode], "(manuel)", None)
            if hit:
                slug = canon.get(hit[0], hit[0])   # birlestirilmisse kanonik slug
                matched.append((pcode, slug, f"{pn} {ps}".strip(), hit[1]))
            else:
                unmatched.append((el_code, pcode, f"{pn} {ps}".strip() or name))

    print(f"=== ESLESEN: {len(matched)} ===")
    for pcode, slug, eln, bsln in matched:
        print(f"  {eln:32s} -> {bsln:28s} [{pcode} -> {slug}]")
    print(f"\n=== ESLESMEYEN EL oyuncular: {len(unmatched)} (BSL'de oynamamis olabilir) ===")
    for code, pcode, nm in unmatched:
        print(f"  {code} {nm} [{pcode}]")

    if not dry:
        for pcode, slug, *_ in matched:
            cur.execute("""insert into euroleague.player_bsl_link (person_code, bsl_player_slug, match_source)
                           values (%s,%s,'auto')
                           on conflict (person_code) do update set bsl_player_slug=excluded.bsl_player_slug""",
                        (pcode, slug))
        conn.commit()
        print(f"\n{len(matched)} eslesme yazildi (player_bsl_link).")
    else:
        conn.rollback()
        print("\nDRY-RUN: yazilmadi.")
    conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    run(a.dry_run)

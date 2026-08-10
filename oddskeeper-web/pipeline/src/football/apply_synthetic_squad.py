# -*- coding: utf-8 -*-
"""Sentetik kadro kayitlari: TM'de olup API-Football'da henuz olmayan oyuncular.

Iki mod:
  --seed : TM kadrolarini tarar, SEED_NAMES'teki (kuratif liste) oyunculari
           football.squad_synthetic_players'a yazar (takim/pozisyon/dogum/deger
           TM'den). Yeni eksikler cikinca listeye ad ekleyip tekrar kosulur.
  (varsayilan) apply : aktif sentetikleri team_squad_current'a upsert eder
           (source='synthetic-tm', source_player_id='tm<ID>'), piyasa degerini
           player_market_values'a yazar, dogum tarihini player_bio'ya ekler.
           API-Football oyuncuyu KENDISI eklediyse sentetik OTOMATIK emekli
           edilir (active=false) ve squad satiri silinir.

Gunluk zincirde apply modu kosulur (run_tsl_squad_refresh.sh adim 1b).
"""
from __future__ import annotations

import os
import re
import sys

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_transfermarkt_values import (  # noqa: E402
    BASE, LEAGUE_URL, fetch, norm, parse_squad, _name_match,
)

# Kuratif eksik listesi (2026-08-10 TM kiyas raporundan; yalniz net vakalar,
# isim-sirasi ters yanlis pozitifler haric). team_slug -> TM'deki tam adlar.
SEED_NAMES: dict[str, list[str]] = {
    "trabzonspor": ["Mohamed Salah", "John Lundstram"],
    "fenerbahce": ["Sofyan Amrabat", "Diego Carlos", "Dominik Livakovic"],
    "galatasaray": ["Mario Lemina", "Metehan Baltacı"],
    "besiktas": ["Moatasem Al-Musrati", "João Mário", "Jean Onana", "Élan Ricardo", "Can Keleş"],
    "amed": ["Gift Orban", "Alban Lafont", "David Bates", "Lumbardh Dellova",
             "Rayan Raveloson", "Ermal Krasniqi"],
    "corum": ["Alexandre Penetra", "Berat Özdemir", "Markus Karlsbakk",
              "Alexandros Kyziridis", "Jesús Ramírez"],
    "konyaspor": ["Arthur Masuaku"],
    "samsunspor": ["Igor Drapiński"],
    "erzurumspor": ["Festy Ebosele", "Nariman Akhundzada"],
    "kocaelispor": ["Metehan Altunbaş"],
    "alanyaspor": ["Baran Gezek", "Yusuf Özdemir"],
    "basaksehir": ["Francis Nzaba"],
    "eyupspor": ["Bilal Boutobba"],
}

STOPWORDS = {
    "fk", "sk", "as", "jk", "spor", "kulubu", "istanbul", "ankara",
    "buyuksehir", "belediye", "belediyesi", "genclik",
}

# TM pozisyon metni -> apifootball pozisyon sozlugu (team_squad_current.position).
def map_position(tm_pos: str | None) -> str | None:
    p = (tm_pos or "").lower()
    if "keeper" in p:
        return "Goalkeeper"
    if "back" in p or "defen" in p:
        return "Defender"
    if "midfield" in p:
        return "Midfielder"
    if any(k in p for k in ("winger", "forward", "striker", "attack")):
        return "Attacker"
    return None


def parse_squad_with_pos(html: str) -> list[dict]:
    """parse_squad + pozisyon metni (inline-table ikinci satiri)."""
    players = parse_squad(html)
    # chunk bazli pozisyon: isim satirindan sonraki ilk sade <td>Metin</td>
    row_chunks = re.split(r'<tr class="(?:odd|even)[^"]*">', html)[1:]
    pos_by_id: dict[str, str] = {}
    for chunk in row_chunks:
        pm = re.search(r'href="/[a-z0-9-]+/profil/spieler/(\d+)">', chunk)
        if not pm:
            continue
        tm = re.search(r"</table>", chunk)
        seg = chunk[: tm.start()] if tm else chunk
        pp = re.findall(r"<td>([A-Za-z][A-Za-z /-]+)</td>", seg)
        if pp:
            pos_by_id[pm.group(1)] = pp[-1].strip()
    for p in players:
        p["tm_position"] = pos_by_id.get(p["tm_id"])
    return players


def tokens(name: str) -> set[str]:
    return {t for t in norm(name).split() if len(t) >= 4}


def natural_exists(cur, source_team_id: str, tm_name: str) -> bool:
    """API-Football (dogal) kadroda bu oyuncu var mi? Kisaltma + ters-sira toleransli."""
    cur.execute(
        "select player_name from football.team_squad_current "
        "where source='apifootball' and source_team_id=%s",
        (source_team_id,),
    )
    tt = tokens(tm_name)
    rev = " ".join(reversed(norm(tm_name).split()))
    for (nm,) in cur.fetchall():
        if _name_match(tm_name, nm) or _name_match(rev, nm):
            return True
        # guclu token kesisimi (ad-soyad sirasi tamamen farkli yazimlar)
        if tt and len(tt & tokens(nm)) >= min(2, len(tt)):
            return True
    return False


def seed(cur) -> None:
    league_html = fetch(LEAGUE_URL)
    club_links = re.findall(
        r'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/(\d+)"', league_html
    )
    clubs: dict[str, str] = {}
    for tm_slug, tm_id, _s in club_links:
        clubs.setdefault(tm_id, tm_slug)

    cur.execute(
        """select distinct tm.team_slug, tm.display_name
           from ref.team_mapping tm
           join football.team_squad_current s on s.source_team_id = tm.source_team_id
           where tm.is_active"""
    )
    our_teams = cur.fetchall()

    def match_team(tm_slug: str):
        tm_tokens = set(norm(tm_slug.replace("-", " ")).split()) - STOPWORDS
        best, best_score = None, 0
        for team_slug, display_name in our_teams:
            toks = (set(norm(display_name).split()) | set(norm(team_slug).split("-"))) - STOPWORDS
            sc = len(tm_tokens & toks)
            if sc > best_score:
                best, best_score = team_slug, sc
        return best if best_score > 0 else None

    wanted_by_team = {k: {norm(n): n for n in v} for k, v in SEED_NAMES.items()}
    found = 0
    for tm_id, tm_slug in clubs.items():
        team_slug = match_team(tm_slug)
        if team_slug not in wanted_by_team:
            continue
        wanted = wanted_by_team[team_slug]
        squad_url = f"{BASE}/{clubs[tm_id]}/kader/verein/{tm_id}/saison_id/2026/plus/1"
        for p in parse_squad_with_pos(fetch(squad_url)):
            if norm(p["name"]) not in wanted:
                continue
            cur.execute(
                """insert into football.squad_synthetic_players
                     (tm_player_id, team_slug, player_name, position, birth_date,
                      market_value_eur, active, note)
                   values (%s,%s,%s,%s,%s,%s,true,'2026-08-10 TM kiyas raporu')
                   on conflict (tm_player_id) do update set
                     team_slug=excluded.team_slug, player_name=excluded.player_name,
                     position=excluded.position, birth_date=excluded.birth_date,
                     market_value_eur=excluded.market_value_eur""",
                (p["tm_id"], team_slug, p["name"], map_position(p.get("tm_position")),
                 p["birth"], p["value"]),
            )
            found += 1
            print(f"  seed: {team_slug} <- {p['name']} ({p.get('tm_position')}, "
                  f"{p['value'] and '€%.1fm' % (p['value']/1e6) or '-'})")
    print(f"seed tamam: {found} oyuncu yazildi/guncellendi")


def apply(cur) -> None:
    cur.execute(
        """select tm.team_slug, tm.source_team_id, tm.display_name
           from ref.team_mapping tm where tm.is_active"""
    )
    team_by_slug = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    cur.execute(
        """select tm_player_id, team_slug, player_name, position, birth_date, market_value_eur
           from football.squad_synthetic_players where active"""
    )
    rows = cur.fetchall()
    added = retired = 0
    for tm_id, team_slug, name, pos, birth, value in rows:
        if team_slug not in team_by_slug:
            print(f"  UYARI: takim eslenemedi: {team_slug} ({name})")
            continue
        src_team_id, team_name = team_by_slug[team_slug]
        syn_pid = f"tm{tm_id}"
        if natural_exists(cur, src_team_id, name):
            # API-Football yetisti: sentetigi emekli et.
            cur.execute(
                "update football.squad_synthetic_players set active=false, retired_at=now() "
                "where tm_player_id=%s", (tm_id,))
            cur.execute(
                "delete from football.team_squad_current where source='synthetic-tm' "
                "and source_player_id=%s", (syn_pid,))
            retired += 1
            print(f"  emekli: {name} ({team_slug}) - API-Football kadroya ekledi")
            continue
        cur.execute(
            """insert into football.team_squad_current
                 (source, source_team_id, team_name, source_player_id, player_name, position, fetched_at)
               values ('synthetic-tm', %s, %s, %s, %s, %s, now())
               on conflict do nothing""",
            (src_team_id, team_name, syn_pid, name, pos),
        )
        # Dogum tarihi (TM deger eslesmesi + profil icin) - varsa dokunma.
        if birth:
            cur.execute(
                "select 1 from football.player_bio where source='apifootball' and source_player_id=%s",
                (syn_pid,))
            if not cur.fetchone():
                cur.execute(
                    """insert into football.player_bio (source, source_player_id, full_name, birth_date)
                       values ('apifootball', %s, %s, %s)""",
                    (syn_pid, name, birth),
                )
        # Piyasa degeri dogrudan (TM adimini beklemeden).
        if value:
            cur.execute(
                """insert into football.player_market_values
                     (apifootball_player_id, player_slug, tm_player_id, tm_player_name,
                      market_value_eur, team_slug, fetched_at)
                   values (%s, null, %s, %s, %s, %s, now())
                   on conflict (apifootball_player_id) do update set
                     tm_player_id=excluded.tm_player_id, tm_player_name=excluded.tm_player_name,
                     market_value_eur=excluded.market_value_eur, team_slug=excluded.team_slug,
                     fetched_at=now()""",
                (syn_pid, tm_id, name, value, team_slug),
            )
        added += 1
    print(f"apply tamam: {added} sentetik kadroda, {retired} emekli edildi")


def main() -> None:
    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()
    if "--seed" in sys.argv:
        seed(cur)
    apply(cur)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()

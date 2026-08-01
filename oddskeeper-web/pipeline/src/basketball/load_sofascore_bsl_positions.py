"""BSL oyuncu POZISYON (+ boy) yükleyici — kaynak SofaScore.

TBF pozisyon yayınlamıyor; SofaScore geçmiş maç lineup'larında oyuncu pozisyonu
(G / GF / F / FC / C) + boy VAR. Bu script tarayıcıda üretilen JSON'u okur, isim
eşleştirmesiyle basketball.players'a position / height_cm / sofascore_player_id yazar.

SofaScore geo-kısıtlı DEĞİL ama Cloudflare korumalı → headless curl/curl_cffi 403,
VPS/playwright de datacenter IP'de CF'yi geçemiyor. ÇALIŞAN YÖNTEM: tarayıcı panelinde
sofascore.com açıp same-origin fetch (repo'nun yerleşik SofaScore deseni). Aşağıdaki
snippet 25/26 (season 81036) tüm maç lineup'larından pozisyonları toplar:

    // sofascore.com konsolunda:
    const S=519, SEASON=81036, ids=[];
    for(let p=0;p<20;p++){const j=await(await fetch(`/api/v1/unique-tournament/${S}/season/${SEASON}/events/last/${p}`)).json();
      (j.events||[]).forEach(e=>{if(e.status?.type==='finished')ids.push(e.id)}); if(!j.hasNextPage)break;}
    const pos={};
    for(const id of ids){try{const lu=await(await fetch(`/api/v1/event/${id}/lineups`)).json();
      for(const s of['home','away'])for(const e of(lu[s]?.players||[])){const pl=e.player||{};if(!pl.id)continue;
        const p=e.position||pl.position;if(!p)continue;
        pos[pl.id]={id:pl.id,name:pl.name,pos:p,jersey:e.jerseyNumber||null,height:pl.height||null};}}
      catch(x){} await new Promise(r=>setTimeout(r,120));}
    copy(JSON.stringify(Object.values(pos)));   // → data/sofascore/bsl_positions_<sezon>.json

Kullanım:
    python src/basketball/load_sofascore_bsl_positions.py data/sofascore/bsl_positions_2025-2026.json [--dry-run]

Not: pozisyon oyuncu-boyutu özelliğidir (maç bağımsız); tekrar çalıştırmak idempotent.
sofascore_player_id yazıldığından sonraki yüklemeler kimlik-stabil olur.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from collections import Counter

import psycopg2
from dotenv import load_dotenv

# DB'deki isim → SofaScore player id. Otomatik eşleşmeyen açık yazım/takma-ad
# varyasyonları (2026-08-02 kontrolüyle doğrulandı). Anahtar norm() sonucudur.
ALIAS = {
    "deshane davis larkin": 817223,     # Shane Larkin
    "caleb homesly": 1412212,           # Caleb Homesley
    "michael soloman smith": 1134016,   # Mike Smith
    "jayden amari scrubb": 1092895,     # Jay Scrubb
    "joshua artee roberts": 1700298,    # Josh Roberts
    "isiah whaley": 1179041,            # Isaiah Whaley
    "micheal jaden devoe": 1179653,     # Michael Devoe
    "gabriel olaseni": 1179324,         # Olaseni Gabe (ad-soyad ters)
    # None → ZORLA eşleşmesiz bırak (yanlış subset eşleşmesini engelle):
    "cengiz sarp coskun": None,         # DB Bahçeşehir genci ≠ SofaScore "Cengiz Coskun" (Bosna kulübü)
}


def norm(s: str) -> str:
    """TR → ascii, küçük harf, noktalama temiz."""
    s = s or ""
    for a, b in [("İ", "i"), ("I", "i"), ("ı", "i"), ("Ş", "s"), ("ş", "s"),
                 ("Ğ", "g"), ("ğ", "g"), ("Ç", "c"), ("ç", "c"),
                 ("Ö", "o"), ("ö", "o"), ("Ü", "u"), ("ü", "u")]:
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokset(s: str) -> frozenset:
    return frozenset(t for t in norm(s).split() if len(t) > 1)


def build_matcher(sofa):
    by_norm, tok = {}, []
    for p in sofa:
        by_norm.setdefault(norm(p["name"]), p)
        tok.append((tokset(p["name"]), p))
    sofa_freq = Counter()
    for st, _ in tok:
        for t in st:
            if len(t) >= 4:
                sofa_freq[t] += 1
    return by_norm, tok, sofa_freq


def match_player(dbname, by_norm, tok, sofa_freq, db_freq, by_id):
    n = norm(dbname)
    if n in ALIAS:
        aid = ALIAS[n]
        if aid is None:
            return None, "blocked"
        if aid in by_id:
            return by_id[aid], "alias"
    if n in by_norm:
        return by_norm[n], "exact"
    dt = tokset(dbname)
    if not dt:
        return None, None
    subset = []
    for st, p in tok:
        if dt == st:
            return p, "tokeq"
        if dt <= st or st <= dt:
            subset.append(p)
    if len(subset) == 1:
        return subset[0], "subset"
    # jaccard
    best = None; b1 = 0.0; b2 = 0.0
    for st, p in tok:
        inter = len(dt & st); uni = len(dt | st)
        sc = inter / uni if uni else 0.0
        if sc > b1:
            b2 = b1; b1 = sc; best = p
        elif sc > b2:
            b2 = sc
    if b1 >= 0.6 and b1 - b2 >= 0.2:
        return best, f"jaccard"
    # soyad-çapa: her iki havuzda frekansı 1 olan >=4 harfli paylaşılan token.
    # TUZAK: aynı soyadı taşıyan FARKLI kişiler (Buğrahan↔Ahmet Tuncer, Dae Dae↔Grant
    # Octavon). O yüzden soyad dışı adların da UYUMLU olmasını şart koş.
    hits = []
    for st, p in tok:
        shared = {t for t in (dt & st) if len(t) >= 4 and sofa_freq[t] == 1 and db_freq[t] == 1}
        if not shared:
            continue
        sur = next(iter(shared))
        if _first_name_compat(dt - {sur}, st - {sur}):
            hits.append(p)
    uniq = {id(x): x for x in hits}
    if len(uniq) == 1:
        return next(iter(uniq.values())), "surname"
    return None, ("ambig" if subset else None)


def _edit_le1(a, b):
    """Levenshtein <=1 (Pako↔Paco)."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la == lb:
        return sum(x != y for x, y in zip(a, b)) == 1
    if la > lb:
        a, b = b, a
    i = j = diff = 0
    while i < len(a) and j < len(b):
        if a[i] != b[j]:
            diff += 1
            if diff > 1:
                return False
            j += 1
        else:
            i += 1; j += 1
    return True


def _first_name_compat(a_toks, b_toks):
    """Soyad dışı adlardan en az biri uyumlu mu? (prefix>=3 / içerme / edit<=1)"""
    for x in a_toks:
        for y in b_toks:
            if x == y:
                return True
            if len(x) >= 3 and len(y) >= 3 and (x[:3] == y[:3] or x in y or y in x):
                return True
            if _edit_le1(x, y):
                return True
    return False


def run(args):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    sofa = json.load(open(args.json_file, encoding="utf-8"))
    by_id = {p["id"]: p for p in sofa}
    by_norm, tok, sofa_freq = build_matcher(sofa)

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("select player_slug, player_name, team_name from basketball.players")
    players = [{"slug": r[0], "name": r[1], "team": r[2]} for r in cur.fetchall()]

    db_freq = Counter()
    for d in players:
        for t in tokset(d["name"]):
            if len(t) >= 4:
                db_freq[t] += 1

    updates, unmatched = [], []
    for d in players:
        p, how = match_player(d["name"], by_norm, tok, sofa_freq, db_freq, by_id)
        if p and how not in (None, "ambig"):
            updates.append((d["slug"], d["name"], p, how))
        else:
            unmatched.append((d["name"], d["team"], how))

    print(f"[pos] DB oyuncu: {len(players)}  SofaScore oyuncu: {len(sofa)}", flush=True)
    print(f"[pos] EŞLEŞEN: {len(updates)}/{len(players)} ({100*len(updates)/len(players):.1f}%)", flush=True)
    by_how = Counter(u[3] for u in updates)
    print(f"[pos] yöntem dağılımı: {dict(by_how)}", flush=True)
    print(f"[pos] EŞLEŞMEYEN: {len(unmatched)} (SofaScore'da yok / dip-kadro):", flush=True)
    for name, team, how in unmatched:
        print(f"        - {name} [{team}]", flush=True)

    if args.dry_run:
        print("\n[pos] DRY-RUN — DB yazılmadı.", flush=True)
        for slug, name, p, how in updates[:12]:
            print(f"    {name:32s} -> {p['name']:28s} pos={p['pos']:3s} ({how})", flush=True)
        conn.close()
        return

    n = 0
    for slug, name, p, how in updates:
        cur.execute(
            """update basketball.players
               set position=%s, height_cm=%s, sofascore_player_id=%s,
                   position_source='sofascore', updated_at=now()
               where player_slug=%s""",
            (p["pos"], p.get("height"), p["id"], slug))
        n += cur.rowcount
    conn.commit()
    print(f"\n[pos] YAZILDI: {n} oyuncu güncellendi (position + height_cm + sofascore_player_id).", flush=True)
    conn.close()


def main():
    ap = argparse.ArgumentParser(description="BSL pozisyon yükleyici (SofaScore JSON)")
    ap.add_argument("json_file", help="data/sofascore/bsl_positions_<sezon>.json")
    ap.add_argument("--dry-run", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()

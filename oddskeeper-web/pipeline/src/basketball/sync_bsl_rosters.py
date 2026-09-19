"""BSL sezon-öncesi kadro + kimlik eşitleme (RealGM + SofaScore → basketball.*).

Kaynak rolleri (2026-09-19 ölçümü):
  RealGM     transferleri bilir (kim NEREDE), oyuncu sayfasında doğum tarihi verir; ama bazı
             takımlar eksik (Bursaspor 1, Karşıyaka 3 oyuncu) ve veri hatası içerebilir.
  SofaScore  DB'de 280/300 oyuncunun id'si hazır (isimsiz köprü), doğum tarihi/pozisyon/boy
             verir; ama resmi maç oynamamış takımlarda kadro GEÇEN SEZONUN (bayat).
Bu yüzden: KİMLİK = SofaScore id + doğum tarihi, ÜYELİK = RealGM (yeterli kapsıyorsa),
yoksa SofaScore "doğrulanmamış" işaretiyle. TBF kadro vermez; tbf id maç oynanınca gelir.

Eşleme kademesi (otomatik fuzzy YOK; ölçümde soyad-kademesinin yarısı yanlıştı):
  id            SofaScore id DB'de kayıtlı
  exact         normalize isim kümesi eşit (dob çelişirse: aynı yıl → kabul+uyarı, değilse onay)
  subset+dob    alt küme isim + doğum tarihi eşit
  surname+dob   soyad eşit + doğum tarihi eşit   (Yunus/Emre Sonsırma, James/Metecan Birsen)
  glued+dob     soyad bitişik/ayrık yazım + doğum tarihi eşit   (DeJulius / De Julius)
  → kalanlar ONAY listesine düşer; onaydaki oyuncu için YENİ kayıt AÇILMAZ (mükerrer riski).

Girdi JSON'ları tarayıcıda üretilir (SofaScore/RealGM düz HTTP'ye 403 verir; yerleşik
yöntem = sayfa içi same-origin fetch). Şekil:
  data/basketball/rosters_<sezon>_sofascore.json  {"teams":[{id,name,slug}], "players":[{id,name,team_id,pos,cm,cc,dob}]}
  data/basketball/rosters_<sezon>_realgm.json     {"teams":[{id,name,slug}], "players":[{id,name,team_id,pos,cm,nat,dob}]}
"slug" = basketball.teams.team_slug (elle eşlenir; yeni takımda yeni slug).

    python src/basketball/sync_bsl_rosters.py --season-label 2026-2027            # rapor
    python src/basketball/sync_bsl_rosters.py --season-label 2026-2027 --apply    # yaz
"""
import argparse
import json
import os
import sys
from collections import defaultdict

import psycopg2
from dotenv import load_dotenv

from identity import fuzzy_tier, name_tokens, slugify

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data", "basketball")
REALGM_MIN_ROSTER = 8      # altındaysa RealGM o takımı kapsamıyor say → SofaScore'a düş


def load(season, source):
    with open(os.path.join(DATA, f"rosters_{season}_{source}.json"), encoding="utf-8") as f:
        d = json.load(f)
    slug_of = {t["id"]: t["slug"] for t in d["teams"]}
    for p in d["players"]:
        p["team"] = slug_of[p["team_id"]]
        p["toks"] = name_tokens(p["name"])
    return d


def tier_of(a, b):
    """a,b: {'toks','dob'} → kademe ya da None.

    Doğum tarihi kaynaklar arasında HATALI olabilir (Vitto Brown: RealGM 13.07, SofaScore
    31.07) → tam isimde aynı YIL yeter; yıl da farklıysa onaya düşer. Tam-dışı isimde dob
    çelişkisi = farklı kişi (Jordan 1988 ≠ Jordon Crawford 1990)."""
    if not a["toks"] or not b["toks"]:
        return None
    both = bool(a.get("dob") and b.get("dob"))
    same = both and a["dob"] == b["dob"]
    if set(a["toks"]) == set(b["toks"]):
        if both and not same:
            return "exact~dob" if a["dob"][:4] == b["dob"][:4] else "exact!dob"
        return "exact"
    ft = fuzzy_tier(a["toks"], b["toks"])
    if both and not same:
        return "subset!dob" if ft == "subset" and a["dob"][:4] == b["dob"][:4] else None
    if ft == "subset":
        return "subset+dob" if same else "subset?"
    if ft in ("surname", "surname+firstprefix"):
        return "surname+dob" if same else "surname?"
    if same:                           # "DeJulius" ↔ "De Julius": soyad öbür ismin içinde bitişik
        ja, jb = "".join(a["toks"]), "".join(b["toks"])
        if (len(a["toks"][-1]) >= 4 and a["toks"][-1] in jb) or (len(b["toks"][-1]) >= 4 and b["toks"][-1] in ja):
            return "glued+dob"
    return None


def near_same_name(a, b):
    """Aynı sayıda token, biri hariç hepsi eşit, o da tek harf farkla (Jordan/Jordon)."""
    if len(a) != len(b):
        return False
    diff = [(x, y) for x, y in zip(a, b) if x != y]
    if len(diff) != 1:
        return False
    x, y = diff[0]
    if abs(len(x) - len(y)) > 1:
        return False
    if len(x) == len(y):
        return sum(c != d for c, d in zip(x, y)) == 1
    lo, hi = sorted((x, y), key=len)
    return any(hi[:i] + hi[i + 1:] == lo for i in range(len(hi)))


AUTO = ("exact", "exact~dob", "subset+dob", "surname+dob", "glued+dob")
ORDER = AUTO + ("exact!dob", "subset!dob", "subset?", "surname?")


def best_match(p, pool):
    """→ (kademe, aday, belirsiz_mi). Aynı kademede birden çok aday = belirsiz."""
    found = defaultdict(list)
    for q in pool:
        t = tier_of(p, q)
        if t:
            found[t].append(q)
    for t in ORDER:
        if found[t]:
            return t, found[t][0], len(found[t]) > 1
    return None, None, False


def run(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(HERE, "..", "..", ".env"))
    season = args.season_label
    sofa, rgm = load(season, "sofascore"), load(season, "realgm")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("select alias_slug, canonical_slug from analytics.bb_pm_player_merges")
    canon = dict(cur.fetchall())
    cur.execute("""select player_slug, player_name, sofascore_player_id, realgm_player_id, birth_date::text
                   from basketball.players""")
    db = [dict(slug=r[0], name=r[1], sofa=r[2], realgm=r[3], dob=r[4], toks=name_tokens(r[1]))
          for r in cur.fetchall()]
    db = [d for d in db if d["slug"] not in canon]            # alias slug'lar aday değil
    by_sofa = {d["sofa"]: d for d in db if d["sofa"]}
    by_slug = {d["slug"]: d for d in db}

    # Bu sezonun SofaScore listesinde OLMAYAN DB oyuncularının doğum tarihi (opsiyonel dosya;
    # /api/v1/player/{id} ile toplanır). DB tarafında dob olunca isim eşleşmeleri doğrulanır.
    extra = os.path.join(DATA, "dob_by_sofascore_id.json")
    if os.path.exists(extra):
        with open(extra, encoding="utf-8") as f:
            for sid, dob in json.load(f).items():
                d = by_sofa.get(int(sid))
                if d and dob:
                    d["dob"] = d["dob"] or dob

    person = {}                      # sofascore id → DB kaydı (ya da None = yeni oyuncu)
    review, dob_warn = [], []
    # ---- 1) SofaScore → DB: id
    for s in sofa["players"]:
        d = by_sofa.get(s["id"])
        if d:
            person[s["id"]] = d
            d["dob"] = d["dob"] or s.get("dob")

    # ---- 2) RealGM → DB doğrudan (realgm id + dob DB kaydına işlenir)
    for r in rgm["players"]:
        t, q, amb = best_match(r, db)
        if t == "exact~dob" and not amb:
            dob_warn.append((r["name"], r.get("dob"), q["slug"], q["dob"]))
        if t in AUTO and not amb:
            q["realgm"] = q["realgm"] or r["id"]
            q["dob"] = q["dob"] or r.get("dob")
            r["_db"] = q
        elif t:
            r["_hold"] = True
            review.append(("realgm→db", r, q, t))

    # ---- 2b) id'siz SofaScore oyuncusu → DB (artık RealGM'den gelen dob ile)
    for s in sofa["players"]:
        if s["id"] in person:
            continue
        t, q, amb = best_match(s, db)
        if t in AUTO and not amb and q["sofa"] and (t == "exact" and not (q["dob"] and s.get("dob"))):
            t = "exact?"               # başka sofascore id'li kayda yalnız dob-doğrulu bağlan
        if t in AUTO and not amb:
            person[s["id"]] = q
            if q["sofa"]:              # SofaScore aynı kişiye ikinci id açmış (dob eşit) → id'yi EZME
                print(f"  not: SofaScore mukerrer id {s['id']} '{s['name']}' = DB {q['slug']} ({q['sofa']})")
            else:
                q.update(sofa=s["id"], dob=q["dob"] or s.get("dob"), _new_sofa=True)
        else:
            person[s["id"]] = None
            if t:
                s["_hold"] = True
                review.append(("sofascore→db", s, q, t))

    # ---- 2c) RealGM ↔ SofaScore (yeni oyuncuda iki kaynağı tek kişide birleştirir)
    sofa_of_rgm = {}
    for r in rgm["players"]:
        t, q, amb = best_match(r, sofa["players"])
        if t in AUTO and not amb:
            sofa_of_rgm[r["id"]] = q
            d = person.get(q["id"])
            if d and r.get("_db") and r["_db"] is not d:
                review.append(("realgm↔sofascore farkli DB kaydi", r, q, t))
            elif d:
                d["realgm"] = d["realgm"] or r["id"]
        elif t and not r.get("_db"):
            r["_hold"] = True
            review.append(("realgm→sofascore", r, q, t))

    # ---- 3) 26/27 üyelik. RealGM satırı her zaman kazanır (transferi bilen o).
    # SofaScore-only oyuncu yalnız iki durumda eklenir: RealGM takımı kapsamıyorsa, ya da
    # SofaScore o takımda GÜNCELSE (RealGM kadrosuyla örtüşme ≥ %50; bayat kadroda ≤ %30).
    rgm_by_team, sofa_by_team = defaultdict(list), defaultdict(list)
    for r in rgm["players"]:
        rgm_by_team[r["team"]].append(r)
    for s in sofa["players"]:
        sofa_by_team[s["team"]].append(s)
    roster, placed = [], set()         # (team, kaynak, doğrulandı, db kaydı|None, realgm, sofascore)

    def key(d, r, s):
        return d["slug"] if d else (("s", s["id"]) if s else ("r", r["id"]))

    for team in sorted({t["slug"] for t in sofa["teams"]}):
        s_ids = {s["id"] for s in sofa_by_team.get(team, [])}
        for r in rgm_by_team.get(team, []):
            s = sofa_of_rgm.get(r["id"])
            d = (person.get(s["id"]) if s else None) or r.get("_db")
            if key(d, r, s) not in placed:
                placed.add(key(d, r, s))
                roster.append((team, "realgm", bool(s and s["id"] in s_ids), d, r, s))
    for team in sorted({t["slug"] for t in sofa["teams"]}):
        R, S = rgm_by_team.get(team, []), sofa_by_team.get(team, [])
        overlap = sum(1 for r in R if (sofa_of_rgm.get(r["id"]) or {}).get("team") == team)
        if len(R) >= REALGM_MIN_ROSTER and overlap < 0.5 * len(R):
            continue                   # SofaScore bu takımda bayat → fazlalıkları ALMA
        for s in S:
            d = person.get(s["id"])
            if key(d, None, s) not in placed and ("s", s["id"]) not in placed:
                placed.add(key(d, None, s))
                roster.append((team, "sofascore", False, d, None, s))

    # ---- rapor
    n_known = sum(1 for x in roster if x[3])
    print(f"SofaScore {len(sofa['players'])} | RealGM {len(rgm['players'])} | DB {len(db)} (alias haric)")
    print(f"26/27 kadro satiri {len(roster)}: DB'de mevcut {n_known}, YENI oyuncu {len(roster) - n_known}")
    print(f"yeni sofascore id bulunan DB oyuncusu: {[d['slug'] for d in db if d.get('_new_sofa')]}")
    for team in sorted({x[0] for x in roster}):
        rows = [x for x in roster if x[0] == team]
        print(f"  {team:26s} {rows[0][1]:9s} n={len(rows):2d} mevcut={sum(1 for x in rows if x[3]):2d} "
              f"iki-kaynak-dogrulu={sum(1 for x in rows if x[2]):2d}")
    for w in dob_warn:
        print(f"  dob uyusmuyor (ayni yil, isim tam -> kabul): {w[0]} {w[1]} ~ {w[2]} {w[3]}")
    print("\nDIKKAT: yeni sayilan ama benzer isimli kayit var (dogum tarihi FARKLI; kaynak hatasi olabilir):")
    for team, source, confirmed, d, r, s2 in roster:
        if d is not None:
            continue
        src = s2 or r
        for q in db + sofa["players"]:
            if q is src or not (src.get("dob") and q.get("dob")) or src["dob"] == q["dob"]:
                continue
            ft = fuzzy_tier(src["toks"], q["toks"])
            if near_same_name(src["toks"], q["toks"]):
                src["_hold"] = True    # yeni kayıt AÇMA: büyük olasılıkla kaynak yanlış kişiyi bağlamış
            if set(src["toks"]) == set(q["toks"]) or ft in ("subset", "surname+firstprefix"):
                print(("  [BEKLETILDI] " if src.get("_hold") else "  ") + f"{src['name']} ({src['dob']}, {team}) ~ {q['name']} ({q['dob']}, {q.get('slug') or q.get('team')})")
    print(f"\nONAY GEREKEN ({len(review)}):")
    for kind, a, b, t in review:
        bn = b.get("name") if b else None
        print(f"  [{kind}] {t:10s} {a['name']} ({a.get('dob')}, {a['team']}) ~ {bn} "
              f"({(b or {}).get('dob')}, {(b or {}).get('team') or (b or {}).get('slug')})")

    if args.report_json:
        out = {"roster": [{"team": x[0], "source": x[1], "confirmed": x[2],
                           "slug": x[3]["slug"] if x[3] else None,
                           "name": (x[4] or x[5])["name"],
                           "realgm_id": x[4]["id"] if x[4] else None,
                           "sofascore_id": x[5]["id"] if x[5] else None} for x in roster],
               "review": [{"kind": k, "tier": t, "a": {f: a.get(f) for f in ("id", "name", "dob", "team")},
                           "b": {f: (b or {}).get(f) for f in ("id", "slug", "name", "dob", "team")}}
                          for k, a, b, t in review]}
        with open(args.report_json, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)

    if not args.apply:
        print("\nRAPOR modu (DB yazilmadi). Yazmak icin --apply.")
        conn.close()
        return

    # ---- yazım: (a) mevcut oyuncu kimlikleri  (b) yeni oyuncular  (c) sezon kadrosu
    n_id = 0
    for d in db:
        cur.execute("""update basketball.players set
                           sofascore_player_id = coalesce(sofascore_player_id, %s),
                           realgm_player_id    = coalesce(realgm_player_id, %s),
                           birth_date          = coalesce(birth_date, %s::date),
                           updated_at = now()
                       where player_slug=%s and (
                           (sofascore_player_id is null and %s is not null) or
                           (realgm_player_id is null and %s is not null) or
                           (birth_date is null and %s is not null))""",
                    (d["sofa"], d["realgm"], d["dob"], d["slug"], d["sofa"], d["realgm"], d["dob"]))
        n_id += cur.rowcount
    used = set(by_slug) | set(canon)
    n_new = n_roster = 0
    cur.execute("delete from basketball.team_rosters where season_label=%s and source in ('realgm','sofascore')",
                (season,))
    n_hold = 0
    for team, source, confirmed, d, r, s in roster:
        if d is None and ((r or {}).get("_hold") or (s or {}).get("_hold")):
            n_hold += 1                # kimligi onay bekliyor -> yeni kayit acma, kadroya yazma
            continue
        if d is None:
            src = s or r
            src["name"] = src["name"].replace("i\u0307", "i")   # SofaScore "Kadir" artigi: I-noktali.lower() = i + U+0307
            slug = slugify(src["name"])
            if slug in used:
                slug = f"{slug}-{(s or r)['id']}"
            used.add(slug)
            cur.execute("""insert into basketball.players (player_slug, player_name, season_label,
                               sofascore_player_id, realgm_player_id, birth_date, position, height_cm,
                               country_code, position_source)
                           values (%s,%s,%s,%s,%s,%s::date,%s,%s,%s,%s)""",
                        (slug, src["name"], season, s["id"] if s else None, r["id"] if r else None,
                         (s or {}).get("dob") or (r or {}).get("dob"), (s or {}).get("pos"),
                         (s or {}).get("cm") or (r or {}).get("cm"), (s or {}).get("cc"),
                         "sofascore" if s and s.get("pos") else None))
            d = {"slug": slug}
            n_new += 1
        cur.execute("""insert into basketball.team_rosters (season_label, team_slug, player_slug, source, confirmed)
                       values (%s,%s,%s,%s,%s)
                       on conflict (season_label, player_slug) do update set
                           team_slug=excluded.team_slug, source=excluded.source,
                           confirmed=excluded.confirmed, updated_at=now()""",
                    (season, team, d["slug"], source, confirmed))
        n_roster += 1
    conn.commit()
    conn.close()
    print(f"\nYAZILDI: {n_id} oyuncuda kimlik alani, {n_new} yeni oyuncu, {n_roster} kadro satiri "
          f"({n_hold} satir onay bekledigi icin atlandi).")


def main():
    ap = argparse.ArgumentParser(description="BSL sezon-oncesi kadro + kimlik esitleme")
    ap.add_argument("--season-label", required=True)
    ap.add_argument("--report-json", help="kadro + onay listesini bu dosyaya yaz")
    ap.add_argument("--apply", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()

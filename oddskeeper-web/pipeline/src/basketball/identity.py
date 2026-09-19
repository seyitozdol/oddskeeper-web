"""BSL kimlik çözümleme: TBF playerId / teamId → MEVCUT player_slug / team_slug.

NEDEN: eski veri (excel_v38) tbf id taşımıyor. Scraper yalnız tbf id ile arayınca
dönen her oyuncu/takım yeni slug alıp geçmişinden kopuyordu (2026-09-19 tespiti).
Ayrıca TBF takım adları sponsorlu ("Beşiktaş GAİN") → slugify yeni takım açardı.

KURAL: kimlik bir kez kurulur, id olarak saklanır, bir daha isimle eşlenmez.
  1) tbf id DB'de varsa → o slug (isim hiç okunmaz).
  2) Yoksa, tbf id'siz mevcut kayıtlarda TAM isim eşleşmesi (normalize token kümesi
     eşit, merge tablosuyla kanoniğe indirgenmiş) TEK adaya çıkıyorsa → bağla.
     DB isimleri zaten TBF kökenli olduğundan dönen oyuncuların çoğu burada tutar.
     2b) Tam tutmazsa: alt küme isim + aynı takım + tek aday → bağla.
  3) Tutmazsa YENİ slug açılır (scraper durmaz). Benzer bir mevcut oyuncu varsa
     (alt küme / soyad) kayıt basketball.identity_review kuyruğuna düşer; insan
     analytics.bb_pm_player_merges ile birleştirir. Otomatik fuzzy bağlama YOK:
     ölçümde soyad-kademesi eşleşmelerin yarısı yanlıştı (Vitto≠Anthony Brown).

Saf fonksiyonlar (name_tokens, match_team_slug, display_name, fuzzy_tier) DB'siz
test edilebilir.
"""
import json
import re
import unicodedata

_TR = str.maketrans({"ı": "i", "İ": "i", "I": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
                     "ç": "c", "Ç": "c", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u",
                     # NFKD ile ASCII'ye AYRIŞMAYAN Latin harfler (participant-id-mapping dersi)
                     "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ø": "o", "Ø": "o", "ß": "ss",
                     "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe", "þ": "th", "Þ": "th"})
_SUFFIX = {"jr", "sr", "ii", "iii", "iv"}
_TR_ONLY = set("çğıöşüÇĞİÖŞÜ")


def slugify(name: str) -> str:
    """Türkçe → ascii, küçük harf, tireli. Futbol/basketbol slug konvansiyonu."""
    s = (name or "").translate(_TR)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def name_tokens(name: str) -> list:
    """Karşılaştırma için normalize token listesi.

    Türkçe katlama + NFKD aksan sökme (İ.lower() artığı U+0307 dahil), "P.J."→"pj",
    Jr/Sr/II/III/IV ekleri atılır ("Bonzie Colson Iı" = "Bonzie Colson")."""
    s = (name or "").translate(_TR)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"(?<=\b[a-z])\.(?=[a-z]\b)", "", s)
    s = re.sub(r"[.,'’`]", "", s)
    return [t for t in re.sub(r"[^a-z0-9]+", " ", s).split() if t not in _SUFFIX]


def name_key(name: str) -> frozenset:
    return frozenset(name_tokens(name))


def fuzzy_tier(a: list, b: list):
    """TAM-DIŞI benzerlik kademesi (yalnız inceleme önerisi için, bağlamak için DEĞİL)."""
    sa, sb = set(a), set(b)
    if not sa or not sb or sa == sb:
        return None
    if (sa <= sb or sb <= sa) and len(sa & sb) >= 2:
        return "subset"
    if a[-1] == b[-1] and a[0][:3] == b[0][:3]:
        return "surname+firstprefix"
    if a[-1] == b[-1]:
        return "surname"
    # "DeJulius" ↔ "De Julius": aynı ad + soyad öbür ismin içinde bitişik
    if a[0] == b[0] and ((len(a[-1]) >= 4 and a[-1] in "".join(b)) or (len(b[-1]) >= 4 and b[-1] in "".join(a))):
        return "glued"
    return None


def display_name(raw: str) -> str:
    """TBF ham adı → gösterim adı. TAMAMI BÜYÜK ise başlık düzenine çevir.

    Türkçe'ye özgü harf varsa Türkçe kurallı küçültme (I→ı, İ→i), yoksa düz ASCII
    (I→i). Excel döneminin "Deshane Davıs Larkın" bozulmasını üretmez."""
    s = re.sub(r"\s+", " ", raw or "").strip()
    if not s or s != s.upper():
        return s
    turkish = any(c in _TR_ONLY for c in s)

    def lower(w):
        if turkish:
            w = w.replace("I", "ı").replace("İ", "i")
        return w.lower()

    def cap(w):
        if not w:
            return w
        head = w[0]
        if turkish and head == "i":
            head = "İ"
        elif turkish and head == "ı":
            head = "I"
        else:
            head = head.upper()
        return head + w[1:]

    out = []
    for word in s.split(" "):
        out.append("-".join(cap(lower(p)) for p in word.split("-")))
    return " ".join(out)


# TBF sponsorlu/uzun adı → kalıcı takım slug'ı. Anahtar, normalize adın İÇİNDE aranır
# ("aliaga petkimspor" içinde "petkim"). Tek slug'a çıkmıyorsa bağlanmaz.
# "korfez": Manisa Basket 2026'da Glint Körfez adını aldı (SofaScore 268256 slug
# manisa-bbsk + RealGM takım 2017 süreklilik gösteriyor).
TEAM_KEYWORDS = [
    ("efes", "anadolu-efes"), ("bahcesehir", "bahcesehir-koleji"), ("besiktas", "besiktas"),
    ("bursaspor", "bursaspor"), ("buyukcekmece", "buyukcekmece"), ("erokspor", "erokspor"),
    ("fenerbahce", "fenerbahce"), ("galatasaray", "galatasaray"), ("karsiyaka", "karsiyaka"),
    ("manisa", "manisa-basket"), ("korfez", "manisa-basket"),
    ("merkezefendi", "merkezefendi-belediyesi"), ("mersin", "mersin-bsb"),
    ("petkim", "aliaga-petkim-spor"), ("tofas", "tofas"), ("trabzonspor", "trabzonspor"),
    ("telekom", "turk-telekom"),
    ("denizli", "merkezefendi-belediyesi"),
    # 2026-27 yükselenler: Çayırova Belediyespor + Bandırma Bordo (SofaScore "Bordo BK",
    # RealGM "Bordo Sportif Balikesir").
    ("cayirova", "cayirova-belediyesi"),
    ("bordo", "bandirma-bordo"), ("bandirma", "bandirma-bordo"), ("balikesir", "bandirma-bordo"),
]


def match_team_slug(tbf_name: str):
    joined = " ".join(name_tokens(tbf_name))
    hits = {slug for kw, slug in TEAM_KEYWORDS if kw in joined}
    return next(iter(hits)) if len(hits) == 1 else None


# ------------------------------- DB katmanı -------------------------------
def _review(cur, kind, source_id, source_name, team_slug, season_label, assigned_slug,
            reason, candidates):
    cur.execute("""
        insert into basketball.identity_review
            (kind, source_id, source_name, team_slug, season_label, assigned_slug, reason, candidates)
        values (%s,%s,%s,%s,%s,%s,%s,%s)
        on conflict (kind, source, source_id) do nothing
    """, (kind, source_id, source_name, team_slug, season_label, assigned_slug, reason,
          json.dumps(candidates, ensure_ascii=False)))
    print(f"[kimlik] INCELEME {kind} tbf={source_id} '{source_name}' -> {assigned_slug} "
          f"({reason}; aday: {[c['slug'] for c in candidates]})", flush=True)


def resolve_teams(cur, team_rows, season_label, logos):
    """tbf_team_id → {'slug','name'}. Bilinen takımın slug'ı VE adı korunur."""
    out = {}
    for tr in team_rows:
        tid, raw = tr["tbf_team_id"], tr["team_name"]
        if tid in out:
            continue
        cur.execute("select team_slug, team_name from basketball.teams where tbf_team_id=%s", (tid,))
        row = cur.fetchone()
        if not row:
            slug = match_team_slug(raw)
            if slug:
                cur.execute("select team_slug, team_name, tbf_team_id from basketball.teams "
                            "where team_slug=%s", (slug,))
                row = cur.fetchone()
                if row and row[2] is not None and row[2] != tid:
                    row, slug = None, None      # o slug başka tbf id'ye bağlı → yeni takım gibi davran
            if row:
                cur.execute("update basketball.teams set tbf_team_id=%s, updated_at=now() "
                            "where team_slug=%s", (tid, row[0]))
                print(f"[kimlik] takim baglandi: tbf={tid} '{raw}' -> {row[0]}", flush=True)
            else:
                new_slug = slug or slugify(raw) or f"tbf-team-{tid}"
                cur.execute("select 1 from basketball.teams where team_slug=%s", (new_slug,))
                if cur.fetchone():
                    new_slug = f"{new_slug}-{tid}"
                cur.execute("""insert into basketball.teams (team_slug, team_name, season_label, tbf_team_id)
                               values (%s,%s,%s,%s)""", (new_slug, raw, season_label, tid))
                _review(cur, "team", tid, raw, new_slug, season_label, new_slug, "new-team", [])
                row = (new_slug, raw)
        cur.execute("""update basketball.teams set season_label=%s,
                           logo_url=coalesce(%s, logo_url), updated_at=now()
                       where team_slug=%s""", (season_label, logos.get(tid), row[0]))
        out[tid] = {"slug": row[0], "name": row[1]}
    return out


def _candidate_index(cur, season_label):
    """tbf id'siz oyuncular: isim anahtarı → kanonik slug kümesi (+ fuzzy için liste).

    Adayın takımı = o sezonun kadro tablosu (team_rosters; transferi bilir), yoksa
    players.team_slug (son görüldüğü takım)."""
    cur.execute("select alias_slug, canonical_slug from analytics.bb_pm_player_merges")
    canon = dict(cur.fetchall())
    cur.execute("""select p.player_slug, p.player_name, coalesce(r.team_slug, p.team_slug), p.tbf_player_id
                   from basketball.players p
                   left join basketball.team_rosters r
                     on r.player_slug = p.player_slug and r.season_label = %s""", (season_label,))
    rows = cur.fetchall()
    has_tbf = {r[0] for r in rows if r[3] is not None}
    by_key, pool = {}, []
    for slug, name, team, _tbf in rows:
        target = canon.get(slug, slug)
        if slug in has_tbf or target in has_tbf:
            continue        # kimliği zaten id'li; isimle yeniden bağlanmaz
        toks = name_tokens(name)
        if len(toks) < 2:
            continue
        by_key.setdefault(frozenset(toks), set()).add(target)
        pool.append({"slug": target, "name": name, "team": team, "toks": toks})
    return by_key, pool


def resolve_players(cur, player_rows, season_label, team_map):
    """tbf_player_id → {'slug','name'}; oyuncu boyutunu günceller."""
    latest = {}
    for r in player_rows:
        latest[r["tbf_player_id"]] = r
    ids = list(latest)
    cur.execute("select tbf_player_id, player_slug, player_name from basketball.players "
                "where tbf_player_id = any(%s)", (ids,))
    out = {r[0]: {"slug": r[1], "name": r[2]} for r in cur.fetchall()}

    unknown = [pid for pid in ids if pid not in out]
    if unknown:
        by_key, pool = _candidate_index(cur, season_label)
        cur.execute("select player_slug from basketball.players")
        used = {r[0] for r in cur.fetchall()}
        for pid in unknown:
            r = latest[pid]
            raw = r["player_name"] or ""
            toks = name_tokens(raw)
            tslug = (team_map.get(r["team_id"]) or {}).get("slug") or r["team_slug"]
            cands = by_key.get(frozenset(toks), set()) if len(toks) >= 2 else set()
            link = cands
            if not cands:
                # 2b) alt küme isim ("Akif Egemen Güven" ⊃ "Egemen Güven") + AYNI takım + tek aday.
                # Ölçümde alt-küme kademesi 17/17 doğruydu; takım şartı transferde incelemeye bırakır.
                link = {c["slug"] for c in pool
                        if c["team"] == tslug and fuzzy_tier(toks, c["toks"]) == "subset"}
            if len(link) == 1:
                slug = next(iter(link))
                cur.execute("update basketball.players set tbf_player_id=%s, updated_at=now() "
                            "where player_slug=%s and tbf_player_id is null returning player_name", (pid, slug))
                got = cur.fetchone()
                if got:
                    by_key.pop(frozenset(toks), None)
                    pool[:] = [c for c in pool if c["slug"] != slug]
                    out[pid] = {"slug": slug, "name": got[0]}
                    print(f"[kimlik] oyuncu baglandi: tbf={pid} '{raw}' -> {slug}", flush=True)
                    continue
            # yeni slug (scraper durmaz); benzer mevcut oyuncu varsa incelemeye düş
            slug = slugify(raw) or f"tbf-{pid}"
            if slug in used:
                slug = f"{slug}-{pid}"
            used.add(slug)
            name = display_name(raw)
            cur.execute("""insert into basketball.players (player_slug, player_name, season_label, tbf_player_id)
                           values (%s,%s,%s,%s)""", (slug, name, season_label, pid))
            out[pid] = {"slug": slug, "name": name}
            if len(cands) > 1:
                sugg = [{"slug": s, "tier": "exact-ambiguous"} for s in sorted(cands)]
                _review(cur, "player", pid, raw, tslug, season_label, slug, "ambiguous-exact", sugg)
            elif toks:
                seen, sugg = set(), []
                for c in pool:
                    tier = fuzzy_tier(toks, c["toks"])
                    if tier and c["slug"] not in seen:
                        seen.add(c["slug"])
                        sugg.append({"slug": c["slug"], "name": c["name"], "team": c["team"], "tier": tier})
                if sugg:
                    _review(cur, "player", pid, raw, tslug, season_label, slug, "similar-existing", sugg)

    for pid, r in latest.items():
        team = team_map.get(r["team_id"]) or {"slug": r["team_slug"], "name": r["team_name"]}
        cur.execute("""update basketball.players set team_slug=%s, team_name=%s, jersey_no=%s,
                           season_label=%s, updated_at=now() where player_slug=%s""",
                    (team["slug"], team["name"], r["jersey_no"], season_label, out[pid]["slug"]))
        # Sezon kadrosu maç verisinden kendini düzeltir: sahaya çıktığı takım = güncel takımı
        # (sezon içi transferde satır yeni takıma taşınır). Tools kadro modu bunu okur.
        cur.execute("""insert into basketball.team_rosters (season_label, player_slug, team_slug, source, confirmed)
                       values (%s,%s,%s,'tbf',true)
                       on conflict (season_label, player_slug) do update set
                           team_slug=excluded.team_slug, source='tbf', confirmed=true, updated_at=now()""",
                    (season_label, out[pid]["slug"], team["slug"]))
    return out

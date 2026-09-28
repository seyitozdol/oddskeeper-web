"""EL/EC oyuncularini BSL oyuncularina bagla: person_code -> basketball player_slug
(euroleague.player_bsl_link). Boylece BSL oyuncu detayinda EL/EC istatistigi gosterilir,
EL oyuncu sayfasi birlesik BSL profiline yonlenir.

Otomatik calisir (EL/EC wrapper'i, --auto): --people ile kuluplerin API'deki KAYITLI kadrosu
ilk mactan ONCE baglanir; sezon icinde box-score'dan gelen yeni kisi/transferler de yakalanir.

Adimlar (sezon S icin):
  1) Takim koprusu: API /clubs'ta ulkesi TUR olup euroleague.team_bsl_link'te olmayan kulup
     identity.match_team_slug ile TEK slug'a cikarsa baglanir; cikmazsa inceleme (kind=team).
  2) Kisiler: (a) --people: bagli kuluplerin API kayitli kadrosu (type J, aktif),
     (b) euroleague.player_match_stats'taki S sezonu (person_code, team_code) ciftleri.
     euroleague.players.team_code KULLANILMAZ (sonraki mac ezer, sezon ici transferde
     oyuncu eski kulubunden kaybolurdu: Saben Lee, De Colo).
  3) Adaylar (kulup icinde): basketball.team_rosters (S, BSL takimi), merge tablosuyla
     kanonige indirgenmis, yalniz basketball.players'ta olan slug'lar. Gecmis sezonda (ya da
     kadro bossa) players.team_slug + o sezonun BSL mac satirlarindaki takim.
  4) Kademeler:
     T0  zaten bagli: korunur; alias slug'a bagliysa kanonige cevrilir. Yeni tekil esleme
         farkli diyorsa ASLA ezilmez -> inceleme (link-conflict).
     T1  dogum tarihi +-1 gun + en az bir ortak soyad token'i + tek aday -> 'auto-bd'
     T2  dogum tarihi yok ya da tutmuyor: BSL son token'i EL soyad kumesinde + ad token'i esit
         ya da onek (Vitto/Vittorio, Zach/Zachary, Santi/Santiago) + tek aday -> 'auto-name'
     T3  kulupte eslesme yok: tum BSL'de ayni dogum tarihi + soyad aranir, YALNIZ inceleme
         onerisi olur (otomatik baglama yok).
     MANUAL_LINKS elle kararlar ('manual'), otomatik kademelerden once uygulanir.
  5) Guvenlik: basketball.players satiri ASLA acilmaz; commit oncesi yetim bag kontrolu.

Inceleme kaydi (basketball.identity_review, source='euroleague') kisi basina tekildir.
"[kimlik] INCELEME" (ntfy) yalniz: yeni kayitta; 'resolved' kayit sorun yeniden goruldugunde
YENIDEN ACILINCA; acik kaydin sebebi degisince (yalniz TAM kanitli turda: --people ve kadro
cekimi eksiksiz; eksik kanitli yukleme turu acik kaydin sebebini degistirmez, yoksa sabah ve
yukleme turlari arasinda gidip gelip her seferinde bildirirdi). 'ignored' kayda hic dokunulmaz:
"mevcut bag dogru, boyle kalsin" karari icin status='ignored' yap ('resolved' = duzeltildi,
sorun tekrar gorulurse yeniden acilir). link-conflict kaydi yalniz mevcut bag OLUMLU teyit
edilince (taze esleme ayni slug'i verince) ya da manuel karar gelince kapanir.
Kayitli ama henuz oynamamis, kulupte BSL adayi olmayan kisi SESSIZ gecilir (her tur yeniden
denenir; BSL kadrosuna girince T1 ile baglanir, EL'de oynayip hala eslesmezse inceleme acilir).

Olcum (2026-09-28): 26/27 kayitli 89 oyuncu (6 Turk kulubu) 89/89 tekil, 0 catisma.

Kullanim:
  python match_euroleague_bsl.py                          # guncel sezon, tam rapor, yazar
  python match_euroleague_bsl.py --auto --people          # cron: yalniz degisiklik/inceleme/hata + ozet
  python match_euroleague_bsl.py --season-label 2025-2026 --dry-run
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from identity import TEAM_KEYWORDS, current_season_label, match_team_slug, name_tokens  # noqa: E402

API = "https://api-live.euroleague.net/v2/competitions"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
PACE = 0.15            # istekler arasi sn
COMPETITIONS = ("E", "U")
REVIEW_SOURCE = "euroleague"

# Otomatik kademelerin yakalayamadigi (ya da yakalamasi riskli) vakalar: person_code -> BSL slug.
# Otomatik kademeden ONCE uygulanir, match_source='manual' yazilir.
MANUAL_LINKS = {
    # EuroLeague (Efes/Fenerbahce)
    "010391": "nick-weiler-babb",   # Nicholas Alan Weiler-Babb (Efes)
    "012742": "pj-dozier",          # Perry Linnard Dozier Jr (Efes)
    "006661": "scottie-wilbekin",   # Scott Jordan Wilbekin (Fenerbahce)
    "014220": "chris-silva",        # Junior Christopher Obame Correia Silva (Fenerbahce)
    # EuroCup (Besiktas/Turk Telekom)
    "008967": "matt-thomas",        # Matthew William Thomas (Besiktas)
    "013365": "vitto-brown",        # Vittorio Brown (Besiktas; EL dogum tarihi 07-13, BSL 07-31)
    "012760": "kris-bankston",      # Kristeon Lamar Bankston (Turk Telekom)
    "007653": "yavuz-gultekin",     # Yavuz Gultekin (TTK 25/26; BSL profili karsiyaka, dogum tarihi ayni)
}


# ------------------------------- saf fonksiyonlar -------------------------------
def season_code(comp: str, season_label: str) -> str:
    """('E', '2026-2027') -> 'E2026'."""
    return f"{comp}{season_label[:4]}"


def to_date(v):
    """API "1992-10-02T00:00:00" / DB date -> date (bos/bozuksa None)."""
    if v is None or isinstance(v, dt.date):
        return v
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def canonical(slug, merges):
    """alias -> kanonik slug (zincirleme merge'e karsi dongu korumali)."""
    seen = set()
    while slug in merges and slug not in seen:
        seen.add(slug)
        slug = merges[slug]
    return slug


def person_sets(name, passport_name="", passport_surname=""):
    """EL kisi -> (soyad token kumesi, ad token kumesi).

    Gosterim adi "SOYAD, AD" bicimindedir; pasaport ad/soyadi da eklenir ("YUSTA GARCIA",
    "OBAME CORREIA SILVA", "DE JULIUS"). name_tokens virgulu ve Jr/II/III/IV'u atar
    ("ISIAHA, TYRIN", "CARTER II")."""
    name = name or ""
    if "," in name:
        sur, giv = name.split(",", 1)
    else:
        toks = name.split()
        sur, giv = (toks[-1] if toks else ""), " ".join(toks[:-1])
    surs = set(name_tokens(sur)) | set(name_tokens(passport_surname or ""))
    givs = set(name_tokens(giv)) | set(name_tokens(passport_name or ""))
    return frozenset(surs), frozenset(givs)


def make_person(code, name, passport_name="", passport_surname="", birth_date=None):
    sur, giv = person_sets(name, passport_name, passport_surname)
    return {"code": code, "name": name or "", "sur": sur, "giv": giv, "bd": to_date(birth_date)}


def make_cand(slug, name, birth_date=None, team=None):
    return {"slug": slug, "name": name or "", "toks": name_tokens(name), "bd": to_date(birth_date),
            "team": team}


def bd_close(a, b, tol=1):
    return a is not None and b is not None and abs((a - b).days) <= tol


def given_related(el_given, bsl_given):
    """Ad token'lari esit ya da biri digerinin oneki (en az 3 harf): Vitto/Vittorio,
    Zach/Zachary, Santi/Santiago, Will/William. PJ/Perry, Fatts/Daron TUTMAZ (manuel/T1)."""
    for g in el_given:
        for b in bsl_given:
            if g == b or (min(len(g), len(b)) >= 3 and (g.startswith(b) or b.startswith(g))):
                return True
    return False


def classify(person, cands):
    """Kulup ici kademe. Donus (tier, reason, hits):
    ('T1'|'T2', None, [aday])  -> otomatik baglanabilir
    (None, 'ambiguous', [..])  -> ayni kademede birden cok aday
    (None, 'bd-mismatch', [..])-> soyad tutan aday var ama dogum tarihi teyit etmiyor (farkli/bos)
                                  ve ad da tutmuyor
    (None, 'no-bsl-candidate', [])"""
    sur, giv, bd = person["sur"], person["giv"], person["bd"]
    t1 = [c for c in cands if bd_close(bd, c["bd"]) and sur & set(c["toks"])]
    if len(t1) == 1:
        return "T1", None, t1
    if t1:
        return None, "ambiguous", t1
    # T2 YALNIZ dogum tarihi bir tarafta eksikse: iki taraf da doluysa ve tutmuyorsa ayni kulupteki
    # adas (Chris/Christian Brown) ya da pasaport orta adi (Bryce TYLER Jones -> Tyler Jones) yanlis
    # baglanabilir; o durum 'bd-mismatch' incelemesine duser (Vitto Brown'in tarih hatasi MANUAL_LINKS'te).
    t2 = [c for c in cands if (bd is None or c["bd"] is None) and len(c["toks"]) >= 2
          and c["toks"][-1] in sur and given_related(giv, c["toks"][:-1])]
    if len(t2) == 1:
        return "T2", None, t2
    if t2:
        return None, "ambiguous", t2
    weak = [c for c in cands if sur & set(c["toks"])]
    if weak:
        return None, "bd-mismatch", weak
    return None, "no-bsl-candidate", []


def global_suggestions(person, pool, exclude=()):
    """T3: tum (kanonik) BSL oyunculari icinde AYNI dogum tarihi + ortak soyad token'i.
    Yalniz inceleme onerisi; kulup disi oldugu icin otomatik baglanmaz (Braxton Key ve
    Eugene Omoruyi ayni gun dogmus)."""
    return [c for c in pool if c["slug"] not in exclude and bd_close(person["bd"], c["bd"], 0)
            and person["sur"] & set(c["toks"])]


def review_worthy(in_box, reason, hits):
    """Inceleme acilsin mi? Kulupte belirsiz/uyusmaz aday varsa ya da kisi EL'de bir Turk kulubu
    icin OYNADIYSA (istatistigi BSL profiline gitmiyor) -> evet. Yalniz kayitli (henuz mac yok) ve
    kulupte aday yoksa -> SESSIZ, T3 (kulup disi) onerisi olsa bile: sezon basinda BSL kadrosu
    senkronlanmadan once 13 kisilik bos alarm uretiyordu; kisi her tur yeniden denenir, BSL
    kadrosuna girince T1 baglar, EL'de oynayip hala eslesmezse o zaman inceleme acilir.
    (hits parametresi cagiran tarafla imza uyumu icin; karar vermez.)"""
    return bool(in_box or reason != "no-bsl-candidate")


def cand_json(c, tier=None):
    out = {"slug": c["slug"], "name": c["name"], "team": c.get("team"),
           "birth_date": c["bd"].isoformat() if c.get("bd") else None}
    if tier:
        out["tier"] = tier
    return out


# ------------------------------- API -------------------------------
class RateLimited(Exception):
    """Cloudflare hiz siniri (429, "Error 1015") ya da engel (403): bu tur API'ye baska istek atilmaz."""


_blocked = None   # ilk 429/403'ten sonra ayni turdaki istekler hic gonderilmez


def api_get(path):
    """GET {API}/{path}; tarayici UA sart (urllib varsayilani 403), ?_cb= Cloudflare kopyasini atlar."""
    global _blocked
    if _blocked:
        raise RateLimited(_blocked)
    sep = "&" if "?" in path else "?"
    url = f"{API}/{path}{sep}_cb={int(time.time() * 1000)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            _blocked = f"HTTP {e.code}, Retry-After {e.headers.get('Retry-After') if e.headers else None}"
            raise RateLimited(_blocked) from e
        raise
    finally:
        time.sleep(PACE)
    return json.loads(body) if body.strip() else None


def api_rows(data):
    if isinstance(data, dict):
        return data.get("data") or []
    return data or []


# ------------------------------- DB katmani -------------------------------
def say(msg):
    print(msg, flush=True)


class Linker:
    """Iki evre: gather() = API cagrilari + okumalar (autocommit, acik islem YOK), apply() = tum
    yazmalar tek kisa islemde. Degisiklik/inceleme satirlari tamponlanir ve yalniz commit'ten SONRA
    basilir (flush): geri alinan bir tur ntfy/kadro denetimi tetiklemesin, sonraki tur tekrar
    bildirmesin."""

    def __init__(self, cur, season, dry, verbose):
        self.cur, self.season, self.dry, self.verbose = cur, season, dry, verbose
        self.past = season < current_season_label()
        self.buf = []
        self.blocked = False
        self.complete = False          # tam kanit: --people + kulup/kadro cekimi eksiksiz (gather ayarlar)
        self.fetch_failed = False
        self.pending_teams = []       # (kulup, slug | None, isabetler): apply'da yazilir/incelemeye duser
        self.people = []
        self.n = dict.fromkeys(("team_new", "team_review", "persons", "people", "box", "linked",
                                "T1", "T2", "manual", "alias", "review", "review_new",
                                "conflict", "silent", "error", "integrity"), 0)
        cur.execute("select alias_slug, canonical_slug from analytics.bb_pm_player_merges "
                    "where league='basketball'")
        self.merges = dict(cur.fetchall())
        cur.execute("select player_slug, player_name, birth_date, team_slug from basketball.players")
        self.players = {r[0]: make_cand(*r) for r in cur.fetchall()}
        # T3 havuzu: yalniz kanonik profiller (alias satirlari disarida)
        self.pool = [c for s, c in self.players.items() if s not in self.merges]
        cur.execute("select team_slug from basketball.teams")
        self.teams = {r[0] for r in cur.fetchall()}
        cur.execute("select team_code, bsl_team_slug from euroleague.team_bsl_link")
        self.team_links = dict(cur.fetchall())
        cur.execute("select person_code, bsl_player_slug, match_source from euroleague.player_bsl_link")
        self.links, self.owner = {}, {}
        for pc, slug, src in cur.fetchall():
            self._set_link(pc, slug, src)
        # kulup -> yarisma (bu sezon): DB programi, API /clubs cevabi ustune yazar
        cur.execute("select competition, team_code from euroleague.teams where season_label=%s", (season,))
        self.club_comp = {code: comp for comp, code in cur.fetchall()}
        cur.execute("select source_id, reason from basketball.identity_review "
                    "where kind='player' and source=%s and status='open'", (REVIEW_SOURCE,))
        self.open_reviews = dict(cur.fetchall())   # source_id -> sebep
        self._cands = {}

    # ---- yardimcilar ----
    def emit(self, msg):
        self.buf.append(msg)

    def flush(self):
        for msg in self.buf:
            say(msg)
        self.buf = []

    def info(self, msg):
        if self.verbose:
            self.emit(msg)

    def error(self, msg, integrity=False):
        """integrity=True: elle mudahale isteyen kalici veri hatasi (yetim/manuel/alias bag) -> rc 2
        (wrapper anlik ntfy); aksi halde gecici ag/API hatasi, rc 0 kalir."""
        self.n["error"] += 1
        if integrity:
            self.n["integrity"] += 1
        self.emit(f"[el-link] HATA: {msg}")

    def rate_limited(self, e):
        if not self.blocked:
            self.error(f"API hiz siniri/engel ({e}); bu tur API cagrilari durduruldu, "
                       f"sonraki turda tekrar denenecek")
        self.blocked = True

    def write(self, sql, params):
        """DB yazmasi; dry-run'da HIC calismaz (baglanti zaten salt-okunur)."""
        if self.dry:
            return 1
        self.cur.execute(sql, params)
        return self.cur.rowcount

    def _set_link(self, pc, slug, src):
        old = self.links.get(pc)
        if old:
            self.owner.get(old[0], set()).discard(pc)
        self.links[pc] = [slug, src]
        self.owner.setdefault(slug, set()).add(pc)

    def review(self, kind, source_id, name, team_slug, assigned, reason, cands):
        """identity_review'a yaz; bildirim (INCELEME satiri) yalniz yeni kayitta ya da sorun
        DEGISTIGINDE: kayit (kind, source, source_id) basina tekildir, bu yuzden daha once kapanmis
        (resolved) bir kayit yeni sorunda YENIDEN ACILIR, acik kaydin sebebi degistiyse guncellenir.
        Ayni sebeple acik kayit dokunulmaz (10 dk'lik cron tekrar bildirmez); 'ignored' hic dokunulmaz."""
        self.n["review"] += 1
        if self.dry:
            self.cur.execute("select status, reason from basketball.identity_review "
                             "where kind=%s and source=%s and source_id=%s",
                             (kind, REVIEW_SOURCE, str(source_id)))
            row = self.cur.fetchone()
            new = row is None or (row[0] != "ignored" and
                                  (row[0] == "resolved" or (self.complete and row[1] != reason)))
        else:
            self.cur.execute("""
                insert into basketball.identity_review
                    (kind, source, source_id, source_name, team_slug, season_label, assigned_slug,
                     reason, candidates, status)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,'open')
                on conflict (kind, source, source_id) do update set
                    status='open', reason=excluded.reason, candidates=excluded.candidates,
                    assigned_slug=excluded.assigned_slug, team_slug=excluded.team_slug,
                    season_label=excluded.season_label, source_name=excluded.source_name, resolved_at=null
                where identity_review.status <> 'ignored'
                  and (identity_review.status = 'resolved'
                       or (%s and identity_review.reason is distinct from excluded.reason))
            """, (kind, REVIEW_SOURCE, str(source_id), name, team_slug, self.season, assigned or "",
                  reason, json.dumps(cands, ensure_ascii=False), self.complete))
            new = self.cur.rowcount == 1
            row = None
        if new:
            self.n["review_new"] += 1
            if kind == "player":
                self.open_reviews[str(source_id)] = reason
            self.emit(f"[kimlik] INCELEME {kind} {REVIEW_SOURCE}={source_id} '{name}' -> {assigned or '-'} "
                      f"({reason}; aday: {[c.get('slug') for c in cands]})"
                      f"{' [dry-run]' if self.dry else ''}")
        else:
            self.info(f"  (inceleme zaten kayitli{': ' + row[0] if row else ''}: {kind} {source_id} {reason})")

    def resolve_review(self, pc, confirmed=True):
        """Kisi (herhangi bir yoldan: otomatik, manuel, elle SQL) bagliysa acik incelemesi kapanir
        (kuyruk bayat kalmasin). Yalniz acik kaydi olanlar icin UPDATE atilir. link-conflict yalniz
        confirmed=True iken kapanir (taze esleme mevcut bagi teyit etti ya da manuel karar): kanit
        eksik bir tur (catisan kulubun kadrosu cekilmemis) catismayi sessizce kapatmasin."""
        reason = self.open_reviews.get(pc)
        if reason is None or (reason == "link-conflict" and not confirmed):
            return
        del self.open_reviews[pc]
        if self.write("""update basketball.identity_review set status='resolved', resolved_at=now()
                         where kind='player' and source=%s and source_id=%s and status='open'""",
                      (REVIEW_SOURCE, pc)) and not self.dry:
            self.emit(f"[el-link] inceleme kapandi: {pc}")

    # ---- 1) takim koprusu ----
    def fetch_clubs(self):
        """(ag evresi) Sezonun kulupleri; ulkesi TUR olup koprusu olmayan kulup icin karar verilir,
        yazma apply_teams'te. Cozulen kopru hemen team_links'e girer (kadrosu da cekilsin)."""
        for comp in COMPETITIONS:
            if self.blocked:
                return
            code = season_code(comp, self.season)
            try:
                clubs = api_rows(api_get(f"{comp}/seasons/{code}/clubs"))
            except RateLimited as e:
                self.rate_limited(e)
                return
            except Exception as e:
                self.fetch_failed = True
                self.error(f"{code} kulup listesi alinamadi ({e!r}), sonraki turda tekrar denenecek")
                continue
            for c in clubs:
                if not c.get("code"):
                    continue
                self.club_comp[c["code"]] = comp
                if (c.get("country") or {}).get("code") == "TUR" and c["code"] not in self.team_links:
                    self.decide_team(c)

    def decide_team(self, c):
        names = [c.get(k) for k in ("name", "clubPermanentName", "abbreviatedName", "editorialName")
                 if c.get(k)]
        hits = {s for s in map(match_team_slug, names) if s}
        slug = next(iter(hits)) if len(hits) == 1 else None
        if slug and slug in self.teams:
            self.team_links[c["code"]] = slug
            self.pending_teams.append((c, slug, hits))
            return
        if not hits:
            joined = " ".join(" ".join(name_tokens(n)) for n in names)
            hits = {s for kw, s in TEAM_KEYWORDS if kw in joined}
        self.pending_teams.append((c, None, hits))

    def apply_teams(self):
        """(yazma evresi) fetch_clubs kararlarini yaz: tekil slug -> kopru, degilse inceleme."""
        for c, slug, hits in self.pending_teams:
            if slug:
                self.write("""insert into euroleague.team_bsl_link (team_code, bsl_team_slug) values (%s,%s)
                              on conflict (team_code) do nothing""", (c["code"], slug))
                self.n["team_new"] += 1
                self.emit(f"[el-link] takim baglandi: {c['code']} '{c.get('name')}' -> {slug}"
                          f"{' [dry-run]' if self.dry else ''}")
                continue
            self.n["team_review"] += 1
            reason = "ambiguous" if len(hits) > 1 else "no-bsl-team"
            self.review("team", c["code"], c.get("name"), None, "", reason,
                        [{"slug": s, "exists": s in self.teams} for s in sorted(hits)])

    # ---- 2) alias duzeltmesi + manuel baglar ----
    def fix_aliases(self):
        for pc, (slug, src) in sorted(self.links.items()):
            target = canonical(slug, self.merges)
            if target == slug:
                continue
            if target not in self.players:
                self.error(f"alias bag {pc} -> {slug}: kanonik {target} basketball.players'ta yok",
                           integrity=True)
                continue
            others = self.owner.get(target, set()) - {pc}
            if others:
                self.error(f"alias bag {pc} -> {slug}: kanonik {target} baska kisiye bagli {sorted(others)}",
                           integrity=True)
                continue
            self.write("""update euroleague.player_bsl_link set bsl_player_slug=%s
                          where person_code=%s and bsl_player_slug=%s""", (target, pc, slug))
            self._set_link(pc, target, src)
            self.n["alias"] += 1
            self.emit(f"[el-link] alias duzeltildi: {pc} {slug} -> {target}{' [dry-run]' if self.dry else ''}")

    def apply_manual(self):
        self.cur.execute("""select distinct on (person_code) person_code, name from euroleague.players
                            where person_code = any(%s) order by person_code, season_code desc""",
                         (list(MANUAL_LINKS),))
        names = dict(self.cur.fetchall())
        tag = " [dry-run]" if self.dry else ""
        for pc, slug in sorted(MANUAL_LINKS.items()):
            target = canonical(slug, self.merges)
            if target not in self.players:
                self.error(f"manuel bag {pc} -> {slug}: BSL oyuncusu yok (silinmis/birlestirilmis?)",
                           integrity=True)
                continue
            others = self.owner.get(target, set()) - {pc}
            if others:
                self.error(f"manuel bag {pc} -> {target}: slug baska kisiye bagli {sorted(others)}",
                           integrity=True)
                continue
            cur_link = self.links.get(pc)
            if cur_link is None:
                self.write("""insert into euroleague.player_bsl_link (person_code, bsl_player_slug, match_source)
                              values (%s,%s,'manual') on conflict (person_code) do nothing""", (pc, target))
                self._set_link(pc, target, "manual")
                self.n["manual"] += 1
                self.emit(f"[el-link] baglandi: {pc} '{names.get(pc, '')}' -> {target} [manual]{tag}")
            elif cur_link[0] != target:
                # elle verilmis karar otomatigi ezer (alias'lar yukarida zaten kanonige cevrildi)
                self.write("""update euroleague.player_bsl_link set bsl_player_slug=%s, match_source='manual'
                              where person_code=%s""", (target, pc))
                self.emit(f"[el-link] manuel duzeltildi: {pc} {cur_link[0]} -> {target}{tag}")
                self._set_link(pc, target, "manual")
                self.n["manual"] += 1
            elif cur_link[1] != "manual":
                self.write("update euroleague.player_bsl_link set match_source='manual' where person_code=%s",
                           (pc,))
                cur_link[1] = "manual"
                self.emit(f"[el-link] kaynak manual yapildi: {pc} -> {target}{tag}")
            self.resolve_review(pc)

    # ---- 3) kisiler ----
    def fetch_people(self):
        """(ag evresi) Bagli kuluplerin API kayitli oyuncu kadrosu (type J, aktif)."""
        out = []
        for club in sorted(self.team_links):
            if self.blocked:
                break
            comp = self.club_comp.get(club)
            if not comp:
                self.info(f"  {club}: bu sezon EL/EC'de degil, kadro cekilmedi")
                continue
            code = season_code(comp, self.season)
            try:
                rows = api_rows(api_get(f"{comp}/seasons/{code}/clubs/{club}/people"))
                for x in rows:
                    per = (x or {}).get("person") or {}
                    if x.get("type") == "J" and x.get("active") and per.get("code"):
                        out.append((club, per))
            except RateLimited as e:
                self.rate_limited(e)
                break
            except Exception as e:
                self.fetch_failed = True
                self.error(f"{code} {club} kadrosu alinamadi ({e!r}), sonraki turda tekrar denenecek")
                continue
        return out

    def collect_persons(self, people):
        P = {}

        def get(pc):
            return P.setdefault(pc, {"code": pc, "clubs": set(), "box": False, "reg": False,
                                     "name": "", "pn": "", "ps": "", "bd": None})
        for club, per in people:
            p = get(per["code"])
            p["clubs"].add(club)
            p["reg"] = True
            p.update(name=per.get("name") or "", pn=per.get("passportName") or "",
                     ps=per.get("passportSurname") or "", bd=to_date(per.get("birthDate")))
        self.cur.execute("""select distinct person_code, team_code from euroleague.player_match_stats
                            where season_label=%s and team_code = any(%s)""",
                         (self.season, list(self.team_links)))
        for pc, club in self.cur.fetchall():
            p = get(pc)
            p["clubs"].add(club)
            p["box"] = True
        need = [pc for pc, p in P.items() if not p["name"]]
        if need:
            self.cur.execute("""select distinct on (person_code) person_code, name, passport_name,
                                       passport_surname, birth_date
                                from euroleague.players where person_code = any(%s)
                                order by person_code, (season_label = %s) desc, season_code desc""",
                             (need, self.season))
            for pc, nm, pn, ps, bd in self.cur.fetchall():
                P[pc].update(name=nm or "", pn=pn or "", ps=ps or "", bd=bd)
        for p in P.values():
            p["sur"], p["giv"] = person_sets(p["name"], p["pn"], p["ps"])
        return P

    def club_cands(self, bsl):
        if bsl in self._cands:
            return self._cands[bsl]
        self.cur.execute("select player_slug from basketball.team_rosters where season_label=%s and team_slug=%s",
                         (self.season, bsl))
        slugs = {r[0] for r in self.cur.fetchall()}
        if self.past or not slugs:
            # gecmis sezon (kadro tablosu yalniz guncel sezonu tutar) ya da kadro henuz kurulmamis
            self.cur.execute("select player_slug from basketball.players where team_slug=%s", (bsl,))
            slugs |= {r[0] for r in self.cur.fetchall()}
            self.cur.execute("""select distinct player_slug from basketball.player_match_stats
                                where season_label=%s and team_slug=%s""", (self.season, bsl))
            slugs |= {r[0] for r in self.cur.fetchall()}
        out = {}
        for s in slugs:
            c = canonical(s, self.merges)
            if c in self.players:
                out[c] = dict(self.players[c], team=bsl)
        self._cands[bsl] = list(out.values())
        return self._cands[bsl]

    def link_persons(self, P):
        tag = " [dry-run]" if self.dry else ""
        order = sorted(P.values(), key=lambda p: (min(p["clubs"]), p["name"]))
        for p in order:
            pc, name = p["code"], p["name"]
            clubs = sorted(p["clubs"])
            src = ("kayit+mac" if p["reg"] and p["box"] else "kayit" if p["reg"] else "mac")
            head = f"  {'/'.join(clubs):7s} {pc:7s} {name[:30]:30s} {p['bd'] or '----------'} ({src})"
            if pc in MANUAL_LINKS:
                self.info(f"{head} -> {self.links.get(pc, ['?'])[0]} [manual]")
                continue
            found, fails = {}, []
            for club in clubs:
                bsl = self.team_links[club]
                cands = self.club_cands(bsl)
                if not cands:
                    self.info(f"{head} -> {bsl}: BSL kadrosu bos, atlandi")
                    continue
                tier, reason, hits = classify(p, cands)
                if tier:
                    found.setdefault(hits[0]["slug"], (tier, club, bsl, hits[0]))
                else:
                    fails.append((reason, club, bsl, hits))
            existing = self.links.get(pc)
            first_bsl = self.team_links[clubs[0]] if clubs else None

            if len(found) > 1:
                self.info(f"{head} -> kulupler farkli aday veriyor {sorted(found)}")
                self.review("player", pc, name, first_bsl, existing[0] if existing else "", "ambiguous",
                            [cand_json(v[3], v[0]) for v in found.values()])
                continue
            hit = next(iter(found.items()), None)

            if existing:
                self.n["linked"] += 1
                if hit and hit[0] != existing[0]:
                    self.n["conflict"] += 1
                    self.info(f"{head} -> bagli {existing[0]} ama yeni esleme {hit[0]} [{hit[1][0]}]")
                    self.review("player", pc, name, hit[1][2], existing[0], "link-conflict",
                                [cand_json(hit[1][3], hit[1][0]),
                                 cand_json(self.players.get(existing[0], make_cand(existing[0], "")), "mevcut")])
                else:
                    self.info(f"{head} -> {existing[0]} [bagli{'' if hit else ', kulupte teyit yok'}]")
                    # elle (SQL) baglanmis kisinin acik incelemesi kapansin; catisma yalniz olumlu teyitle
                    self.resolve_review(pc, confirmed=bool(hit and hit[0] == existing[0]))
                continue

            if hit:
                slug, (tier, club, bsl, c) = hit
                others = self.owner.get(slug, set()) - {pc}
                if others:
                    self.n["conflict"] += 1
                    self.info(f"{head} -> {slug} [{tier}] ama slug {sorted(others)} kisisine bagli")
                    self.review("player", pc, name, bsl, "", "link-conflict",
                                [dict(cand_json(c, tier), linked_person=sorted(others))])
                    continue
                self.write("""insert into euroleague.player_bsl_link (person_code, bsl_player_slug, match_source)
                              values (%s,%s,%s) on conflict (person_code) do nothing""",
                           (pc, slug, "auto-bd" if tier == "T1" else "auto-name"))
                self._set_link(pc, slug, "auto-bd" if tier == "T1" else "auto-name")
                self.n[tier] += 1
                self.emit(f"[el-link] baglandi: {pc} '{name}' ({club}) -> {slug} [{tier}]{tag}")
                self.resolve_review(pc)
                continue

            if not fails:
                continue   # hicbir kulupte BSL kadrosu yok (yukarida not dusuldu)
            # oncelik: belirsiz > dogum tarihi uyusmaz > aday yok
            rank = {"ambiguous": 0, "bd-mismatch": 1, "no-bsl-candidate": 2}
            reason, club, bsl, hits = min(fails, key=lambda f: rank[f[0]])
            cands = [cand_json(c) for c in hits]
            if reason == "no-bsl-candidate":
                seen = {c["slug"] for f in fails for c in self.club_cands(f[2])}
                cands = [cand_json(c, "T3-bd+soyad") for c in global_suggestions(p, self.pool, seen)]
            if not review_worthy(p["box"], reason, cands):
                self.n["silent"] += 1
                self.info(f"{head} -> eslesmedi, sessiz (yalniz kayitli, BSL adayi yok)")
                continue
            self.info(f"{head} -> eslesmedi ({reason})")
            self.review("player", pc, name, bsl, "", reason, cands)

    # ---- 4) guvenlik ----
    def check_orphans(self):
        if self.dry:
            bad = sorted((pc, s) for pc, (s, _src) in self.links.items() if s not in self.players)
        else:
            self.cur.execute("""select l.person_code, l.bsl_player_slug from euroleague.player_bsl_link l
                                left join basketball.players p on p.player_slug = l.bsl_player_slug
                                where p.player_slug is null order by 1""")
            bad = self.cur.fetchall()
        for pc, s in bad:
            self.error(f"orphan link {pc} -> {s} (basketball.players'ta yok; BSL birlestirme/silme "
                       f"sonrasi bagi kanonik slug'a elle tasi)", integrity=True)

    def gather(self, with_people):
        """Ag evresi: API cagrilari (acik DB islemi YOKKEN; baglanti autocommit)."""
        self.info(f"[el-link] sezon {self.season}{' (gecmis)' if self.past else ''} "
                  f"dry_run={self.dry} people={with_people}")
        self.fetch_clubs()
        self.info(f"[el-link] takim koprusu: {len(self.team_links)} kulup "
                  f"{sorted(self.team_links.items())}")
        self.people = self.fetch_people() if with_people else []
        # yalniz kulup kadrolari eksiksiz cekildiyse acik incelemenin sebebi guncellenebilir
        self.complete = bool(with_people and not self.blocked and not self.fetch_failed)

    def apply(self):
        """Yazma evresi: tek kisa islem (cagiran commit/rollback eder)."""
        self.apply_teams()
        self.fix_aliases()
        self.apply_manual()
        P = self.collect_persons(self.people)
        self.n["persons"] = len(P)
        self.n["people"] = sum(p["reg"] for p in P.values())
        self.n["box"] = sum(p["box"] for p in P.values())
        self.link_persons(P)
        self.check_orphans()

    def summary(self):
        n = self.n
        return (f"[el-link] OZET {self.season}{' DRY-RUN' if self.dry else ''}: "
                f"takim +{n['team_new']} (inceleme {n['team_review']}), "
                f"kisi {n['persons']} (kayitli {n['people']}, mac {n['box']}), zaten bagli {n['linked']}, "
                f"yeni bag T1 {n['T1']} / T2 {n['T2']} / manuel {n['manual']}, alias {n['alias']}, "
                f"inceleme {n['review_new']} yeni ({n['review']} toplam), sessiz {n['silent']}, "
                f"catisma {n['conflict']}, hata {n['error']} (butunluk {n['integrity']})")


def run(args):
    season = args.season_label or current_season_label()
    if not re.fullmatch(r"\d{4}-\d{4}", season):
        raise SystemExit(f"--season-label bicimi 2026-2027 olmali: {season!r}")
    verbose = args.dry_run or not args.auto
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    # okuma + API evresi autocommit: HTTP beklerken "idle in transaction" kilit tutulmaz
    conn.set_session(readonly=args.dry_run, autocommit=True)
    try:
        lk = Linker(conn.cursor(), season, args.dry_run, verbose)
        lk.gather(args.people)
        conn.autocommit = False
        lk.apply()
        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()
        lk.flush()   # degisiklik/INCELEME satirlari yalniz commit'ten SONRA basilir
        say(lk.summary())
    except Exception as e:
        if not conn.closed:
            conn.rollback()
        say(f"[el-link] HATA: beklenmeyen hata {e!r}, hicbir sey yazilmadi")
        raise
    finally:
        conn.close()
    # 2 = elle mudahale isteyen kalici veri hatasi (yetim/manuel/alias bag): wrapper anlik ntfy atar
    return 2 if lk.n["integrity"] else 0


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="EL/EC person_code -> BSL player_slug baglayici")
    ap.add_argument("--auto", action="store_true",
                    help="cron modu: guncel sezon, sessiz (yalniz degisiklik/inceleme/hata + ozet satiri)")
    ap.add_argument("--people", action="store_true",
                    help="bagli kuluplerin API kayitli kadrosunu da cek (oyuncu ilk mactan once baglanir)")
    ap.add_argument("--season-label", help="2026-2027 (varsayilan: identity.current_season_label())")
    ap.add_argument("--dry-run", action="store_true", help="DB'ye yazma (salt-okunur baglanti), her seyi yazdir")
    sys.exit(run(ap.parse_args()))


if __name__ == "__main__":
    main()

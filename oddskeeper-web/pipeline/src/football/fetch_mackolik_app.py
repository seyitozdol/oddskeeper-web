"""Mackolik mobil uygulamasinin (Perform LiveScores motoru) acik veri API'sinden
mac detayi + takim/oyuncu istatistigi ceker. Web surumunde eksik/bos olan
(ozellikle Turkiye Kupasi erken/grup turlari) veriyi verir.

Kesif: uygulama APK'si decompile edilerek cozuldu (2026-08-13).
- Host: https://api.mackolikfeeds.com
- /api/... yollari Akamai EdgeAuth token'i ister (asagida uretiliyor).
- Anahtar APK icindeki assets/akamai_key.txt'ten (statik; Mackolik rotate ederse guncelle).
- Saf HTTP; VPS'ten curl_cffi'siz calisir.
"""
import time
import hmac
import hashlib
import urllib.parse
import requests

# APK assets/akamai_key.txt (hex string; HMAC anahtari icin hex-decode edilir)
AKAMAI_KEY_HEX = "fc2dd7aafd6a867bb5fa199905c6f5fae3f016fbfd87eaef6ea0a700b62db517"
BASE = "https://api.mackolikfeeds.com"
TOKEN_VALID_WINDOW = 11000  # saniye (APK'daki tokenValidWindow)

_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": "okhttp/4.12.0",
    "accept": "application/json",
    # Akamai WAF bu iki header + application/migration_status query'sini ister.
    "X-Authorization": "token ",  # bos token yeterli (WAF sadece varligini kontrol ediyor)
})


def _akamai_token(path: str) -> str:
    """APK'daki AkamaiService.generateToken ile birebir ayni."""
    exp = int(time.time()) + TOKEN_VALID_WINDOW
    sb = f"exp={exp}~acl={path}*~"
    mac_input = sb[:-1]  # son '~' atilir
    key = bytes.fromhex(AKAMAI_KEY_HEX)
    sig = hmac.new(key, mac_input.encode("utf-8"), hashlib.sha256).hexdigest()
    return sb + "hmac=" + sig


def _get(path: str, params: dict) -> requests.Response:
    q = dict(params)
    q.setdefault("application", "com.kokteyl.mackolik")
    q.setdefault("migration_status", "perform")
    url = f"{BASE}{path}?{urllib.parse.urlencode(q)}"
    headers = {"X-RequestToken": _akamai_token(path)}
    return _SESSION.get(url, headers=headers, timeout=25)


def get_matches_by_date(date_iso: str) -> list:
    """Belirli gunun tum futbol maclari (uuid + sayisal id + skor + sezon + competition).
    date_iso: 'YYYY-MM-DD'. Bu endpoint acik (Akamai token gerekmez ama zararsiz)."""
    r = requests.get(
        f"{BASE}/matches-service/soccer/matches",
        params={"date": date_iso},
        headers={"User-Agent": "okhttp/4.12.0", "Content-Language": "tr", "Country": "tr"},
        timeout=25,
    )
    r.raise_for_status()
    return r.json()


CUP_COMPETITION_UUID = "7af85xa75vozt2l4hzi6ryts7"  # Ziraat Turkiye Kupasi
# Kupa sezon id'leri (competition.seasons'dan): app numeric season_id
CUP_SEASONS = {
    "2026/2027": 28542, "2025/2026": 26650, "2024/2025": 25033,
    "2023/2024": 23732, "2022/2023": 21743, "2021/2022": 20147,
}


def get_competition(competition_uuid: str, season_id, language: str = "tr", country: str = "tr") -> dict:
    """Bir sezonun tum fikstur/tur bilgisi. data.gamesets[].matches[] tum maclari,
    data.competition.seasons tum sezon id'lerini verir."""
    r = _get("/api/competition/", {
        "language": language, "country": country,
        "competition_uuid": competition_uuid, "season_id": str(season_id),
    })
    r.raise_for_status()
    return r.json()["data"]


def list_season_matches(competition_uuid: str, season_id) -> list:
    """Sezondaki tum maclari duz liste olarak dondurur (gamesets birlestirilmis)."""
    d = get_competition(competition_uuid, season_id)
    out = []
    for gs in d.get("gamesets") or []:
        for m in gs.get("matches") or []:
            out.append(m)
    return out


def get_match_detail(match_uuid: str, language: str = "tr", country: str = "tr") -> dict:
    """Tam mac detayi: stat_team, stat_team_detailed, shot_map, momentum,
    stat_top_player, lineup, events, h2h ... (web'de eksik olan her sey)."""
    r = _get("/api/match/", {"language": language, "country": country, "match_uuid": match_uuid})
    r.raise_for_status()
    return r.json()["data"]


def extract_team_stats(detail: dict) -> dict:
    """stat_team listesini {type: (team_A, team_B)} sozlugune cevirir."""
    out = {}
    for s in detail.get("stat_team") or []:
        if isinstance(s, dict) and "type" in s:
            out[s["type"]] = (s.get("team_A_value"), s.get("team_B_value"))
    return out


if __name__ == "__main__":
    import sys
    uuid = sys.argv[1] if len(sys.argv) > 1 else "cek3yq8n3s7febcmxtn6zmsr8"  # 2026 kupa finali
    d = get_match_detail(uuid)
    m = d.get("match", {})
    print(f"Mac: {m.get('team_A', {}).get('name','?')} - {m.get('team_B', {}).get('name','?')}")
    for k, (a, b) in extract_team_stats(d).items():
        print(f"  {k}: {a} - {b}")

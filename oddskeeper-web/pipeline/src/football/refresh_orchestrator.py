# -*- coding: utf-8 -*-
"""Mac-sonrasi mat refresh ORKESTRATORU (A-1): tek tablo, dogru sira, en cok 1 kez.

Neden: refresh mantigi 4 yere dagilmisti (sofa loader, FS loader, wrapper inline,
refresh_tsl_mats) ve ayni tur icinde ayni mat 2-3 kez tazeleniyordu. Artik
"mat adi -> bagimlilik sirasi -> tetikleyen kaynak" eslemesi SADECE bu dosyada.

Iki calisma bicimi:

1) ORKESTRE TUR (run_match_scrape.sh): wrapper DEFER_MATS=1 export eder,
   loader/builder'lar ic refresh'lerini atlar (yalniz "kirli" sinyallerini
   loglar: CHANGED_M / islenecek / CUP_CHANGED_M / CUP TOPLAM). Wrapper tur
   sonunda (adim 4) kirli kaynaklari arguman olarak verir:
     refresh_orchestrator.py sofa flash cup
   Bu script MATS tablosundan kaynaklara dokunan mat'lari SIRAYLA ve HER BIRINI
   EN COK 1 KEZ tazeler.

2) YAN YOLLAR (bayraksiz, eski davranis): 3 saatlik run_sofascore.sh, 04:00
   run_fs_player_map.sh ve elle kosular. Loader/builder'lar refresh'i yine
   kendi icinden cagirir ama LISTELER buradaki legacy profillere tasindi
   (SOFA_LOADER_CORE / TSL_SS_MATS / FLASH_LOADER_MATS / TSL_CHAIN_MATS /
   CUP_CHAIN_MATS); boylece mat adi + sira tek dosyada durur.

Sira kurallari (tablo sirasi bunlari kodlar):
  - tff1 player mat, team mat'tan ONCE (team xG player mat'ini okur).
  - player_shot_zones_match_mat shotmap upsert'lerinden SONRA (orkestrator
    zaten tum fetch/load adimlarinin ardindan kosar).
  - tsl_ss_player_detailed_metrics_global_mat diger tsl_ss mat'larindan ONCE.
  - bridged profil mat'i once, sonra mac logu + kimlik/bio.
  - team_current_squad_profile_mat bridged mat'lardan SONRA (sentetik-opta
    oyuncular kadroda gorunsun); PSM leaderboard/profil ondan SONRA.
  - kupa mat'lari en sonda (eski adim 3d de en sondaydi).

CONCURRENTLY: unique index'li mat'lar (shot_zones, squad_profile, kupa uclusu)
okuyucu kilitlemesin diye concurrently tazelenir; autocommit sart.

Kirli kaynak -> mat eslesmesi eski wrapper davranisinin birebir birlesimi:
  sofa  = eski adim 1 loader refresh'i + adim 3b refresh_tsl_mats
  flash = eski adim 2 FS loader refresh'i + adim 3 inline tff1 + adim 3b
  cup   = eski adim 3d refresh_cup_mats
Tek fark: mukerrerler tekillesti (or. squad_profile sofa turunda 2 kez,
tff1 player/team flash turunda 3 kez tazeleniyordu; artik 1'er kez).

Calistirma:
  refresh_orchestrator.py [--dry-run] sofa flash cup
  --dry-run: DB'ye baglanmadan tazelenecek listeyi sirayla basar.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SOFA, FLASH, CUP = "sofa", "flash", "cup"

# TEK TABLO: (mat adi, concurrently?, tetikleyen kaynaklar). Sira = tazeleme sirasi.
MATS = [
    # tff1 (1. Lig) + PSM cekirdegi
    ("tff1_player_season_stats_mat", False, {SOFA, FLASH}),
    ("tff1_team_season_stats_mat", False, {SOFA, FLASH}),
    ("tff1_player_match_log_mat", False, {SOFA, FLASH}),
    ("tff1_pm_player_season_mat", False, {SOFA, FLASH}),
    ("tff1_squad_mat", False, {SOFA, FLASH}),
    ("player_shot_zones_match_mat", True, {SOFA}),
    # tsl_ss zinciri (detailed_metrics_global ILK, digerleri ondan turer)
    ("tsl_ss_player_detailed_metrics_global_mat", False, {SOFA, FLASH}),
    ("tsl_ss_player_table_mat", False, {SOFA, FLASH}),
    ("tsl_ss_player_metric_leaderboard_mat", False, {SOFA, FLASH}),
    ("tsl_ss_player_metric_benchmarks_mat", False, {SOFA, FLASH}),
    ("tsl_ss_player_overview_advanced_mat", False, {SOFA, FLASH}),
    ("tsl_ss_team_detailed_metrics_mat", False, {SOFA, FLASH}),
    ("tsl_ss_team_metric_benchmarks_mat", False, {SOFA, FLASH}),
    ("tsl_ss_team_overview_advanced_mat", False, {SOFA, FLASH}),
    ("tsl_ss_squad_mat", False, {SOFA, FLASH}),
    ("tsl_player_advanced_season_mat", False, {SOFA, FLASH}),
    ("tsl_player_flashscore_season_mat", False, {SOFA, FLASH}),
    # SofaScore profil koprusu: profil ONCE, sonra mac logu + kimlik/bio
    ("player_profile_bridged_mat", False, {SOFA, FLASH}),
    ("player_match_log_sofascore_mat", False, {SOFA, FLASH}),
    ("player_current_info_bridged_mat", False, {SOFA, FLASH}),
    # kadro profili bridged'lerden SONRA; PSM sicak mat'lari ondan SONRA
    ("team_current_squad_profile_mat", True, {SOFA, FLASH}),
    ("player_metric_leaderboard_current_mat", False, {SOFA}),
    ("player_profile_mat", False, {SOFA}),
    # Avrupa kupasi oyuncu-sezon (H3)
    ("ucl_player_season_stats_mat", True, {CUP}),
    ("uel_player_season_stats_mat", True, {CUP}),
    ("uecl_player_season_stats_mat", True, {CUP}),
    # Avrupa kupasi takim-sezon (2026-08-20, eurocup_team_season_mats): team_xg
    # CTE'si oyuncu mat'ini (ince view uzerinden) okur -> oyunculardan SONRA.
    ("ucl_team_season_stats_mat", True, {CUP}),
    ("uel_team_season_stats_mat", True, {CUP}),
    ("uecl_team_season_stats_mat", True, {CUP}),
]

_CONC = {name: conc for name, conc, _ in MATS}


def _names(*wanted):
    """Tablo sirasini koruyarak ad listesi dondur (tanim tek yerde kalsin)."""
    wanted = set(wanted)
    return [n for n, _, _ in MATS if n in wanted]


# ---- Legacy profiller (bayraksiz yan yollar; eski liste + eski sira) ----
# load_sofascore_1lig_player_stats.refresh_mats'in tsl_ss disi kismi:
SOFA_LOADER_CORE = [
    "tff1_player_season_stats_mat",
    "tff1_team_season_stats_mat",
    "tff1_player_match_log_mat",
    "tff1_pm_player_season_mat",
    "tff1_squad_mat",
    "player_shot_zones_match_mat",
    "team_current_squad_profile_mat",
    "player_metric_leaderboard_current_mat",
    "player_profile_mat",
]
# ayni loader'in DEFER_TSL_MATS'siz tsl_ss kuyrugu (sira kanonik tabloyla ayni;
# kardes mat'lar arasi eski kucuk permutasyon davranissal olarak esdegerdi):
TSL_SS_MATS = _names(
    "tsl_ss_player_detailed_metrics_global_mat",
    "tsl_ss_player_table_mat",
    "tsl_ss_player_metric_leaderboard_mat",
    "tsl_ss_player_metric_benchmarks_mat",
    "tsl_ss_player_overview_advanced_mat",
    "tsl_ss_team_detailed_metrics_mat",
    "tsl_ss_team_metric_benchmarks_mat",
    "tsl_ss_team_overview_advanced_mat",
    "tsl_ss_squad_mat",
)
# load_flashscore_player_stats.refresh_mats (tff1 beslisi):
FLASH_LOADER_MATS = _names(
    "tff1_player_season_stats_mat",
    "tff1_team_season_stats_mat",
    "tff1_player_match_log_mat",
    "tff1_pm_player_season_mat",
    "tff1_squad_mat",
)
# refresh_tsl_mats.py zinciri (04:00 harita jobu + elle kosu bunu kullanir):
TSL_CHAIN_MATS = TSL_SS_MATS + _names(
    "tsl_player_advanced_season_mat",
    "tsl_player_flashscore_season_mat",
    "player_profile_bridged_mat",
    "player_match_log_sofascore_mat",
    "player_current_info_bridged_mat",
    "team_current_squad_profile_mat",
)
# refresh_cup_mats.py zinciri (oyuncu mat'lari ONCE, takim mat'lari SONRA):
CUP_CHAIN_MATS = _names(
    "ucl_player_season_stats_mat",
    "uel_player_season_stats_mat",
    "uecl_player_season_stats_mat",
    "ucl_team_season_stats_mat",
    "uel_team_season_stats_mat",
    "uecl_team_season_stats_mat",
)


def connect():
    import psycopg2
    from dotenv import dotenv_values

    env = dotenv_values(ROOT / ".env")
    conn = psycopg2.connect((env.get("DATABASE_URL") or "").strip().strip('"'))
    conn.autocommit = True  # CONCURRENTLY transaction icinde kosamaz
    return conn


def refresh_list(names, cur=None):
    """Verilen mat'lari sirayla tazele; biri patlasa da devam et.

    Donus: tazelenemeyen mat adlari (bos liste = hepsi tamam).
    """
    conn = None
    if cur is None:
        conn = connect()
        cur = conn.cursor()
    failed = []
    for name in names:
        conc = "concurrently " if _CONC[name] else ""
        try:
            cur.execute(f"refresh materialized view {conc}analytics.{name}")
            print(f"  refreshed analytics.{name}", flush=True)
        except Exception as exc:  # bir mat patlarsa digerleri yine tazelensin
            failed.append(name)
            print(f"  HATA analytics.{name}: {exc}", flush=True)
    if conn is not None:
        conn.close()
    return failed


def plan(sources):
    """Kirli kaynak kumesine gore tazelenecek mat'lar (tablo sirasiyla)."""
    return [n for n, _, srcs in MATS if srcs & sources]


def run(sources):
    names = plan(sources)
    print(f"[orch] kirli kaynak: {sorted(sources)} -> {len(names)} mat", flush=True)
    return refresh_list(names)


def main(argv):
    dry = "--dry-run" in argv
    sources = {a.strip().lower() for a in argv if a.strip() and a != "--dry-run"}
    unknown = sources - {SOFA, FLASH, CUP}
    if not sources or unknown:
        raise SystemExit(
            f"Kullanim: refresh_orchestrator.py [--dry-run] [sofa] [flash] [cup]"
            f"{' (bilinmeyen: ' + str(sorted(unknown)) + ')' if unknown else ''}")
    if dry:
        names = plan(sources)
        print(f"[orch dry-run] kirli kaynak: {sorted(sources)} -> {len(names)} mat")
        for n in names:
            print(f"  {'CONCURRENTLY ' if _CONC[n] else ''}analytics.{n}")
        return
    failed = run(sources)
    if failed:
        raise SystemExit(f"tazelenemeyen mat: {failed}")


if __name__ == "__main__":
    main(sys.argv[1:])

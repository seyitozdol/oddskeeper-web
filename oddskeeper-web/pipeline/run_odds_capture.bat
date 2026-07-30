@echo off
rem Bahis sitesi oran yakalama - zamanlanmis gorev sarmalayicisi
rem Bets10'u headless gezer, mac detay sayfalarindaki oranlari cikarir ve
rem tracker.site_event_odds + event_odds_availability tablolarina yukler.
rem Sure: lig basina ~12 mac detayi, toplam 10-20 dk.
set PYTHONUTF8=1
cd /d C:\Users\zygom\GitRepos\oddskeeper-web\oddskeeper-web\pipeline
.venv\Scripts\python.exe src\common\capture_odds_headless.py bets10 --load >> data\logs\odds_capture.log 2>&1

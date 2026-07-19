@echo off
rem Opta otomatik pipeline - zamanlanmis gorev sarmalayicisi
rem Yeni mac yoksa ~1 dk'da biter (sadece kesif), yeni maclar varsa parse+load yapar.
set PYTHONUTF8=1
cd /d C:\Users\zygom\GitRepos\oddskeeper-web\oddskeeper-web\pipeline
.venv\Scripts\python.exe src\football\auto_opta_pipeline.py >> data\logs\scheduled_task.log 2>&1

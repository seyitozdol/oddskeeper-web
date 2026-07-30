@echo off
rem Upcoming Event Tracker - zamanlanmis gorev sarmalayicisi
rem SofaScore'dan Turk takimlarinin yaklasan maclarini ceker (~1-2 dk surer).
set PYTHONUTF8=1
cd /d C:\Users\zygom\GitRepos\oddskeeper-web\oddskeeper-web\pipeline
.venv\Scripts\python.exe src\common\fetch_upcoming_events.py >> data\logs\upcoming_events.log 2>&1

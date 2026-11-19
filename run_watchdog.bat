@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONWARNINGS=ignore::DeprecationWarning
cd /d C:\wolvestracker
rem watchdog.py writes its own summary to watchdog_log.txt; stderr (tracebacks) goes to watchdog_err.log
"C:\Users\user\AppData\Local\Programs\Python\Python312\python.exe" scripts\watchdog.py %* >nul 2>> C:\wolvestracker\watchdog_err.log
exit /b %ERRORLEVEL%

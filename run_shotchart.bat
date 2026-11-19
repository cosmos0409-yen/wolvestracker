@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d C:\wolvestracker
"C:\Users\user\AppData\Local\Programs\Python\Python312\python.exe" scripts\fetch_shotchart.py >> C:\wolvestracker\shotchart_log.txt 2>&1

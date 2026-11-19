@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d C:\wolvestracker
rem Rotate fetch_log.txt when it exceeds 2 MB: move it to _local\logs\fetch_log_YYYYMMDD.txt
if exist C:\wolvestracker\fetch_log.txt for %%F in (C:\wolvestracker\fetch_log.txt) do if %%~zF GTR 2097152 call :rotate
"C:\Users\user\AppData\Local\Programs\Python\Python312\python.exe" scripts\fetch_data.py >> C:\wolvestracker\fetch_log.txt 2>&1
set FETCH_RC=%ERRORLEVEL%
"C:\Users\user\AppData\Local\Programs\Python\Python312\python.exe" scripts\sync_salary.py >> C:\wolvestracker\fetch_log.txt 2>&1
set SALARY_RC=%ERRORLEVEL%
rem Report fetch failure to Task Scheduler (LastTaskResult); salary sync still runs
if not "%FETCH_RC%"=="0" (
  echo [run_fetch] fetch_data.py failed, exit code %FETCH_RC% >> C:\wolvestracker\fetch_log.txt
  exit /b %FETCH_RC%
)
exit /b %SALARY_RC%

:rotate
set STAMP=
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set STAMP=%%d
if "%STAMP%"=="" exit /b 0
if not exist C:\wolvestracker\_local\logs mkdir C:\wolvestracker\_local\logs
rem A locked log (watchdog still writing) just stays put until the next run
move /y C:\wolvestracker\fetch_log.txt C:\wolvestracker\_local\logs\fetch_log_%STAMP%.txt >nul 2>&1
exit /b 0

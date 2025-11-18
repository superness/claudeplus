@echo off
REM Launch Chrome with remote debugging enabled
REM This must run on Windows side to properly expose the debug port

set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
set DEBUG_PORT=9222
set USER_DATA_DIR=C:\Temp\chrome-debug-profile
set TEST_URL=file:///C:/github/claudeplus/test-console-logging.html

echo Starting Chrome with remote debugging on port %DEBUG_PORT%...

start "" "%CHROME_PATH%" --remote-debugging-port=%DEBUG_PORT% --no-first-run --no-default-browser-check --user-data-dir=%USER_DATA_DIR% %TEST_URL%

echo Chrome started. Debug port should be available at http://localhost:%DEBUG_PORT%
echo Press any key to close this window (Chrome will keep running)
pause > nul

@echo off
REM Simple Chrome launcher with debugging
REM Double-click this file from Windows Explorer

"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=C:\Temp\chrome-debug-profile file:///C:/github/claudeplus/test-console-logging.html

echo Chrome should now be running with debug port 9222
pause

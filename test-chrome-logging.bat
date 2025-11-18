@echo off
REM Launch Chrome with built-in logging enabled
"C:\Program Files\Google\Chrome\Application\chrome.exe" --enable-logging --v=1 --user-data-dir=C:\temp\chrome-test-profile http://localhost:8080

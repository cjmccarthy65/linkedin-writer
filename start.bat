@echo off
echo Starting LinkedIn Writer...
echo Open your browser to: http://localhost:3000
start /b python -m http.server 3000
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Server is running. Press Ctrl+C to stop.
pause

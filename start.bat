@echo off
echo ==========================================
echo Starting MyClass Project (Frontend + API)
echo ==========================================

:: Start Both Servers
npm run dev:all

echo.
echo Both servers are running.
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:5001
echo.
pause

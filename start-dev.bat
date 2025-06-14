@echo off
echo Starting Diabot Development Environment...
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd backend && npm start"

echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo Starting Frontend Development Server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend: http://localhost:8090
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause > nul

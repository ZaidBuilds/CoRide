@echo off
rem Build CoRide for your Android phone against this PC's dev server.
rem Usage: phone.bat 192.168.1.5   (your PC's Wi-Fi IP from ipconfig)
if "%~1"=="" (
  echo Usage: phone.bat YOUR_PC_IP   e.g. phone.bat 192.168.1.5
  exit /b 1
)
echo [CoRide] Building for phone, API = http://%~1:4000
cd client
set VITE_API_URL=http://%~1:4000
call npm run build || exit /b 1
set CAP_CLEARTEXT=true
call npx cap sync android || exit /b 1
call npx cap run android

@echo off
cd /d C:\Users\cyy20\penalty-shootout
echo 正在启动点球大战游戏服务器...
echo 浏览器打开 http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.
npx vite --host --port 3000
pause

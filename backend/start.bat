@echo off
rem start.bat - Windows 后台启动脚本：运行 node server.js 并将日志写入 server.log
rem 后台启动后端服务（日志写入 server.log）
set PATH=C:\Program Files\nodejs;%PATH%
cd /d c:\Users\HP\WeChatProjects\miniprogram-1\backend
"C:\Program Files\nodejs\node.exe" server.js > server.log 2>&1

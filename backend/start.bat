@echo off
rem start.bat - Windows 本地开发启动脚本（开发环境 NODE_ENV=development，使用开发 JWT 密钥）
rem 生产/云托管环境不设置 NODE_ENV，必须配置 JWT_SECRET 环境变量
set PATH=C:\Program Files\nodejs;%PATH%
cd /d C:\Users\HP\WeChatProjects\miniprogram-1\backend
set NODE_ENV=development
"C:\Program Files\nodejs\node.exe" server.js > server.log 2>&1

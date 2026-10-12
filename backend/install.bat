@echo off
rem install.bat - Windows 后台安装脚本：清理旧依赖后用国内镜像源执行 npm install
rem 后台安装后端依赖（纯 JS 依赖，无需编译）
rem 关键：把 Node.js 目录加入本次会话 PATH
set PATH=C:\Program Files\nodejs;%PATH%
cd /d c:\Users\HP\WeChatProjects\miniprogram-1\backend
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
"C:\Program Files\nodejs\npm.cmd" install --no-fund --no-audit --registry=https://registry.npmmirror.com > npm-out.log 2>&1
echo INSTALL_DONE >> npm-out.log

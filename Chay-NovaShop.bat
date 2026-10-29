@echo off
chcp 65001 > nul
title ShopNova - Đang khởi chạy toàn bộ hệ thống...
echo ==============================================================
echo       SHOPNOVA - KHỞI ĐỘNG HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ
echo ==============================================================
echo.
echo Đang tự động chạy Data API (3001) + Backend (3000) + Frontend (5173)...
echo.
cd /d "%~dp0"
timeout /t 3 /nobreak > nul
start "" http://localhost:5173
node scripts/dev-all.mjs
pause


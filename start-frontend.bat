@echo off
title CodePath - Frontend Server
cd /d "%~dp0fronted"
npm run dev -- -p 3002
pause

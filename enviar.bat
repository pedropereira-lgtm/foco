@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo A enviar alteracoes para o GitHub...
echo.
git add -A
git commit -m "atualizacao" 2>nul
git push
echo.
echo ================================================
echo  Enviado. O Netlify faz o deploy sozinho.
echo ================================================
echo.
pause

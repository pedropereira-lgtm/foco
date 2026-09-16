@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo A ligar a pasta ao repositorio do GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/pedropereira-lgtm/foco.git
git branch -M main
git push -u origin main
echo.
echo ================================================
echo  Se apareceu "main -> main", correu bem.
echo  Daqui em diante usa o enviar.bat.
echo ================================================
pause

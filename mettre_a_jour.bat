@echo off
rem Met a jour les donnees de l'observatoire a partir de la base Sitadel.
rem Double-cliquez sur ce fichier ; il faut Python 3 installe (https://www.python.org).
cd /d "%~dp0"
python scripts\maj_donnees.py
rem Regles d'urbanisme de chaque permis (necessite Node.js ; ignore si absent)
where node >nul 2>nul && node scripts\regles_permis.js
echo.
pause

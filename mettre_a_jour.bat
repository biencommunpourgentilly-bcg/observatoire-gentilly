@echo off
rem Met a jour les donnees de l'observatoire a partir de la base Sitadel.
rem Double-cliquez sur ce fichier ; il faut Python 3 installe (https://www.python.org).
cd /d "%~dp0"
python -m pip install --quiet --user pillow
python scripts\maj_donnees.py
echo.
pause

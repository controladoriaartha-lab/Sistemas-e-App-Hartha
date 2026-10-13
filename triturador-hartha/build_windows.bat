@echo off
REM Gera o executavel portatil (um unico .exe, sem instalacao) em dist\TrituradorHartha.exe
REM Requisito (apenas para gerar): Python 3 instalado.
python -m pip install --upgrade pyinstaller
python -m PyInstaller --onefile --windowed --name TrituradorHartha triturador.py
echo.
echo Pronto: dist\TrituradorHartha.exe  (copie para qualquer pendrive)
pause

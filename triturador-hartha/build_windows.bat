@echo off
REM Gera o executavel portatil SEM tela preta, com icone: dist\TrituradorHartha.exe
REM Requisito (apenas para gerar): Python 3 instalado.
python -m pip install --upgrade pyinstaller
python -m PyInstaller --onefile --noconsole --windowed --clean --name TrituradorHartha --icon icone.ico --add-data "icone.ico;." triturador.py
echo.
echo Pronto: dist\TrituradorHartha.exe
echo Para criar o atalho na Area de Trabalho, de dois cliques em criar_atalho.vbs
pause

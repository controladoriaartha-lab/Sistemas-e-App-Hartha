# Abre o Triturador SEM tela preta (a extensao .pyw usa pythonw, sem console).
# Dica: para nao depender de como o Windows associa .pyw, use o atalho criado por criar_atalho.vbs
# (ele chama o pythonw.exe diretamente e traz o logo).
import os
import sys


def _avisar(texto):
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, texto, "Triturador Hartha", 0x10)
    except Exception:
        pass


try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import triturador
except Exception:
    import traceback
    _avisar("Nao foi possivel carregar o programa (versao do Python muito antiga?):\n\n"
            + traceback.format_exc()[-800:])
    sys.exit(1)

sys.exit(triturador.main())

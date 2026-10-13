# Abre o Triturador SEM tela preta (a extensao .pyw usa pythonw, sem console).
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import tkinterdnd2  # noqa: F401  (arrastar e soltar)
except ImportError:  # instala uma vez, em silencio; sem internet, abre sem arrastar
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "--user", "tkinterdnd2"],
                       creationflags=0x08000000, timeout=120)
    except Exception:
        pass
import triturador
triturador.main()

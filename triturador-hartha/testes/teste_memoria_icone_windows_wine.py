import os, sys, time, tempfile, ctypes, re
from ctypes import wintypes
fase = sys.argv[1]
_log = open(r'Z:\tmp\gt\w4.log', 'a')
def P(*a): _log.write(' '.join(map(str, a)) + '\n'); _log.flush()
import faulthandler; faulthandler.enable(_log)
sys.path.insert(0, r"Z:\home\user\Sistemas-e-App-Hartha\triturador-hartha")
import tkinter as tk
from tkinter import messagebox, filedialog
import triturador
messagebox.askyesno = lambda *a, **k: True
messagebox.showerror = lambda *a, **k: P("ERRO", a)
def walk(w):
    yield w
    for c in w.winfo_children(): yield from walk(c)
def pump(r, s):
    t = time.time()
    while time.time() - t < s: r.update(); time.sleep(0.02)
u32 = ctypes.windll.user32
u32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]; u32.SendMessageW.restype = ctypes.c_ssize_t
u32.GetParent.argtypes = [wintypes.HWND]; u32.GetParent.restype = wintypes.HWND
def estado(root, rot, mini):
    m = re.match(r"(\d+)x(\d+)\+(-?\d+)\+(-?\d+)", root.geometry())
    P("%-16s -> %sx%s pos=(%s,%s) mini=%s" % (rot, m.group(1), m.group(2), m.group(3), m.group(4), mini.mini))
def script(root):
    pump(root, 1.5)
    W = list(walk(root))
    mini = [w for w in W if isinstance(w, triturador.BotaoMini)][0]
    head = [w for w in W if isinstance(w, triturador.Cabecalho)][0]
    if fase == "1":
        estado(root, "F1 abriu", mini)
        root.geometry("+230+140"); pump(root, 0.4)
        mini.invoke(); pump(root, 0.6); root.geometry("+310+205"); pump(root, 0.4)
        estado(root, "F1 mini movido", mini)
    elif fase in ("2", "3"):
        estado(root, "F%s reabriu" % fase, mini)
        if fase == "2":
            mini.invoke(); pump(root, 0.6); root.geometry("+120+90"); pump(root, 0.4)
            estado(root, "F2 aberto movido", mini)
    elif fase == "6":
        top = u32.GetParent(root.winfo_id())
        big = u32.SendMessageW(top, 0x007F, 1, 0); small = u32.SendMessageW(top, 0x007F, 0, 0)
        P("icone da janela (WM_GETICON): grande=%s pequeno=%s" % ("OK" if big else "VAZIO", "OK" if small else "VAZIO"))
        p = ctypes.c_wchar_p()
        hr = ctypes.windll.shell32.GetCurrentProcessExplicitAppUserModelID(ctypes.byref(p))
        P("AppUserModelID (hr=%s): %s" % (hr, p.value))
        tmp = tempfile.mkdtemp(); arq = []
        for i in range(3):
            f = os.path.join(tmp, "w%d.bin" % i); open(f, "wb").write(os.urandom(2_000_000)); arq.append(f)
        filedialog.askopenfilenames = lambda **k: arq
        [b for b in W if isinstance(b, triturador.Botao) and b.texto == "ADICIONAR ARQUIVOS"][0].invoke()
        go = [b for b in W if isinstance(b, triturador.Botao) and "TRITURAR" in b.texto][0]
        go.invoke(); vistos = []; t = time.time()
        while time.time() - t < 9:
            root.update(); time.sleep(0.02)
            if not vistos or vistos[-1] != head.pct: vistos.append(head.pct)
        P("percentuais:", vistos)
        P("arquivos restantes:", [os.path.exists(f) for f in arq])
    pump(root, 0.2)
    root.tk.call(root.tk.call("wm", "protocol", ".", "WM_DELETE_WINDOW"))
tk.Tk.mainloop = lambda self, n=0: script(self)
triturador.run_gui()

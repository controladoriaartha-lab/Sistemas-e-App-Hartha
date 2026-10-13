import os, sys, time, tempfile, ctypes, struct
_log = open(r'Z:\tmp\gt\w.log', 'w')
def print(*a):
    _log.write(' '.join(map(str, a)) + '\n'); _log.flush()
import faulthandler; faulthandler.enable(_log)
from ctypes import wintypes
sys.path.insert(0, r"Z:\home\user\Sistemas-e-App-Hartha\triturador-hartha")
import tkinter as tk
from tkinter import messagebox
import triturador
messagebox.askyesno = lambda *a, **k: True
messagebox.showerror = lambda *a, **k: print("ERRO", a)
tmp = tempfile.mkdtemp()
u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32
k32.GlobalAlloc.restype = ctypes.c_void_p; k32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
k32.GlobalLock.restype = ctypes.c_void_p; k32.GlobalLock.argtypes = [ctypes.c_void_p]
u32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
def make_hdrop(paths):
    data = ("\0".join(paths) + "\0\0").encode("utf-16-le")
    hdr = struct.pack("<IiiII", 20, 0, 0, 0, 1)
    h = k32.GlobalAlloc(0x42, len(hdr) + len(data)); p = k32.GlobalLock(h)
    ctypes.memmove(p, hdr + data, len(hdr) + len(data)); return h
def pump(root, s):
    t = time.time()
    while time.time() - t < s: root.update(); time.sleep(0.03)
def walk(w):
    yield w
    for c in w.winfo_children(): yield from walk(c)
def novo(nome):
    f = os.path.join(tmp, "alvo_%s.bin" % nome); open(f, "wb").write(os.urandom(20000)); return f
def script(root):
    pump(root, 1.5)
    print("janela existe:", bool(root.winfo_exists()), "| topmost:", root.attributes("-topmost"))
    W = list(walk(root))
    lb = [w for w in W if isinstance(w, tk.Listbox)][0]
    zona = [w for w in W if isinstance(w, triturador.Zona)][0]
    cab = [w for w in W if isinstance(w, triturador.Cabecalho)][0]
    bots = [w for w in W if isinstance(w, triturador.Botao)]
    go = [b for b in bots if "TRITURAR" in b.texto][0]
    peq = [b for b in bots if "LIMPAR" in b.texto][0]
    mini = [w for w in W if isinstance(w, triturador.BotaoMini)][0]
    mold = [w for w in root.winfo_children() if isinstance(w, tk.Canvas)][0]
    top = u32.GetParent(root.winfo_id())
    alvos = [("lista", lb.winfo_id()), ("faixa", zona.winfo_id()), ("titulo", cab.winfo_id()),
             ("botao", peq.winfo_id()), ("botaomini", mini.winfo_id()), ("moldura", mold.winfo_id()),
             ("root", root.winfo_id()), ("toplevel", top)]
    arqs = []
    for nome, hwnd in alvos:
        f = novo(nome); arqs.append(f); antes = lb.size()
        u32.PostMessageW(hwnd, 0x0233, make_hdrop([f]), 0); pump(root, 0.5)
        print("NORMAL drop em %-9s -> itens: %d -> %d" % (nome, antes, lb.size()))
    go.invoke(); pump(root, 7)
    print("NORMAL triturou:", [os.path.exists(x) for x in arqs], "| lista", lb.size(), "|", zona.texto)
    # ---- MINI
    mini.invoke(); pump(root, 1.0)
    print("MINI tamanho:", root.winfo_width(), "x", root.winfo_height(), "| mini:", mini.mini)
    arqs2 = []
    for nome, hwnd in (("faixa", zona.winfo_id()), ("titulo", cab.winfo_id()), ("botaomini", mini.winfo_id()),
                       ("root", root.winfo_id()), ("toplevel", top)):
        f = novo("m_" + nome); arqs2.append(f); antes = len(lb.get(0, "end"))
        u32.PostMessageW(hwnd, 0x0233, make_hdrop([f]), 0); pump(root, 0.5)
        print("MINI drop em %-9s -> itens: %d -> %d | %s" % (nome, antes, len(lb.get(0, "end")), zona.texto.replace("\n", " / ")))
    go.invoke(); pump(root, 7)
    print("MINI triturou:", [os.path.exists(x) for x in arqs2], "|", zona.texto)
    mini.invoke(); pump(root, 1.0)
    print("VOLTA:", root.winfo_width(), "x", root.winfo_height(), "| mini:", mini.mini, "| janela existe:", bool(root.winfo_exists()))
    root.destroy()
tk.Tk.mainloop = lambda self, n=0: script(self)
triturador.run_gui()
print("FIM OK")

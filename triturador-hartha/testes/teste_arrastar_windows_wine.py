import os, sys, time, tempfile, ctypes, struct
_log=open(r'Z:\tmp\gt\w.log','w')
def print(*a):
    _log.write(' '.join(map(str,a))+'\n'); _log.flush()
import faulthandler; faulthandler.enable(_log)
from ctypes import wintypes
sys.path.insert(0, r"Z:\home\user\Sistemas-e-App-Hartha\triturador-hartha")
import tkinter as tk
from tkinter import messagebox
import triturador
messagebox.askyesno = lambda *a, **k: True
messagebox.showerror = lambda *a, **k: print("ERRO", a)
tmp = tempfile.mkdtemp()
f1 = os.path.join(tmp, "arquivo com espaco.bin"); open(f1, "wb").write(os.urandom(100000))
f2 = os.path.join(tmp, "pasta teste"); os.makedirs(f2); open(os.path.join(f2, "a.txt"), "w").write("x")

f3 = os.path.join(tmp, "terceiro.bin"); open(f3, "wb").write(os.urandom(50000))
f4 = os.path.join(tmp, "quarto.bin"); open(f4, "wb").write(os.urandom(50000))
u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32
k32.GlobalAlloc.restype = ctypes.c_void_p; k32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
k32.GlobalLock.restype = ctypes.c_void_p; k32.GlobalLock.argtypes = [ctypes.c_void_p]
u32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
def make_hdrop(paths):
    data = ("\0".join(paths) + "\0\0").encode("utf-16-le")
    hdr = struct.pack("<IiiII", 20, 0, 0, 0, 1)  # DROPFILES, fWide=1
    h = k32.GlobalAlloc(0x42, len(hdr) + len(data))  # GHND
    p = k32.GlobalLock(h)
    ctypes.memmove(p, hdr + data, len(hdr) + len(data))
    return h

def pump(root, s):
    t = time.time()
    while time.time() - t < s:
        root.update(); time.sleep(0.03)

def script(root):
    pump(root, 1.5)
    print("janela existe apos 1.5s:", bool(root.winfo_exists()), "topmost:", root.attributes("-topmost"))
    W = list(triturador_walk(root))
    lb = [w for w in W if isinstance(w, tk.Listbox)][0]
    zona = [w for w in W if isinstance(w, triturador.Zona)][0]
    cab = [w for w in W if isinstance(w, triturador.Cabecalho)][0]
    bots = [w for w in W if isinstance(w, triturador.Botao)]
    go = [b for b in bots if "TRITURAR" in b.texto][0]
    peq = [b for b in bots if "LIMPAR" in b.texto][0]
    mold = [w for w in W if isinstance(w, tk.Canvas) and w not in bots and w not in (zona, cab)][0]
    top = u32.GetParent(root.winfo_id())
    alvos = [("lista", lb.winfo_id()), ("faixa", zona.winfo_id()), ("titulo", cab.winfo_id()),
             ("botao", peq.winfo_id()), ("moldura", mold.winfo_id()), ("root", root.winfo_id()),
             ("toplevel", top)]
    arqs = []
    for i, (nome, hwnd) in enumerate(alvos):
        f = os.path.join(tmp, "alvo_%s.bin" % nome); open(f, "wb").write(os.urandom(20000)); arqs.append(f)
        antes = lb.size()
        u32.PostMessageW(hwnd, 0x0233, make_hdrop([f]), 0)
        pump(root, 0.5)
        print("drop em %-9s -> itens: %d -> %d" % (nome, antes, lb.size()))
    pump(root, 0.5)
    print("janela ainda existe:", bool(root.winfo_exists()), "| itens:", lb.size())
    go.invoke()
    pump(root, 6)
    print("apos triturar -> restantes:", [os.path.exists(x) for x in arqs], "| lista:", lb.size())
    print("faixa:", zona.texto)
    root.destroy()

def triturador_walk(w):
    yield w
    for c in w.winfo_children(): yield from triturador_walk(c)

tk.Tk.mainloop = lambda self, n=0: script(self)
if os.environ.get('NOHOOK') or (len(sys.argv)>1 and sys.argv[1]=='nohook'):
    triturador._ativar_arrastar_windows = lambda *a, **k: None
triturador.run_gui()
print("FIM OK")

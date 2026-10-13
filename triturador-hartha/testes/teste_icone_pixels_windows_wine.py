import os, sys, time, ctypes, hashlib
from ctypes import wintypes
_log = open(r'Z:\tmp\gt\ico.log', 'w')
def P(*a): _log.write(' '.join(map(str, a)) + '\n'); _log.flush()
sys.path.insert(0, r"Z:\home\user\Sistemas-e-App-Hartha\triturador-hartha")
import tkinter as tk, triturador
u, g = ctypes.windll.user32, ctypes.windll.gdi32
u.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]; u.SendMessageW.restype = ctypes.c_ssize_t
u.GetParent.argtypes = [wintypes.HWND]; u.GetParent.restype = wintypes.HWND
u.LoadImageW.restype = wintypes.HANDLE; u.LoadImageW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR, wintypes.UINT, ctypes.c_int, ctypes.c_int, wintypes.UINT]
class ICONINFO(ctypes.Structure):
    _fields_ = [("fIcon", wintypes.BOOL), ("xHotspot", wintypes.DWORD), ("yHotspot", wintypes.DWORD), ("hbmMask", wintypes.HBITMAP), ("hbmColor", wintypes.HBITMAP)]
class BMI(ctypes.Structure):
    _fields_ = [("biSize", wintypes.DWORD), ("biWidth", ctypes.c_long), ("biHeight", ctypes.c_long), ("biPlanes", wintypes.WORD), ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD), ("biSizeImage", wintypes.DWORD), ("a", ctypes.c_long), ("b", ctypes.c_long), ("c", wintypes.DWORD), ("d", wintypes.DWORD)]
def pixels(hicon, n):
    ii = ICONINFO(); u.GetIconInfo(hicon, ctypes.byref(ii))
    bmi = BMI(); bmi.biSize = ctypes.sizeof(BMI); bmi.biWidth = n; bmi.biHeight = -n; bmi.biPlanes = 1; bmi.biBitCount = 32
    buf = ctypes.create_string_buffer(n * n * 4); dc = u.GetDC(None)
    g.GetDIBits(dc, ii.hbmColor, 0, n, buf, ctypes.byref(bmi), 0); u.ReleaseDC(None, dc)
    return buf.raw
def media(b):
    px = [(b[i+2], b[i+1], b[i]) for i in range(0, len(b), 4) if b[i+3] or True]
    n = len(px); return tuple(sum(p[k] for p in px)//n for k in range(3))
def walk(w):
    yield w
    for c in w.winfo_children(): yield from walk(c)
def script(root):
    t = time.time()
    while time.time() - t < 1.5: root.update(); time.sleep(0.02)
    top = u.GetParent(root.winfo_id())
    n = u.GetSystemMetrics(11)
    hb = u.SendMessageW(top, 0x7F, 1, 0)
    ico = os.path.join(r"Z:\home\user\Sistemas-e-App-Hartha\triturador-hartha", "icone.ico")
    ref = u.LoadImageW(None, ico, 1, n, n, 0x10)
    a, b = pixels(hb, n), pixels(ref, n)
    P("icone grande da janela: %s | tamanho %dpx | igual ao icone.ico: %s | cor media janela=%s ico=%s" % ("OK" if hb else "VAZIO", n, a == b, media(a), media(b)))
    root.destroy()
tk.Tk.mainloop = lambda self, n=0: script(self)
triturador.run_gui()

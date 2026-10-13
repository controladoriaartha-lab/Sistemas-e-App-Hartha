import sys, time, faulthandler
_log=open(r'Z:\tmp\gt\m.log','w'); faulthandler.enable(_log)
def P(*a): _log.write(' '.join(map(str,a))+'\n'); _log.flush()
sys.path.insert(0, r"Z:\home\user\Sistemas-e-App-Hartha\triturador-hartha")
import tkinter as tk, ctypes, triturador
mode = sys.argv[1]
root = tk.Tk(); lb = tk.Listbox(root); lb.pack(); lab = tk.Label(root, text="x", height=3); lab.pack(); root.update()
got = []
try:
    if mode == "none": pass
    elif mode == "root": triturador._ativar_arrastar_windows([root], got.extend)
    elif mode == "lb": triturador._ativar_arrastar_windows([lb], got.extend)
    elif mode == "lab": triturador._ativar_arrastar_windows([lab], got.extend)
    elif mode == "two": triturador._ativar_arrastar_windows([root, lab, lb], got.extend)
    elif mode == "all": triturador._ativar_arrastar_windows([root, lb], got.extend)
    for _ in range(30): root.update(); time.sleep(0.02)
    P(mode, "OK sobreviveu")
except Exception as e:
    P(mode, "EXC", e)

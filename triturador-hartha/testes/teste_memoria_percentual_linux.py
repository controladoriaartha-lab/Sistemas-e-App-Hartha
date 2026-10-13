import os, sys, time, tempfile, subprocess, json
sys.path.insert(0, "/home/user/Sistemas-e-App-Hartha/triturador-hartha")
import tkinter as tk
from tkinter import messagebox, filedialog
import triturador
fase = sys.argv[1]
messagebox.askyesno = lambda *a, **k: True
messagebox.showinfo = lambda *a, **k: None
def walk(w):
    yield w
    for c in w.winfo_children(): yield from walk(c)
def pump(r, s):
    t = time.time()
    while time.time() - t < s: r.update(); time.sleep(0.02)
def shot(n): subprocess.run(["import", "-window", "root", "/tmp/gt/%s.png" % n])
def info(root, rot):
    print("%-22s -> %dx%d  pos=%s  mini=%s" % (rot, root.winfo_width(), root.winfo_height(), triturador.re.match(r"\d+x\d+\+(-?\d+)\+(-?\d+)", root.geometry()).groups(), [w for w in walk(root) if isinstance(w, triturador.BotaoMini)][0].mini))
def script(root):
    pump(root, 1.0)
    W = list(walk(root))
    mini = [w for w in W if isinstance(w, triturador.BotaoMini)][0]
    head = [w for w in W if isinstance(w, triturador.Cabecalho)][0]
    if fase == "1":   # abre normal -> move -> vira mini -> move -> fecha
        info(root, "1 abriu (padrao)")
        root.geometry("+230+140"); pump(root, 0.4)
        mini.invoke(); pump(root, 0.5)
        root.geometry("+310+205"); pump(root, 0.4)
        info(root, "1 mini movido")
        root.protocol_cmd = None
        root.event_generate("<<Fechar>>")
    elif fase in ("2", "4"):
        info(root, fase + " reabriu")
        if fase == "2":
            mini.invoke(); pump(root, 0.6)   # expande
            root.geometry("+120+90"); pump(root, 0.4)
            info(root, "2 aberto movido")
        shot("m%s" % fase)
    elif fase == "5":  # percentual durante trituracao + sombras
        tmp = tempfile.mkdtemp(); arq = []
        for i in range(4):
            f = os.path.join(tmp, "g%d.bin" % i); open(f, "wb").write(os.urandom(3_000_000)); arq.append(f)
        filedialog.askopenfilenames = lambda **k: arq
        [b for b in W if isinstance(b, triturador.Botao) and b.texto == "ADICIONAR ARQUIVOS"][0].invoke()
        go = [b for b in W if isinstance(b, triturador.Botao) and "TRITURAR" in b.texto][0]
        shot("p0_antes"); go.invoke(); vistos = []; t = time.time(); shots = 0
        while time.time() - t < 7:
            root.update(); time.sleep(0.02)
            if not vistos or vistos[-1] != head.pct: vistos.append(head.pct)
            if shots == 0 and time.time() - t > 1.2: shot("p1_meio"); shots = 1
        print("percentuais vistos:", vistos)
        print("arquivos restantes:", [os.path.exists(f) for f in arq])
    root.event_generate("<<Fechar>>") if False else None
    if fase != "1": root.destroy() if False else None
    # fecha como o usuario: aciona o protocolo WM_DELETE_WINDOW
    root.tk.call("wm", "protocol", ".", "WM_DELETE_WINDOW") if False else None
    pump(root, 0.2)
    cmd = root.tk.call("wm", "protocol", ".", "WM_DELETE_WINDOW")
    root.tk.call(cmd)
tk.Tk.mainloop = lambda self, n=0: script(self)
triturador.run_gui()

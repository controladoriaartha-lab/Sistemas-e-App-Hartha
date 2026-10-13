import os, sys, time, tempfile, subprocess
sys.path.insert(0, "/home/user/Sistemas-e-App-Hartha/triturador-hartha")
import tkinter as tk
from tkinter import messagebox, filedialog
import triturador
messagebox.askyesno = lambda *a, **k: True
messagebox.showinfo = lambda *a, **k: print("INFO", a)
messagebox.showwarning = lambda *a, **k: print("WARN", a)
messagebox.showerror = lambda *a, **k: print("ERRO", a)
tmp = tempfile.mkdtemp()
def mk(n):
    out = []
    for i in range(n):
        f = os.path.join(tmp, "arq %d.bin" % i); open(f, "wb").write(os.urandom(200000)); out.append(f)
    return out
lote1, lote2 = mk(3), [os.path.join(tmp, "m%d.bin" % i) for i in range(2)]
for f in lote2: open(f, "wb").write(os.urandom(100000))
def walk(w):
    yield w
    for c in w.winfo_children(): yield from walk(c)
def shot(n): subprocess.run(["import", "-window", "root", "/tmp/gt/%s.png" % n])
def pump(r, s):
    t = time.time()
    while time.time() - t < s: r.update(); time.sleep(0.03)
def script(root):
    pump(root, 0.8)
    W = list(walk(root))
    print("topmost:", root.attributes("-topmost"))
    lb = [w for w in W if isinstance(w, tk.Listbox)][0]
    zona = [w for w in W if isinstance(w, triturador.Zona)][0]
    bots = [w for w in W if isinstance(w, triturador.Botao)]
    go = [b for b in bots if "TRITURAR" in b.texto][0]
    mini = [w for w in W if isinstance(w, triturador.BotaoMini)][0]
    filedialog.askopenfilenames = lambda **k: lote1
    [b for b in bots if "ARQUIVOS" in b.texto and "ADICIONAR" in b.texto][0].invoke()
    pump(root, 0.3); shot("v1_normal"); print("normal:", root.winfo_width(), "x", root.winfo_height(), "itens", lb.size())
    go.invoke(); pump(root, 1.6); shot("v2_tesouras"); pump(root, 0.4); shot("v2b_tesouras")
    pump(root, 4.5); print("apos 1o lote:", [os.path.exists(f) for f in lote1], "| faixa:", zona.texto)
    # ---- mini
    mini.invoke(); pump(root, 0.8)
    print("mini:", root.winfo_width(), "x", root.winfo_height(), "mini?", mini.mini)
    triturador_add = None
    shot("v3_mini_vazio")
    # arrastar simulado: usa a fila do app via botao nao disponivel no mini -> usa callback do dialogo pelo atalho add
    filedialog.askopenfilenames = lambda **k: lote2
    [b for b in bots if "ADICIONAR ARQUIVOS" in b.texto][0].invoke()  # (botao oculto, mas invoke funciona)
    pump(root, 0.4); shot("v4_mini_itens"); print("mini itens:", lb.size(), "| texto:", zona.texto.replace("\n", " / "))
    go.invoke(); pump(root, 1.8); shot("v5_mini_tesouras")
    pump(root, 5); shot("v6_mini_fim"); print("apos mini:", [os.path.exists(f) for f in lote2], "| faixa:", zona.texto)
    # ---- volta ao normal
    mini.invoke(); pump(root, 0.8); shot("v7_volta")
    print("volta:", root.winfo_width(), "x", root.winfo_height(), "mini?", mini.mini)
    root.destroy()
tk.Tk.mainloop = lambda self, n=0: script(self)
triturador.run_gui()
print("OK sem excecoes")

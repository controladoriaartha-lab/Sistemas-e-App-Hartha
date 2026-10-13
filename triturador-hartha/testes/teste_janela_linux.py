import os, sys, time, tempfile, subprocess
sys.path.insert(0, "/home/user/Sistemas-e-App-Hartha/triturador-hartha")
import tkinter as tk
from tkinter import messagebox
import triturador

messagebox.askyesno = lambda *a, **k: True
messagebox.showinfo = lambda *a, **k: print("INFO", a)
messagebox.showwarning = lambda *a, **k: print("WARN", a)
messagebox.showerror = lambda *a, **k: print("ERRO", a)

tmp = tempfile.mkdtemp()
files = []
for i in range(3):
    f = os.path.join(tmp, "arq %d.bin" % i); open(f, "wb").write(os.urandom(500000)); files.append(f)
os.makedirs(os.path.join(tmp, "pasta/sub")); open(os.path.join(tmp, "pasta/sub/x.txt"), "w").write("oi")
files.append(os.path.join(tmp, "pasta"))

def walk(w):
    yield w
    for c in w.winfo_children(): yield from walk(c)

def shot(name):
    subprocess.run(["import", "-window", "root", "/tmp/gt/%s.png" % name])

def pump(root, secs):
    t = time.time()
    while time.time() - t < secs:
        root.update(); time.sleep(0.03)

def script(root):
    pump(root, 0.8); shot("1_inicio")
    print("topmost:", root.attributes("-topmost"))
    lb = [w for w in walk(root) if isinstance(w, tk.Listbox)][0]
    go = [w for w in walk(root) if isinstance(w, triturador.Botao) and "TRITURAR" in w.texto][0]
    # simula o que o arrastar chama: add() via botoes nao testavel; usa callback do 'Adicionar' substituindo dialogos
    from tkinter import filedialog
    filedialog.askopenfilenames = lambda **k: files[:3]
    filedialog.askdirectory = lambda **k: files[3]
    for b in [w for w in walk(root) if isinstance(w, triturador.Botao)]:
        if "ADICIONAR" in b.texto: b.invoke()
    pump(root, 0.3); shot("2_lista"); print("itens na lista:", lb.size())
    go.invoke()
    pump(root, 1.0); shot("3_fogo")
    pump(root, 3.5); shot("4_fim")
    print("restantes no disco:", [os.path.exists(f) for f in files])
    print("faixa:", [w.texto for w in walk(root) if isinstance(w, triturador.Zona)])
    root.destroy()

orig = tk.Tk.mainloop
def ml(self, n=0):
    script(self)
tk.Tk.mainloop = ml
triturador.run_gui()
print("OK sem excecoes")

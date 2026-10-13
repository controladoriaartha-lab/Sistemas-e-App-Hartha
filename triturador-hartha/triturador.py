#!/usr/bin/env python3
"""Triturador Hartha - exclusao permanente de arquivos (portatil, sem dependencias).

Cada arquivo e sobrescrito varias vezes (padroes + dados aleatorios), truncado,
renomeado e so entao removido. Nao passa pela lixeira.

Uso (GUI):  python triturador.py
Uso (CLI):  python triturador.py [--passes N] [--yes] CAMINHO [CAMINHO ...]
"""
import argparse
import math
import os
import random
import secrets
import stat
import sys

CHUNK = 1024 * 1024  # 1 MiB
PATTERNS = [b"\x00", b"\xff", b"\x55", b"\xaa"]


class ShredError(Exception):
    pass


def _protected(path):
    """Impede apagar raiz de unidade, pasta do usuario e diretorios do sistema."""
    p = os.path.realpath(path)
    home = os.path.realpath(os.path.expanduser("~"))
    anchor = os.path.splitdrive(p)[0] + os.sep if os.name == "nt" else os.sep
    blocked = {os.path.realpath(anchor), home, os.path.dirname(home)}
    for var in ("SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"):
        if os.environ.get(var):
            blocked.add(os.path.realpath(os.environ[var]))
    if os.name != "nt":
        blocked.update(os.path.realpath(d) for d in
                       ("/bin", "/boot", "/dev", "/etc", "/lib", "/proc", "/root",
                        "/sbin", "/sys", "/usr", "/var", "/home"))
    return p in blocked


def _overwrite(f, size, passes):
    for n in range(passes):
        f.seek(0)
        last = n == passes - 1
        # Ultima passada sempre aleatoria; as demais alternam padroes e aleatorio.
        use_random = last or n % 2 == 1
        pat = PATTERNS[(n // 2) % len(PATTERNS)]
        remaining = size
        while remaining > 0:
            k = min(CHUNK, remaining)
            f.write(secrets.token_bytes(k) if use_random else pat * k)
            remaining -= k
        f.flush()
        os.fsync(f.fileno())


def _unlink_anonymous(path):
    """Renomeia para nome aleatorio (apaga o nome original) e remove."""
    d = os.path.dirname(path)
    for _ in range(5):
        new = os.path.join(d, secrets.token_hex(8))
        if not os.path.exists(new):
            try:
                os.rename(path, new)
                path = new
            except OSError:
                pass
            break
    os.remove(path)


def shred_file(path, passes=3, progress=None):
    if os.path.islink(path):  # nunca segue link: remove so o atalho
        os.remove(path)
        return
    if not os.path.isfile(path):
        raise ShredError("nao e um arquivo regular: %s" % path)
    try:
        os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
    except OSError:
        pass
    size = os.path.getsize(path)
    if size:
        with open(path, "r+b", buffering=0) as f:
            _overwrite(f, size, passes)
            f.truncate(0)
            f.flush()
            os.fsync(f.fileno())
    _unlink_anonymous(path)
    if progress:
        progress(path)


def shred_path(path, passes=3, progress=None, errors=None):
    """Tritura arquivo ou pasta (recursivo). Devolve a lista de erros."""
    errors = [] if errors is None else errors
    path = os.path.abspath(path)
    if _protected(path):
        errors.append((path, "caminho protegido (raiz/sistema/pasta do usuario)"))
        return errors
    if os.path.isdir(path) and not os.path.islink(path):
        for root, dirs, files in os.walk(path, topdown=False):
            for name in files:
                fp = os.path.join(root, name)
                try:
                    shred_file(fp, passes, progress)
                except Exception as e:  # noqa: BLE001
                    errors.append((fp, str(e)))
            for name in dirs:
                dp = os.path.join(root, name)
                try:
                    if os.path.islink(dp):
                        os.remove(dp)
                    else:
                        os.rmdir(dp)
                except OSError as e:
                    errors.append((dp, str(e)))
        try:
            os.rmdir(path)
        except OSError as e:
            errors.append((path, str(e)))
    else:
        try:
            shred_file(path, passes, progress)
        except Exception as e:  # noqa: BLE001
            errors.append((path, str(e)))
    return errors


# ----------------------------------------------------------------------------- CLI
def run_cli(args):
    if not args.yes:
        print("Os itens abaixo serao APAGADOS PERMANENTEMENTE (sem recuperacao):")
        for p in args.paths:
            print("  -", p)
        if input("Digite APAGAR para confirmar: ").strip() != "APAGAR":
            print("Cancelado.")
            return 1
    errors = []
    for p in args.paths:
        shred_path(p, args.passes, progress=lambda x: print("triturado:", x), errors=errors)
    for p, e in errors:
        print("ERRO:", p, "-", e, file=sys.stderr)
    return 2 if errors else 0


# ----------------------------------------------------------------------------- GUI
class Fire:
    """Sistema de particulas das chamas (logica pura, independente da janela)."""

    def __init__(self, width, height):
        self.w, self.h = width, height
        self.p = []  # [x, y, vx, vy, vida, vida_max, raio, faisca]
        self.t = 0

    def resize(self, width, height):
        self.w, self.h = width, height

    def step(self, burning):
        self.t += 1
        if burning:
            for _ in range(max(4, self.w // 24)):  # chamas ao longo de toda a largura
                x = random.uniform(0, self.w)
                centro = 1 - abs(x - self.w / 2) / (self.w / 2)  # mais alto no meio
                vida = random.randint(18, 30 + int(22 * centro))
                self.p.append([x, self.h + 4, random.uniform(-.6, .6),
                               random.uniform(2.6, 4.6) * (0.8 + .5 * centro),
                               vida, vida, random.uniform(6, 12), False])
            for _ in range(2):  # faiscas
                vida = random.randint(25, 45)
                self.p.append([random.uniform(0, self.w), self.h - 5, random.uniform(-1.5, 1.5),
                               random.uniform(3, 6), vida, vida, random.uniform(1.5, 2.8), True])
        alive = []
        for q in self.p:
            q[0] += q[2] + math.sin((self.t + q[1]) / 9.0) * .7
            q[1] -= q[3]
            q[4] -= 1
            if q[4] > 0 and q[1] > -10:
                alive.append(q)
        self.p = alive[-1800:]

    @staticmethod
    def color(ratio, spark=False):
        """ratio 1 (nasce) -> 0 (morre): branco-amarelo, laranja, vermelho, brasa."""
        stops = [(0.0, (70, 20, 20)), (0.35, (190, 30, 15)), (0.7, (255, 115, 20)),
                 (1.0, (255, 205, 80))]
        if spark:
            return "#%02x%02x%02x" % (255, int(180 + 70 * ratio), int(60 + 120 * ratio))
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if ratio <= b:
                f = (ratio - a) / (b - a)
                return "#%02x%02x%02x" % tuple(int(x + (y - x) * f) for x, y in zip(ca, cb))
        return "#ffcd50"

    def shapes(self):
        """Lista (x0, y0, x1, y1, cor) de baixo p/ cima: velhas (grandes) primeiro."""
        out = []
        for x, y, _vx, _vy, vida, vmax, r, spark in sorted(self.p, key=lambda q: q[4]):
            ratio = vida / vmax
            rr = r * (0.35 + 0.65 * ratio) if not spark else r
            out.append((x - rr, y - rr * 1.35, x + rr, y + rr * 1.35, self.color(ratio, spark)))
        return out


TITULO = "TRITURADOR DE ARQUIVO PERMANENTE"
NAVY, GOLD, RED = "#142642", "#d4af37", "#c82d2d"


def parse_drop(tk_root, data):
    """Converte o texto de um evento de arrastar-e-soltar em lista de caminhos."""
    return [p for p in tk_root.tk.splitlist(data) if p]


def run_gui():
    import threading
    import time
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    try:  # arrastar-e-soltar (pip install tkinterdnd2); sem ele, so os botoes
        from tkinterdnd2 import DND_FILES, TkinterDnD
        root = TkinterDnD.Tk()
        dnd = True
    except Exception:  # noqa: BLE001
        root = tk.Tk()
        dnd = False
        DND_FILES = None

    root.title(TITULO)
    root.geometry("760x560")
    root.minsize(620, 460)
    root.configure(bg="#f3f4f7")
    try:
        base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
        root.iconbitmap(os.path.join(base, "icone.ico"))
    except Exception:  # noqa: BLE001  (icone e opcional)
        pass

    items = []

    # Cabecalho com o nome do aplicativo
    head = tk.Frame(root, bg=NAVY, height=70)
    head.pack(fill="x")
    tk.Label(head, text=TITULO, bg=NAVY, fg=GOLD,
             font=("Segoe UI", 18, "bold")).pack(expand=True, pady=(10, 0))
    tk.Label(head, text="Exclui sem lixeira e sem recuperacao", bg=NAVY, fg="#cfd6e4",
             font=("Segoe UI", 9)).pack(pady=(0, 8))

    # Area de soltar
    drop = tk.Label(
        root, bg="#fff7f7", fg=RED, bd=2, relief="groove", height=4,
        font=("Segoe UI", 12, "bold"),
        text=("ARRASTE E SOLTE AQUI\nquantos arquivos e pastas quiser" if dnd else
              "Use os botoes abaixo para escolher arquivos e pastas\n"
              "(arrastar exige: pip install tkinterdnd2)"))
    drop.pack(fill="x", padx=12, pady=(12, 6))

    bar_btn = ttk.Frame(root, padding=(12, 0))
    bar_btn.pack(fill="x")

    frame = ttk.Frame(root, padding=(12, 6))
    frame.pack(fill="both", expand=True)
    lb = tk.Listbox(frame, selectmode="extended", activestyle="none")
    sb = ttk.Scrollbar(frame, orient="vertical", command=lb.yview)
    lb.config(yscrollcommand=sb.set)
    sb.pack(side="right", fill="y")
    lb.pack(side="left", fill="both", expand=True)

    status = tk.StringVar(value="Nenhum item na lista.")
    passes = tk.IntVar(value=3)

    def refresh():
        status.set("%d item(ns) aguardando. Confira e clique em ACEITAR E TRITURAR." % len(items)
                   if items else "Nenhum item na lista.")

    def add(paths):
        for p in paths:
            p = os.path.abspath(p)
            if p not in items and os.path.exists(p):
                items.append(p)
                lb.insert("end", ("[PASTA] " if os.path.isdir(p) else "") + p)
        refresh()

    def on_drop(event):
        add(parse_drop(root, event.data))
        return event.action

    if dnd:
        for w in (root, drop, lb):
            w.drop_target_register(DND_FILES)
            w.dnd_bind("<<Drop>>", on_drop)

    def add_files():
        add(filedialog.askopenfilenames(title="Escolha os arquivos (varios permitidos)"))

    def add_folder():
        d = filedialog.askdirectory(title="Escolha a pasta")
        if d:
            add([d])

    def remove_sel():
        for i in reversed(lb.curselection()):
            lb.delete(i)
            del items[i]
        refresh()

    def clear_all():
        lb.delete(0, "end")
        items.clear()
        refresh()

    ttk.Button(bar_btn, text="Adicionar arquivos...", command=add_files).pack(side="left")
    ttk.Button(bar_btn, text="Adicionar pasta...", command=add_folder).pack(side="left", padx=4)
    ttk.Button(bar_btn, text="Remover selecionados", command=remove_sel).pack(side="left")
    ttk.Button(bar_btn, text="Limpar lista", command=clear_all).pack(side="left", padx=4)
    ttk.Label(bar_btn, text="Passadas:").pack(side="left", padx=(14, 2))
    ttk.Spinbox(bar_btn, from_=1, to=35, width=4, textvariable=passes).pack(side="left")

    fogo = tk.Canvas(root, height=130, bg="#10151f", highlightthickness=0)
    fogo.pack(fill="x", padx=12, pady=(2, 4))
    sim = Fire(740, 130)
    est = {"burning": False, "msg": "Pronto para triturar"}

    def tick():
        w, h = max(fogo.winfo_width(), 100), max(fogo.winfo_height(), 60)
        sim.resize(w, h)
        sim.step(est["burning"])
        fogo.delete("all")
        for x0, y0, x1, y1, c in sim.shapes():
            fogo.create_oval(x0, y0, x1, y1, fill=c, outline="")
        for dx, dy, cor in ((2, 2, "black"), (0, 0, "white")):  # sombra p/ leitura
            fogo.create_text(w / 2 + dx, h / 2 + dy, text=est["msg"], fill=cor,
                             font=("Segoe UI", 13, "bold"), width=w - 40)
        root.after(40, tick)

    tick()
    ttk.Label(root, textvariable=status).pack(fill="x", padx=12)
    go = tk.Button(root, text="ACEITAR E TRITURAR", bg=RED, fg="white", bd=0,
                   font=("Segoe UI", 12, "bold"), activebackground="#9c2020",
                   activeforeground="white", cursor="hand2", pady=8)
    go.pack(fill="x", padx=12, pady=10)

    def work(targets, n):
        errs, count = [], [0]
        t0 = time.time()

        def prog(p):
            count[0] += 1
            est["msg"] = "TRITURANDO...  " + os.path.basename(p)

        for t in targets:
            shred_path(t, n, prog, errs)
        # garante que as chamas aparecam mesmo para arquivos pequenos (min. 3 s)
        root.after(int(max(0, 3.0 - (time.time() - t0)) * 1000), done, errs, count[0])

    def done(errs, count):
        est["burning"] = False
        go.config(state="normal")
        clear_all()
        est["msg"] = "Concluido: %d arquivo(s) apagado(s) permanentemente" % count
        status.set("Concluido: %d arquivo(s) triturado(s), %d erro(s)." % (count, len(errs)))
        if errs:
            messagebox.showwarning("Erros", "\n".join("%s: %s" % e for e in errs[:20]))

    def start():
        if not items:
            messagebox.showinfo(TITULO, "Arraste arquivos ou pastas para a janela primeiro.")
            return
        if not messagebox.askyesno(
                "Confirmar exclusao permanente",
                "%d item(ns) serao apagados PERMANENTEMENTE.\nNao ha como desfazer.\n\nAceitar?"
                % len(items), icon="warning"):
            return
        go.config(state="disabled")
        est["burning"] = True
        est["msg"] = "TRITURANDO..."
        threading.Thread(target=work, args=(list(items), max(1, passes.get())),
                         daemon=True).start()

    go.config(command=start)
    root.mainloop()


def main():
    # Em executavel "sem console" (--windowed) stdout/stderr nao existem.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
    ap = argparse.ArgumentParser(description="Exclusao permanente de arquivos e pastas.")
    ap.add_argument("paths", nargs="*", help="arquivos/pastas (sem argumentos abre a interface)")
    ap.add_argument("-p", "--passes", type=int, default=3, help="passadas de sobrescrita (padrao 3)")
    ap.add_argument("-y", "--yes", action="store_true", help="nao pedir confirmacao")
    a = ap.parse_args()
    a.passes = max(1, a.passes)
    if not a.paths:
        run_gui()
        return 0
    return run_cli(a)


if __name__ == "__main__":
    sys.exit(main())

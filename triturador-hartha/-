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
    """Chamas nitidas (linguas de fogo em camadas) + faiscas. Logica pura, sem janela."""

    LAYERS = ((1.00, 1.00, "#d9301a"), (0.80, 0.78, "#ff7a1a"),
              (0.58, 0.55, "#ffc12e"), (0.34, 0.32, "#fff4b8"))  # (largura, altura, cor)

    def __init__(self, width, height):
        self.w, self.h, self.t = width, height, 0
        self.sparks = []  # [x, y, vx, vy, vida, vida_max, raio]
        self.n = 0
        self.tongues = []
        self.intensity = 0.0

    def _build(self):
        self.n = max(7, int(self.w // 60))
        self.tongues = [(random.uniform(0, 6.3), random.uniform(.10, .17), random.uniform(.8, 1.0))
                        for _ in range(self.n)]

    def resize(self, width, height):
        self.w, self.h = width, height
        if not self.n or self.n != max(7, int(width // 60)):
            self._build()

    def step(self, burning):
        self.t += 1
        self.intensity = min(1.0, self.intensity + 0.12) if burning else max(0.0, self.intensity - 0.07)
        if self.intensity > 0.3:
            for _ in range(2):
                vida = random.randint(26, 46)
                self.sparks.append([random.uniform(self.w * .05, self.w * .95), self.h * .8,
                                    random.uniform(-.9, .9), random.uniform(2.4, 4.6),
                                    vida, vida, random.uniform(1.4, 2.6)])
        for q in self.sparks:
            q[0] += q[2] + math.sin((self.t + q[1]) / 7.0) * .6
            q[1] -= q[3]
            q[4] -= 1
        self.sparks = [q for q in self.sparks if q[4] > 0 and q[1] > -6]

    def _tongue(self, i):
        phase, speed, base = self.tongues[i]
        cx = (i + .5) * self.w / self.n
        centro = 1 - abs(cx - self.w / 2) / (self.w / 2) * .55
        flick = .72 + .18 * math.sin(self.t * speed * 3 + phase) + .10 * math.sin(self.t * speed * 7.3 + phase * 2)
        height = self.h * .95 * centro * base * flick * self.intensity
        sway = math.sin(self.t * speed + phase) * self.w / self.n * .30
        return cx, (self.w / self.n) * 1.15, height, sway

    def shapes(self):
        """[('poly', [x,y,...], cor)] de tras para frente, depois [('spark', x,y,r,cor)]."""
        out = []
        if self.intensity > 0.02:
            order = sorted(range(self.n), key=lambda i: self._tongue(i)[2])  # altas ao fundo
            for i in reversed(order):
                cx, bw, height, sway = self._tongue(i)
                for wk, hk, cor in self.LAYERS:
                    pts_l, pts_r = [], []
                    for k in range(0, 13):
                        u = k / 12.0
                        half = bw / 2 * wk * (1 - u ** 1.5) ** 1.15
                        x = cx + sway * u * u
                        y = self.h + 2 - u * height * hk
                        pts_l += [x - half, y]
                        pts_r = [x + half, y] + pts_r
                    out.append(("poly", pts_l + pts_r, cor))
        for x, y, _vx, _vy, vida, vmax, r in self.sparks:
            ratio = vida / vmax
            cor = "#fff6c8" if ratio > .55 else "#ffc233" if ratio > .25 else "#ff7a1a"
            out.append(("spark", x, y, r * (.5 + .5 * ratio), cor))
        return out


TITULO = "TRITURADOR DE ARQUIVO PERMANENTE"
NAVY, GOLD, RED = "#142642", "#d4af37", "#c82d2d"


_REFS_ARRASTAR = []  # mantem os callbacks vivos (se o Python os descartar, o programa trava)


def _ativar_arrastar_windows(widgets, on_files):
    """Arrastar-e-soltar nativo do Windows (sem bibliotecas extras). Chama on_files(lista)."""
    import ctypes
    from ctypes import wintypes

    user32, shell32 = ctypes.windll.user32, ctypes.windll.shell32
    WM_DROPFILES, GWL_WNDPROC = 0x0233, -4
    WNDPROC = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, wintypes.HWND, wintypes.UINT,
                                 wintypes.WPARAM, wintypes.LPARAM)
    set_long = getattr(user32, "SetWindowLongPtrW", None) or user32.SetWindowLongW
    set_long.restype = ctypes.c_void_p
    set_long.argtypes = [wintypes.HWND, ctypes.c_int, WNDPROC]
    call = user32.CallWindowProcW
    call.restype = ctypes.c_ssize_t
    call.argtypes = [ctypes.c_void_p, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    shell32.DragQueryFileW.argtypes = [ctypes.c_void_p, wintypes.UINT, wintypes.LPWSTR, wintypes.UINT]
    shell32.DragQueryFileW.restype = wintypes.UINT
    shell32.DragFinish.argtypes = [ctypes.c_void_p]
    shell32.DragAcceptFiles.argtypes = [wintypes.HWND, wintypes.BOOL]
    user32.GetParent.argtypes = [wintypes.HWND]
    user32.GetParent.restype = wintypes.HWND
    user32.ChangeWindowMessageFilterEx.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.DWORD,
                                                   ctypes.c_void_p]
    keep = _REFS_ARRASTAR  # permanente: o Windows chama estes callbacks ate o fim do programa

    def hook(hwnd):
        old = {}

        def proc(h, msg, wp, lp):
            if msg == WM_DROPFILES:
                try:
                    n = shell32.DragQueryFileW(wp, 0xFFFFFFFF, None, 0)
                    paths = []
                    for i in range(n):
                        buf = ctypes.create_unicode_buffer(32768)
                        shell32.DragQueryFileW(wp, i, buf, 32768)
                        paths.append(buf.value)
                    shell32.DragFinish(wp)
                    on_files(paths)
                except Exception:  # noqa: BLE001  (nunca derrubar a janela)
                    pass
                return 0
            try:
                return call(old["p"], h, msg, wp, lp)
            except Exception:  # noqa: BLE001
                return 0

        cb = WNDPROC(proc)
        keep.append((cb, old))
        try:  # permite soltar mesmo se o app estiver como administrador
            for m in (WM_DROPFILES, 0x0049, 0x004A):
                user32.ChangeWindowMessageFilterEx(hwnd, m, 1, None)
        except Exception:  # noqa: BLE001
            pass
        shell32.DragAcceptFiles(hwnd, True)
        old["p"] = set_long(hwnd, GWL_WNDPROC, cb)

    for w in widgets:
        w.update_idletasks()
        hwnd = w.winfo_id()
        hook(hwnd)
        if w is widgets[0]:  # janela principal: tambem a janela de nivel superior
            top = user32.GetParent(hwnd)
            if top:
                hook(top)


def registrar_erro(exc_info=None):
    """Grava o erro em triturador_erro.log (ao lado do programa) e avisa na tela."""
    import traceback
    txt = "".join(traceback.format_exception(*(exc_info or sys.exc_info())))
    for pasta in (os.path.dirname(os.path.abspath(sys.argv[0] or __file__)),
                  os.environ.get("TEMP", ".")):
        try:
            with open(os.path.join(pasta, "triturador_erro.log"), "a", encoding="utf-8") as f:
                f.write(txt + "\n")
            break
        except OSError:
            continue
    try:
        from tkinter import messagebox
        messagebox.showerror("Triturador - erro", txt[-900:])
    except Exception:  # noqa: BLE001
        pass


def run_gui():
    import threading
    import time
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title(TITULO)
    root.minsize(620, 460)
    w0, h0 = 760, 560
    root.geometry("%dx%d+%d+%d" % (w0, h0, max(0, (root.winfo_screenwidth() - w0) // 2),
                                   max(0, (root.winfo_screenheight() - h0) // 3)))
    root.attributes("-topmost", True)  # fica sempre por cima: nao some atras do Explorador
    root.report_callback_exception = lambda *e: registrar_erro(e)
    root.configure(bg="#f3f4f7")
    try:
        base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
        root.iconbitmap(os.path.join(base, "icone.ico"))
    except Exception:  # noqa: BLE001  (icone e opcional)
        pass

    items = []

    # Cabecalho: so o nome do aplicativo
    head = tk.Frame(root, bg=NAVY)
    head.pack(fill="x")
    tk.Label(head, text=TITULO, bg=NAVY, fg=GOLD,
             font=("Segoe UI", 18, "bold")).pack(pady=16)

    drop = tk.Label(root, bg="#fff7f7", fg=RED, bd=2, relief="groove", height=3,
                    font=("Segoe UI", 13, "bold"), text="ARRASTE E SOLTE AQUI")
    drop.pack(fill="x", padx=12, pady=(12, 6))

    bar_btn = ttk.Frame(root, padding=(12, 0))
    bar_btn.pack(fill="x")

    # Botao e painel de fogo ficam no rodape (empacotados antes da lista p/ nao sumirem)
    go = tk.Button(root, text="TRITURAR AGORA OS ARQUIVOS", bg=RED, fg="white", bd=0,
                   font=("Segoe UI", 13, "bold"), activebackground="#9c2020",
                   activeforeground="white", cursor="hand2", pady=10)
    go.pack(side="bottom", fill="x", padx=12, pady=12)
    fogo = tk.Canvas(root, height=140, bg="#10151f", highlightthickness=0)
    sim = Fire(740, 140)
    est = {"burning": False, "msg": "", "ativo": False}
    fila = []  # caminhos recebidos do arrastar (lidos pela janela no tick)

    frame = ttk.Frame(root, padding=(12, 6))
    frame.pack(fill="both", expand=True)
    lb = tk.Listbox(frame, selectmode="extended", activestyle="none", bd=1)
    sb = ttk.Scrollbar(frame, orient="vertical", command=lb.yview)
    lb.config(yscrollcommand=sb.set)
    sb.pack(side="right", fill="y")
    lb.pack(side="left", fill="both", expand=True)

    def tick():
        if fila:
            novos = list(fila)
            del fila[:len(novos)]
            add(novos)
        r = est.get("result")
        if r and time.time() >= r[2]:
            est["result"] = None
            done(r[0], r[1])
        if est["ativo"]:
            w, h = max(fogo.winfo_width(), 100), max(fogo.winfo_height(), 60)
            sim.resize(w, h)
            sim.step(est["burning"])
            fogo.delete("all")
            for sh in sim.shapes():
                if sh[0] == "poly":
                    fogo.create_polygon(sh[1], fill=sh[2], outline="", smooth=True)
                else:
                    _, x, y, r, c = sh
                    fogo.create_oval(x - r, y - r, x + r, y + r, fill=c, outline="")
            if est["msg"]:
                for dx, dy, cor in ((2, 2, "black"), (0, 0, "white")):
                    fogo.create_text(w / 2 + dx, 22 + dy, text=est["msg"], fill=cor,
                                     font=("Segoe UI", 11, "bold"), width=w - 40)
            if not est["burning"] and sim.intensity <= 0 and not sim.sparks:
                est["ativo"] = False
                fogo.pack_forget()
        root.after(40, tick)

    def add(paths):
        for p in paths:
            p = os.path.abspath(p)
            if p not in items and os.path.exists(p):
                items.append(p)
                lb.insert("end", p)

    def add_files():
        add(filedialog.askopenfilenames(title="Escolha os arquivos"))

    def add_folder():
        d = filedialog.askdirectory(title="Escolha a pasta")
        if d:
            add([d])

    def clear_all():
        lb.delete(0, "end")
        items.clear()

    ttk.Button(bar_btn, text="Adicionar arquivos", command=add_files).pack(side="left")
    ttk.Button(bar_btn, text="Adicionar pasta", command=add_folder).pack(side="left", padx=4)
    ttk.Button(bar_btn, text="Limpar", command=clear_all).pack(side="left")

    if os.name == "nt":
        def ligar_arrastar():
            # So depois da janela existir de fato; antes disso o Windows recria a janela
            # externa e o gancho ficaria apontando para uma janela destruida (travamento).
            try:
                # Dentro do callback do Windows NAO se pode chamar o tkinter: so anota na fila.
                _ativar_arrastar_windows([root, drop, lb], fila.extend)
            except Exception:  # noqa: BLE001  (sem arrastar, os botoes continuam funcionando)
                registrar_erro()
        root.update()
        root.after(300, ligar_arrastar)

    def work(targets):
        # Roda em segundo plano: NAO mexe na janela; so guarda o resultado (a janela le no tick).
        errs, count = [], [0]
        t0 = time.time()

        def prog(p):
            count[0] += 1
            est["msg"] = os.path.basename(p)

        try:
            for t in targets:
                shred_path(t, 3, prog, errs)
        except Exception as e:  # noqa: BLE001
            errs.append(("(geral)", str(e)))
        est["result"] = (errs, count[0], t0 + 3.0)  # fogo fica aceso no minimo 3 s

    def done(errs, count):
        est["burning"] = False
        est["msg"] = ""
        go.config(state="normal")
        clear_all()
        drop.config(text="CONCLUIDO - %d ARQUIVO(S) APAGADO(S)" % count)
        if errs:
            messagebox.showwarning("Erros", "\n".join("%s: %s" % e for e in errs[:20]))

    def start():
        if not items:
            messagebox.showinfo(TITULO, "Arraste arquivos ou pastas para a janela primeiro.")
            return
        if not messagebox.askyesno(
                "Confirmar",
                "%d item(ns) serao apagados PERMANENTEMENTE.\nNao ha como desfazer.\n\nTriturar agora?"
                % len(items), icon="warning"):
            return
        go.config(state="disabled")
        drop.config(text="ARRASTE E SOLTE AQUI")
        fogo.pack(side="bottom", fill="x", padx=12, before=frame)
        est.update(burning=True, ativo=True, msg="")
        threading.Thread(target=work, args=(list(items),), daemon=True).start()

    go.config(command=start)
    tick()
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
        try:
            run_gui()
        except Exception:  # noqa: BLE001
            registrar_erro()
            return 1
        return 0
    return run_cli(a)


if __name__ == "__main__":
    sys.exit(main())

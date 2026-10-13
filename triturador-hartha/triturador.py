#!/usr/bin/env python3
"""Triturador Hartha - exclusao permanente de arquivos (portatil, sem dependencias).

Cada arquivo e sobrescrito varias vezes (padroes + dados aleatorios), truncado,
renomeado e so entao removido. Nao passa pela lixeira.

Uso (GUI):  python triturador.py
Uso (CLI):  python triturador.py [--passes N] [--yes] CAMINHO [CAMINHO ...]
"""
import argparse
import os
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
def run_gui():
    import threading
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title("Triturador Hartha - exclusao permanente")
    root.geometry("720x480")
    items = []

    top = ttk.Frame(root, padding=8)
    top.pack(fill="x")
    lb = tk.Listbox(root, selectmode="extended")
    lb.pack(fill="both", expand=True, padx=8)
    status = tk.StringVar(value="Adicione arquivos ou pastas.")
    passes = tk.IntVar(value=3)

    def add(paths):
        for p in paths:
            if p and p not in items:
                items.append(p)
                lb.insert("end", p)

    def add_files():
        add(filedialog.askopenfilenames(title="Escolha os arquivos"))

    def add_folder():
        add([filedialog.askdirectory(title="Escolha a pasta")])

    def remove_sel():
        for i in reversed(lb.curselection()):
            lb.delete(i)
            del items[i]

    ttk.Button(top, text="Adicionar arquivos", command=add_files).pack(side="left")
    ttk.Button(top, text="Adicionar pasta", command=add_folder).pack(side="left", padx=4)
    ttk.Button(top, text="Remover da lista", command=remove_sel).pack(side="left")
    ttk.Label(top, text="Passadas:").pack(side="left", padx=(16, 2))
    ttk.Spinbox(top, from_=1, to=35, width=4, textvariable=passes).pack(side="left")

    bar = ttk.Progressbar(root, mode="indeterminate")
    bar.pack(fill="x", padx=8, pady=4)
    ttk.Label(root, textvariable=status).pack(fill="x", padx=8)
    go = ttk.Button(root, text="APAGAR PERMANENTEMENTE")
    go.pack(pady=8)

    def work(targets, n):
        errs, count = [], [0]

        def prog(p):
            count[0] += 1
            root.after(0, status.set, "Triturado: %s" % p)

        for t in targets:
            shred_path(t, n, prog, errs)
        root.after(0, done, errs, count[0])

    def done(errs, count):
        bar.stop()
        go.config(state="normal")
        lb.delete(0, "end")
        items.clear()
        status.set("Concluido: %d arquivo(s) triturado(s), %d erro(s)." % (count, len(errs)))
        if errs:
            messagebox.showwarning("Erros", "\n".join("%s: %s" % e for e in errs[:20]))

    def start():
        if not items:
            return
        if not messagebox.askyesno(
                "Confirmar",
                "%d item(ns) serao apagados PERMANENTEMENTE.\nNao ha como desfazer.\n\nContinuar?"
                % len(items), icon="warning"):
            return
        go.config(state="disabled")
        bar.start(12)
        threading.Thread(target=work, args=(list(items), max(1, passes.get())),
                         daemon=True).start()

    go.config(command=start)
    root.mainloop()


def main():
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

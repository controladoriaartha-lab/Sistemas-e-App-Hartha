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
# Paleta: azul-marinho profundo + dourado (cores da marca) + vermelho so no botao de perigo
BG, PANEL = "#08111f", "#0d1b33"
NAVY, NAVY2 = "#12284a", "#1d3d6b"
GOLD, GOLD_LIGHT, GOLD_DARK = "#d4af37", "#f4dd8c", "#8a6d1c"
TEXT, MUTED = "#e9eef8", "#8ea3c4"
CRIMSON, CRIMSON_DARK = "#d1313f", "#7d1220"
MOLDURA = 20  # espessura da moldura 3D (px)
INSET = MOLDURA + 4

try:
    import tkinter as tk
except ImportError:  # modo linha de comando em maquina sem tkinter
    tk = None


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _hex(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in c)


def _mix(a, b, t):
    a, b = (_rgb(a) if isinstance(a, str) else a), (_rgb(b) if isinstance(b, str) else b)
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def _pts_arredondados(x0, y0, x1, y1, r):
    """Pontos para create_polygon(smooth=True) formando um retangulo de cantos redondos."""
    return [x0 + r, y0, x0 + r, y0, x1 - r, y0, x1 - r, y0, x1, y0, x1, y0 + r, x1, y0 + r,
            x1, y1 - r, x1, y1 - r, x1, y1, x1 - r, y1, x1 - r, y1, x0 + r, y1, x0 + r, y1,
            x0, y1, x0, y1 - r, x0, y1 - r, x0, y0 + r, x0, y0 + r, x0, y0]


def _gradiente_arredondado(c, x0, y0, x1, y1, r, cima, baixo):
    """Preenche um retangulo arredondado com degrade vertical (linha a linha)."""
    h = max(1, int(y1 - y0))
    for k in range(h + 1):
        y = y0 + k
        d = min(k, h - k)
        dx = r - math.sqrt(max(0.0, r * r - (r - d) ** 2)) if d < r else 0
        c.create_line(x0 + dx, y, x1 - dx, y, fill=_hex(_mix(cima, baixo, k / h)))


def desenhar_moldura(c, w, h, F=MOLDURA, seed=11):
    """Moldura em relevo 3D: metal dourado escovado, chanfro convexo, parafusos e encaixe."""
    c.delete("all")
    rng = random.Random(seed)
    base = (206, 168, 52)
    ajuste = {"t": 0.17, "l": 0.07, "r": -0.15, "b": -0.27}

    def cor(lado, i, extra=0.0):
        t = i / float(F - 1)
        prof = math.sin(math.pi * min(1.0, t * 0.96 + 0.02)) ** 0.9
        lum = (prof - 0.55) * 0.95 + ajuste[lado] + extra
        return _hex(_mix(base, (255, 246, 205) if lum > 0 else (28, 18, 3), min(1.0, abs(lum))))

    for i in range(F):  # aneis concentricos = perfil do chanfro
        polys = {"t": [i, i, w - i, i, w - i - 1, i + 1, i + 1, i + 1],
                 "b": [i, h - i, w - i, h - i, w - i - 1, h - i - 1, i + 1, h - i - 1],
                 "l": [i, i, i, h - i, i + 1, h - i - 1, i + 1, i + 1],
                 "r": [w - i, i, w - i, h - i, w - i - 1, h - i - 1, w - i - 1, i + 1]}
        for lado, pts in polys.items():
            c.create_polygon(pts, fill=cor(lado, i), outline=cor(lado, i))

    for _ in range(int((w + h) * 1.4)):  # textura de metal escovado
        lado = rng.choice("tblr")
        i = rng.randint(1, F - 2)
        extra = rng.choice((-0.09, -0.05, 0.05, 0.1))
        col = cor(lado, i, extra)
        n = rng.randint(14, 80)
        if lado in "tb":
            x = rng.randint(F, max(F + 1, w - F - n))
            y = i if lado == "t" else h - i
            c.create_line(x, y, x + n, y, fill=col)
        else:
            y = rng.randint(F, max(F + 1, h - F - n))
            x = i if lado == "l" else w - i
            c.create_line(x, y, x, y + n, fill=col)

    # encaixe (borda interna): sombra no alto/esquerda, luz embaixo/direita
    a, b = F, F + 1
    for off, sup, inf in ((a, "#050b16", "#3a5c8c"), (b, "#0a1730", "#274a7a")):
        c.create_line(off, off, w - off, off, fill=sup)
        c.create_line(off, off, off, h - off, fill=sup)
        c.create_line(off, h - off, w - off, h - off, fill=inf)
        c.create_line(w - off, off, w - off, h - off, fill=inf)

    m = F // 2  # parafusos
    for x, y in ((m, m), (w - m, m), (m, h - m), (w - m, h - m), (w // 2, m), (w // 2, h - m),
                 (m, h // 2), (w - m, h // 2)):
        r = 4
        c.create_oval(x - r - 1, y - r, x + r + 1, y + r + 2, fill="#3b2c06", outline="")
        c.create_oval(x - r, y - r, x + r, y + r, fill="#b8922c", outline="#6e5412")
        c.create_oval(x - r + 1, y - r + 1, x, y, fill="#f3dc8a", outline="")
        c.create_line(x - 2, y + 2, x + 2, y - 2, fill="#4a3808", width=1)


if tk is not None:
    class Botao(tk.Canvas):
        """Botao moderno: degrade, cantos redondos, borda dourada, hover e clique."""

        def __init__(self, master, text, command=None, width=150, height=34,
                     cima=NAVY2, baixo=NAVY, borda=GOLD, cor_texto=GOLD_LIGHT,
                     fonte=("Segoe UI", 10, "bold"), **kw):
            super().__init__(master, width=width, height=height, bg=PANEL,
                             highlightthickness=0, cursor="hand2", **kw)
            self.texto, self.command, self.estado = text, command, "normal"
            self.paleta = (cima, baixo, borda, cor_texto)
            self.fonte, self.sobre, self.preso = fonte, False, False
            self.bind("<Configure>", lambda e: self._desenhar())
            self.bind("<Enter>", lambda e: self._set(sobre=True))
            self.bind("<Leave>", lambda e: self._set(sobre=False, preso=False))
            self.bind("<ButtonPress-1>", lambda e: self._set(preso=True))
            self.bind("<ButtonRelease-1>", self._soltou)

        def _set(self, **kw):
            self.__dict__.update(kw)
            self._desenhar()

        def _soltou(self, e):
            tinha = self.preso
            self._set(preso=False)
            if tinha and self.estado == "normal" and 0 <= e.x <= self.winfo_width() \
                    and 0 <= e.y <= self.winfo_height():
                self.invoke()

        def invoke(self):
            if self.estado == "normal" and self.command:
                self.command()

        def config(self, **kw):
            for k in ("text", "command", "state"):
                if k in kw:
                    v = kw.pop(k)
                    setattr(self, {"text": "texto", "command": "command", "state": "estado"}[k], v)
            if kw:
                super().configure(**kw)
            self._desenhar()

        configure = config

        def _desenhar(self):
            self.delete("all")
            w, h = max(self.winfo_width(), 20), max(self.winfo_height(), 20)
            cima, baixo, borda, ct = self.paleta
            if self.estado != "normal":
                cima, baixo, borda, ct = "#2a3446", "#1c2432", "#4a5568", "#6b7a92"
            elif self.preso:
                cima, baixo = baixo, _hex(_mix(baixo, "#000000", .25))
            elif self.sobre:
                cima, baixo = _hex(_mix(cima, "#ffffff", .16)), _hex(_mix(baixo, "#ffffff", .10))
                borda = GOLD_LIGHT
            self.create_polygon(_pts_arredondados(2, 4, w - 2, h - 1, 9), smooth=True,
                                fill="#02060d", outline="")  # sombra
            _gradiente_arredondado(self, 2, 2, w - 2, h - 4, 9, cima, baixo)
            self.create_polygon(_pts_arredondados(2, 2, w - 2, h - 4, 9), smooth=True,
                                fill="", outline=borda, width=2)
            dy = 1 if self.preso else 0
            self.create_text(w / 2 + 1, (h - 2) / 2 + 1 + dy, text=self.texto, fill="#000000",
                             font=self.fonte)
            self.create_text(w / 2, (h - 2) / 2 + dy, text=self.texto, fill=ct, font=self.fonte)

    class Zona(tk.Canvas):
        """Area de soltar: moldura tracejada dourada, setas e texto."""

        def __init__(self, master, text, **kw):
            super().__init__(master, bg=PANEL, highlightthickness=0, **kw)
            self.texto = text
            self.bind("<Configure>", lambda e: self._desenhar())

        def set_text(self, text):
            self.texto = text
            self._desenhar()

        def _desenhar(self):
            self.delete("all")
            w, h = max(self.winfo_width(), 40), max(self.winfo_height(), 40)
            _gradiente_arredondado(self, 3, 3, w - 3, h - 3, 12, "#10264a", "#0b1a33")
            x0, y0, x1, y1, r = 3, 3, w - 3, h - 3, 12  # borda tracejada: retas + cantos em arco
            for ln in ((x0 + r, y0, x1 - r, y0), (x1, y0 + r, x1, y1 - r),
                       (x0 + r, y1, x1 - r, y1), (x0, y0 + r, x0, y1 - r)):
                self.create_line(*ln, fill=GOLD, width=2, dash=(7, 5))
            for box, ini in (((x0, y0, x0 + 2 * r, y0 + 2 * r), 90), ((x1 - 2 * r, y0, x1, y0 + 2 * r), 0),
                             ((x1 - 2 * r, y1 - 2 * r, x1, y1), 270), ((x0, y1 - 2 * r, x0 + 2 * r, y1), 180)):
                self.create_arc(*box, start=ini, extent=90, style="arc", outline=GOLD, width=2)
            self.create_text(w / 2 + 1, h / 2 + 1, text=self.texto, fill="#000000",
                             font=("Segoe UI", 15, "bold"))
            self.create_text(w / 2, h / 2, text=self.texto, fill=GOLD_LIGHT,
                             font=("Segoe UI", 15, "bold"))
            for cx in (40, w - 40):  # setas para baixo
                self.create_polygon(cx - 11, h / 2 - 8, cx + 11, h / 2 - 8, cx, h / 2 + 10,
                                    fill=GOLD, outline=GOLD_DARK)

    class Cabecalho(tk.Canvas):
        """Faixa do titulo: degrade azul, texto dourado em relevo e filete dourado."""

        def __init__(self, master, text, **kw):
            super().__init__(master, bg=NAVY, highlightthickness=0, **kw)
            self.texto = text
            self.bind("<Configure>", lambda e: self._desenhar())

        def _desenhar(self):
            self.delete("all")
            w, h = max(self.winfo_width(), 40), max(self.winfo_height(), 20)
            for y in range(h):
                self.create_line(0, y, w, y, fill=_hex(_mix("#1f4373", "#0c1e3a", y / h)))
            for dx, dy, col in ((2, 3, "#02060d"), (1, 1, GOLD_DARK), (0, 0, GOLD_LIGHT)):
                self.create_text(w / 2 + dx, h / 2 - 1 + dy, text=self.texto, fill=col,
                                 font=("Segoe UI", 19, "bold"))
            self.create_line(0, h - 2, w, h - 2, fill=GOLD)
            self.create_line(0, h - 1, w, h - 1, fill=GOLD_DARK)



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


def _estilizar_janela_windows(root):
    """Barra de titulo escura com texto dourado (Windows 11); em outras versoes e ignorado."""
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    user32.GetParent.argtypes = [wintypes.HWND]
    user32.GetParent.restype = wintypes.HWND
    dwm = ctypes.windll.dwmapi
    dwm.DwmSetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p,
                                          wintypes.DWORD]
    hwnd = user32.GetParent(root.winfo_id()) or root.winfo_id()

    def attr(n, v):
        val = ctypes.c_int(v)
        dwm.DwmSetWindowAttribute(hwnd, n, ctypes.byref(val), 4)

    def bgr(h):
        r, g, b = _rgb(h)
        return (b << 16) | (g << 8) | r

    attr(20, 1)               # tema escuro
    attr(35, bgr("#0c1e3a"))  # cor da barra
    attr(36, bgr(GOLD_LIGHT))  # cor do titulo
    attr(34, bgr(GOLD))       # cor da borda


def _forcar_topo_windows(root):
    """Mantem a janela acima de TODAS as outras (inclusive Explorador e janelas reduzidas)."""
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
    user32.GetAncestor.restype = wintypes.HWND
    user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                                    ctypes.c_int, ctypes.c_int, wintypes.UINT]
    hwnd = user32.GetAncestor(root.winfo_id(), 2)  # GA_ROOT
    if hwnd:
        # HWND_TOPMOST=-1; NOMOVE|NOSIZE|NOACTIVATE: so sobe na ordem, sem roubar o foco
        user32.SetWindowPos(hwnd, wintypes.HWND(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010)


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
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title(TITULO)
    root.minsize(640, 500)
    w0, h0 = 800, 620
    root.geometry("%dx%d+%d+%d" % (w0, h0, max(0, (root.winfo_screenwidth() - w0) // 2),
                                   max(0, (root.winfo_screenheight() - h0) // 3)))
    root.attributes("-topmost", True)  # fica sempre por cima: nao some atras do Explorador
    root.report_callback_exception = lambda *e: registrar_erro(e)
    root.configure(bg=BG)
    try:
        base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
        root.iconbitmap(os.path.join(base, "icone.ico"))
    except Exception:  # noqa: BLE001  (icone e opcional)
        pass

    estilo = ttk.Style(root)
    try:
        estilo.theme_use("clam")
        estilo.configure("Vertical.TScrollbar", background=NAVY2, troughcolor=PANEL,
                         bordercolor=PANEL, arrowcolor=GOLD, lightcolor=NAVY2, darkcolor=NAVY)
        estilo.map("Vertical.TScrollbar", background=[("active", GOLD_DARK)])
    except tk.TclError:
        pass

    # Moldura 3D (atras) + miolo (conteudo) por cima
    moldura = tk.Canvas(root, highlightthickness=0, bg=BG)
    moldura.place(x=0, y=0, relwidth=1, relheight=1)
    miolo = tk.Frame(root, bg=PANEL)
    miolo.place(x=INSET, y=INSET, relwidth=1, relheight=1, width=-2 * INSET, height=-2 * INSET)
    pendente = {"id": None}

    def redesenhar(_e=None):
        if pendente["id"]:
            root.after_cancel(pendente["id"])
        pendente["id"] = root.after(60, lambda: desenhar_moldura(
            moldura, max(moldura.winfo_width(), 100), max(moldura.winfo_height(), 100)))

    moldura.bind("<Configure>", redesenhar)

    items = []

    head = Cabecalho(miolo, TITULO, height=66)
    head.pack(fill="x")

    drop = Zona(miolo, "ARRASTE E SOLTE AQUI", height=84)
    drop.pack(fill="x", padx=14, pady=(14, 8))

    bar_btn = tk.Frame(miolo, bg=PANEL)
    bar_btn.pack(fill="x", padx=14)

    # Botao e painel de fogo ficam no rodape (empacotados antes da lista p/ nao sumirem)
    go = Botao(miolo, "TRITURAR AGORA OS ARQUIVOS", width=300, height=54, cima=CRIMSON,
               baixo=CRIMSON_DARK, borda=GOLD, cor_texto="#ffffff",
               fonte=("Segoe UI", 14, "bold"))
    go.pack(side="bottom", fill="x", padx=14, pady=(8, 14))
    fogo = tk.Canvas(miolo, height=140, bg="#0a0f18", highlightthickness=0)
    sim = Fire(740, 140)
    est = {"burning": False, "msg": "", "ativo": False, "n": 0}
    fila = []  # caminhos recebidos do arrastar (lidos pela janela no tick)

    frame = tk.Frame(miolo, bg=PANEL)
    frame.pack(fill="both", expand=True, padx=14, pady=(8, 0))
    lb = tk.Listbox(frame, selectmode="extended", activestyle="none", bd=0,
                    bg=PANEL, fg=TEXT, selectbackground=GOLD_DARK, selectforeground="#ffffff",
                    highlightthickness=1, highlightbackground=GOLD_DARK, highlightcolor=GOLD,
                    font=("Segoe UI", 10))
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
        est["n"] += 1
        if os.name == "nt" and est["n"] % 25 == 0:  # ~1x por segundo: reafirma "sempre no topo"
            try:
                _forcar_topo_windows(root)
            except Exception:  # noqa: BLE001
                pass
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

    Botao(bar_btn, "ADICIONAR ARQUIVOS", add_files, width=190).pack(side="left")
    Botao(bar_btn, "ADICIONAR PASTA", add_folder, width=160).pack(side="left", padx=8)
    Botao(bar_btn, "LIMPAR", clear_all, width=100).pack(side="left")

    def todos(w):
        yield w
        for c in w.winfo_children():
            yield from todos(c)

    if os.name == "nt":
        def ligar_arrastar():
            # So depois da janela existir de fato; antes disso o Windows recria a janela
            # externa e o gancho ficaria apontando para uma janela destruida (travamento).
            try:
                # Dentro do callback do Windows NAO se pode chamar o tkinter: so anota na fila.
                # Liga em TODOS os componentes: soltar funciona em qualquer ponto da janela.
                _ativar_arrastar_windows(list(todos(root)), fila.extend)
            except Exception:  # noqa: BLE001  (sem arrastar, os botoes continuam funcionando)
                registrar_erro()
            try:
                _estilizar_janela_windows(root)
                _forcar_topo_windows(root)
            except Exception:  # noqa: BLE001  (so aparencia; nunca derruba o programa)
                pass
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
        drop.set_text("CONCLUIDO - %d ARQUIVO(S) APAGADO(S)" % count)
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
        drop.set_text("ARRASTE E SOLTE AQUI")
        fogo.pack(side="bottom", fill="x", padx=14, before=frame)
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

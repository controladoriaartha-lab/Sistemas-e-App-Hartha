#!/usr/bin/env python3
"""Triturador Hartha - exclusao permanente de arquivos (portatil, sem dependencias).

Cada arquivo e sobrescrito varias vezes (padroes + dados aleatorios), truncado,
renomeado e so entao removido. Nao passa pela lixeira.

Uso (GUI):  python triturador.py
Uso (CLI):  python triturador.py [--passes N] [--yes] CAMINHO [CAMINHO ...]
"""
import argparse
import json
import math
import os
import random
import re
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


def _overwrite(f, size, passes, bytes_cb=None):
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
            if bytes_cb:
                bytes_cb(k)
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


def shred_file(path, passes=3, progress=None, bytes_cb=None):
    if os.path.islink(path):  # nunca segue link: remove so o atalho
        os.remove(path)
        if bytes_cb:
            bytes_cb(1)
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
            _overwrite(f, size, passes, bytes_cb)
            f.truncate(0)
            f.flush()
            os.fsync(f.fileno())
    _unlink_anonymous(path)
    if bytes_cb:
        bytes_cb(1)  # a remocao conta como 1 unidade (arquivos vazios tambem andam)
    if progress:
        progress(path)


def shred_path(path, passes=3, progress=None, errors=None, bytes_cb=None):
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
                    shred_file(fp, passes, progress, bytes_cb)
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
            shred_file(path, passes, progress, bytes_cb)
        except Exception as e:  # noqa: BLE001
            errors.append((path, str(e)))
    return errors


# ----------------------------------------------------------------------------- CLI
def unidades_trabalho(paths, passes=3):
    """Total de 'unidades' que a trituracao vai executar (bytes x passadas + 1 por arquivo)."""
    total = 0
    for p in paths:
        p = os.path.abspath(p)
        if os.path.isdir(p) and not os.path.islink(p):
            for raiz, _dirs, arqs in os.walk(p):
                for nome in arqs:
                    total += _unidades_arquivo(os.path.join(raiz, nome), passes)
        elif os.path.exists(p) or os.path.islink(p):
            total += _unidades_arquivo(p, passes)
    return max(1, total)


def _unidades_arquivo(fp, passes):
    try:
        if os.path.islink(fp) or not os.path.isfile(fp):
            return 1
        return os.path.getsize(fp) * passes + 1
    except OSError:
        return 1


# ----------------------------------------------------------------------------- memoria da janela
def arquivo_estado():
    """Onde guardar posicao/modo da janela: ao lado do programa (portatil) ou em %APPDATA%."""
    env = os.environ.get("TRITURADOR_ESTADO")
    if env:
        return env
    nome = "TrituradorHartha.estado.json"
    exe = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
    pasta = os.path.dirname(os.path.abspath(exe))
    if os.access(pasta, os.W_OK):
        return os.path.join(pasta, nome)
    base = os.environ.get("APPDATA") or os.path.join(os.path.expanduser("~"), ".config")
    pasta = os.path.join(base, "TrituradorHartha")
    try:
        os.makedirs(pasta, exist_ok=True)
    except OSError:
        pass
    return os.path.join(pasta, nome)


def ler_estado():
    try:
        with open(arquivo_estado(), "r", encoding="utf-8") as f:
            d = json.load(f)
        ok = {}
        if isinstance(d.get("mini"), bool):
            ok["mini"] = d["mini"]
        for k in ("x", "y", "w", "h"):
            if isinstance(d.get(k), int) and not isinstance(d.get(k), bool):
                ok[k] = d[k]
        return ok
    except Exception:  # noqa: BLE001  (arquivo ausente/corrompido: usa o padrao)
        return {}


def gravar_estado(d):
    destino = arquivo_estado()
    tmp = destino + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(d, f)
        os.replace(tmp, destino)  # troca atomica: nunca deixa o arquivo pela metade
    except Exception:  # noqa: BLE001  (so memoria de conforto; nunca derruba o programa)
        pass


def ajustar_posicao(x, y, w, h, area):
    """Mantem a janela visivel: area = (x0, y0, largura, altura) da tela (todos os monitores)."""
    ax, ay, aw, ah = area
    x = max(ax - w + 140, min(x, ax + aw - 140))   # sobra >=140 px visiveis na horizontal
    y = max(ay, min(y, ay + ah - 70))              # barra de titulo sempre alcancavel
    return x, y


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
class Faiscas:
    """O logo do triturador "moendo aco": treme e jorra faiscas rapidas por baixo.
    Logica pura (sem janela): shapes() devolve primitivas de desenho."""

    BG = "#0a0f18"

    def __init__(self, w, h):
        self.w, self.h, self.t = w, h, 0
        self.sparks = []   # [x, y, vx, vy, vida, vmax, divide, quicadas]
        self.intensity = 0.0
        self.carga = 1.0   # 0.35..1: a janela reduz se o computador estiver lento
        self.mini = False
        self.rng = random.Random(9)

    def resize(self, w, h):
        self.w, self.h = w, h

    def vivo(self):
        return bool(self.sparks) or self.intensity > 0.02

    def escala(self):
        return max(0.45, min(1.3, self.h / 176.0))

    def logo_box(self):
        lw = 42 if self.mini else 84
        return self.w / 2.0, 6 if self.mini else 8, lw

    def step(self, burning):
        self.t += 1
        rng, s = self.rng, self.escala()
        alvo = 1.0 if burning else 0.0
        self.intensity += (alvo - self.intensity) * (0.45 if burning else 0.30)
        if not burning and self.intensity < 0.03:
            self.intensity = 0.0
        cx, top, lw = self.logo_box()
        boca = top + lw - 3 * s              # borda de baixo do logo = saida das faiscas
        if self.intensity > 0.1:
            vigor = self.intensity * (0.75 + 0.5 * rng.random())  # oscila: moagem irregular
            for _ in range(int(round(vigor * self.carga * (8 if self.mini else 13)))):
                ang = math.pi / 2 + rng.gauss(0, 0.60)
                ang = max(0.18, min(math.pi - 0.18, ang))
                sp = rng.uniform(9.0, 20.0) * s * (1.45 if rng.random() < 0.12 else 1.0)
                vida = rng.randint(14, 30)
                self.sparks.append([cx + rng.uniform(-0.40, 0.40) * lw, boca,
                                    math.cos(ang) * sp, math.sin(ang) * sp, vida, vida,
                                    rng.random() < 0.38, 0])
        novas = []
        for q in self.sparks:
            q[0] += q[2]
            q[1] += q[3]
            q[3] += 0.55 * s                 # gravidade
            q[2] *= 0.972
            q[4] -= 1
            if q[1] > self.h - 3 and q[3] > 0 and q[7] < 2:   # quica no chao de aco
                q[1], q[3], q[2] = self.h - 3, -q[3] * 0.38, q[2] * 0.85
                q[7] += 1
            if q[6] and q[4] == int(q[5] * 0.45):             # a faisca "estoura" em estrelinhas
                for _ in range(3):
                    v = rng.randint(8, 14)
                    novas.append([q[0], q[1], q[2] * 0.4 + rng.uniform(-3, 3) * s,
                                  q[3] * 0.4 + rng.uniform(-4, 1) * s, v, v, False, 2])
            if q[4] > 0 and -30 < q[0] < self.w + 30 and q[1] < self.h + 30:
                novas.append(q)
        self.sparks = novas[-1000:]

    def shapes(self):
        out = []
        cx, top, lw = self.logo_box()
        s, i = self.escala(), self.intensity
        boca = top + lw - 3 * s
        if i > 0.05:  # clarao quente sob o logo
            for r, col in ((74, "#150d05"), (54, "#27160a"), (38, "#46250c"), (24, "#74410e"), (12, "#c0791d")):
                rr = r * s * (0.55 + 0.45 * i)
                out.append(("oval", cx - rr * 1.7, boca + 4 - rr * 0.55, cx + rr * 1.7, boca + 4 + rr * 0.55, col, ""))
        for x, y, vx, vy, vida, vmax, _d, _b in self.sparks:
            r = vida / float(vmax)
            cor = "#ffffff" if r > .8 else "#fff1b0" if r > .6 else "#ffc233" if r > .4 else "#ff7a1a" if r > .2 else "#8a3410"
            out.append(("line", [x, y, x - vx * 2.7, y - vy * 2.7], cor, 2 if r > .5 else 1, None))
            if r > .7:
                out.append(("oval", x - 1.8, y - 1.8, x + 1.8, y + 1.8, "#ffffff" if r > .85 else "#ffe27a", ""))
        tremor = 2.2 * i                      # o logo vibra enquanto mói
        out.append(("logo", cx + self.rng.uniform(-tremor, tremor), top + self.rng.uniform(-tremor, tremor) * 0.6))
        return out


TITULO = "TRITURADOR DE ARQUIVO PERMANENTE"
# Paleta: azul-marinho profundo + dourado (cores da marca) + vermelho so no botao de perigo
BG, PANEL = "#08111f", "#0d1b33"
NAVY, NAVY2 = "#12284a", "#1d3d6b"
GOLD, GOLD_LIGHT, GOLD_DARK = "#d4af37", "#f4dd8c", "#8a6d1c"
TEXT, MUTED = "#e9eef8", "#8ea3c4"
CRIMSON, CRIMSON_DARK = "#d1313f", "#7d1220"
MOLDURA = 20  # espessura da moldura 3D (px)
MOLDURA_MINI = 9

LOGO_B64 = (
    "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"
    "uCE0q9cbWotKYPvZkSFVNd/XW78t3I97kkJvTZi2v+NTfxvpO45JMusHtlrPbp41JVmwZM0hbv6L3hEiO/FiZNEipKMD9+Stx37Z"
    "8+1HrUnZ2KXpD5YG3s3LfVm32SAGAtt4McAr40ULOM3dyDgVMgcHtitnHZvoBSfH2fTJWIclSbP/eW0pvIiT78rQQbwYYDuoC6Wj"
    "o8Otuu2E96rqVS0lOVCzlLWbJL17hZXlj1vz1DqRrj7DCKua7zMt9GFiizJzitPjZqc69w2pe82Bao219NXcVt/j04e8Y/k3adQt"
    "HNSrK3Zs/bXtV900ZzqhuTRz8t4JZZnge0o1cnT1oN19uL5XxMtVoFyA9rJ6k9qQUkHInEd3b1b1jCwOC95nDz7t3jW6cKFhUccu"
    "zwTvlll3fJPAn3950sw4TeYnsZ7t4OhywbQUQ4P1XhlSNMugFit9NVczwqO+Z24rlWTx9FPuX/liLAaUw4PYO3zJC6qe/fVx07JE"
    "Z/VVdEZ/MdKXdejCgzhJu0NrOwPDU4ecteyZ7etfaBYt6qCjg9Gtlr1wmK8Ve7m2O++ca3Xh0MJE/w+TEsGA8HfAEQAAAABJRU5E"
    "rkJggg=="
)

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
    pontos = [(m, m), (w - m, m), (m, h - m), (w - m, h - m)]
    if F >= 16:
        pontos += [(w // 2, m), (w // 2, h - m), (m, h // 2), (w - m, h // 2)]
    for x, y in pontos:
        r = 4 if F >= 16 else 3
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
            for k in ("text", "command", "state", "fonte"):
                if k in kw:
                    v = kw.pop(k)
                    setattr(self, {"text": "texto", "command": "command", "state": "estado",
                                   "fonte": "fonte"}[k], v)
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
            self.texto, self.compacto = text, False
            self.bind("<Configure>", lambda e: self._desenhar())

        def set_text(self, text):
            self.texto = text
            self._desenhar()

        def set_compacto(self, v):
            self.compacto = v
            self._desenhar()

        def _desenhar(self):
            self.delete("all")
            w, h = max(self.winfo_width(), 40), max(self.winfo_height(), 40)
            r = 9 if self.compacto else 12
            _gradiente_arredondado(self, 3, 3, w - 3, h - 3, r, "#10264a", "#0b1a33")
            x0, y0, x1, y1 = 3, 3, w - 3, h - 3  # borda tracejada: retas + cantos em arco
            for ln in ((x0 + r, y0, x1 - r, y0), (x1, y0 + r, x1, y1 - r),
                       (x0 + r, y1, x1 - r, y1), (x0, y0 + r, x0, y1 - r)):
                self.create_line(*ln, fill=GOLD, width=2, dash=(7, 5))
            for box, ini in (((x0, y0, x0 + 2 * r, y0 + 2 * r), 90), ((x1 - 2 * r, y0, x1, y0 + 2 * r), 0),
                             ((x1 - 2 * r, y1 - 2 * r, x1, y1), 270), ((x0, y1 - 2 * r, x0 + 2 * r, y1), 180)):
                self.create_arc(*box, start=ini, extent=90, style="arc", outline=GOLD, width=2)
            fonte = ("Segoe UI", 11 if self.compacto else 15, "bold")
            self.create_text(w / 2 + 1, h / 2 + 1, text=self.texto, fill="#000000", font=fonte,
                             width=w - 90)
            self.create_text(w / 2, h / 2, text=self.texto, fill=GOLD_LIGHT, font=fonte, width=w - 90)
            k = 0.6 if self.compacto else 1.0
            for cx in ((24 * 1, w - 24) if self.compacto else (40, w - 40)):  # setas para baixo
                self.create_polygon(cx - 11 * k, h / 2 - 8 * k, cx + 11 * k, h / 2 - 8 * k, cx, h / 2 + 10 * k,
                                    fill=GOLD, outline=GOLD_DARK)

    class Cabecalho(tk.Canvas):
        """Faixa do titulo: logo grande + nome em relevo dourado sobre degrade azul, com sombras."""

        def __init__(self, master, text, **kw):
            super().__init__(master, bg=NAVY, highlightthickness=0, **kw)
            self.texto, self.compacto, self.pct = text, False, None
            self.logo = tk.PhotoImage(data="".join(LOGO_B64))          # 84 px
            self.logo_peq = self.logo.subsample(2)                     # 42 px
            self.bind("<Configure>", lambda e: self._desenhar())

        def set_compacto(self, v):
            self.compacto = v
            self.config(height=54 if v else 98)
            self._desenhar()

        def set_pct(self, v):
            """Percentual da trituracao (0-100) ao lado do botao de ampliar/reduzir; None = oculto."""
            if v == self.pct:
                return
            self.pct = v
            self._desenhar_pct()

        def _desenhar_pct(self):
            self.delete("pct")
            if self.pct is None:
                return
            w = max(self.winfo_width(), 40)
            x = w - 10 - 32 - 14  # a esquerda do botao (32 px) com 10 px de margem
            txt = "%d%%" % self.pct
            fonte = ("Segoe UI", 14 if self.compacto else 17, "bold")
            for dx, dy, col in ((2, 3, "#02060d"), (1, 2, "#0a1a33"), (1, 1, GOLD_DARK), (0, 0, GOLD_LIGHT)):
                self.create_text(x + dx, 26 + dy, text=txt, fill=col, font=fonte, anchor="e", tags="pct")

        def _desenhar(self):
            import tkinter.font as tkfont
            self.delete("all")
            w, h = max(self.winfo_width(), 40), max(self.winfo_height(), 20)
            for y in range(h):
                base = _mix("#1f4373", "#0c1e3a", y / float(h))
                if y < 7:                      # sombra interna no alto (faixa "afundada")
                    base = _mix(base, "#02060d", 0.55 * (1 - y / 7.0))
                elif y >= h - 14 and y < h - 2:  # sombreado suave na base
                    base = _mix(base, "#02060d", 0.38 * (y - (h - 14)) / 12.0)
                self.create_line(0, y, w, y, fill=_hex(base))
            logo = self.logo_peq if self.compacto else self.logo
            texto = "TRITURADOR" if self.compacto else self.texto
            fonte = ("Segoe UI", 13 if self.compacto else 19, "bold")
            lw = logo.width()
            tw = tkfont.Font(font=fonte).measure(texto)
            folga = 12 if self.compacto else 16
            total = lw + folga + tw
            x0 = max(8, (w - total) / 2 - (18 if self.compacto else 0))
            fundo = "#142c52"
            # sombra suave (varias camadas, de fora p/ dentro) sob o logo, deslocada p/ baixo-direita
            for k in range(11):
                e = 7.0 - k * 0.62
                cx0, cy0 = x0 + 3 - e, h / 2 - lw / 2 + 6 - e
                cx1, cy1 = x0 + lw + 3 + e, h / 2 + lw / 2 + 6 + e
                self.create_polygon(_pts_arredondados(cx0, cy0, cx1, cy1, lw * 0.26 + e * 0.9),
                                    smooth=True, fill=_hex(_mix(fundo, "#000000", 0.035 + k * 0.04)), outline="")
            self.create_image(x0, h / 2, image=logo, anchor="w")
            tx = x0 + lw + folga
            # sombra suave do titulo (camadas progressivamente mais escuras e proximas)
            for dx, dy, t in ((6, 7, 0.10), (5, 6, 0.18), (4, 5, 0.30), (3, 4, 0.48), (2, 3, 0.70)):
                self.create_text(tx + dx, h / 2 + dy, text=texto, fill=_hex(_mix(fundo, "#000000", t)),
                                 font=fonte, anchor="w")
            for dx, dy, col in ((1, 1, GOLD_DARK), (0, 0, GOLD_LIGHT)):
                self.create_text(tx + dx, h / 2 + dy, text=texto, fill=col, font=fonte, anchor="w")
            self.create_line(0, h - 2, w, h - 2, fill=GOLD)
            self.create_line(0, h - 1, w, h - 1, fill=GOLD_DARK)
            self._desenhar_pct()

    class BotaoMini(tk.Canvas):
        """Botao quadrado do canto: alterna entre janela normal e mini."""

        def __init__(self, master, command=None, size=32, **kw):
            super().__init__(master, width=size, height=size, bg=NAVY, highlightthickness=0,
                             cursor="hand2", **kw)
            self.command, self.mini, self.sobre, self.size = command, False, False, size
            self.bind("<Configure>", lambda e: self._desenhar())
            self.bind("<Enter>", lambda e: self._set(sobre=True))
            self.bind("<Leave>", lambda e: self._set(sobre=False))
            self.bind("<ButtonRelease-1>", lambda e: self.invoke())

        def _set(self, **kw):
            self.__dict__.update(kw)
            self._desenhar()

        def invoke(self):
            if self.command:
                self.command()

        def set_mini(self, v):
            self.mini = v
            self._desenhar()

        def _seta(self, tx, ty, dx, dy, cor):
            n = math.hypot(dx, dy)
            dx, dy = dx / n, dy / n
            bx, by = tx - dx * 6, ty - dy * 6
            px, py = -dy * 3.4, dx * 3.4
            self.create_polygon(tx, ty, bx + px, by + py, bx - px, by - py, fill=cor, outline=cor)

        def _desenhar(self):
            self.delete("all")
            s = self.size
            cima, baixo = ("#2c5a96", "#16335c") if self.sobre else (NAVY2, NAVY)
            _gradiente_arredondado(self, 1, 1, s - 1, s - 1, 7, cima, baixo)
            self.create_polygon(_pts_arredondados(1, 1, s - 1, s - 1, 7), smooth=True, fill="",
                                outline=GOLD_LIGHT if self.sobre else GOLD, width=2)
            c, k = s / 2.0, s * 0.30
            cor = GOLD_LIGHT
            # modo normal: setas apontam p/ dentro (encolher); modo mini: p/ fora (ampliar)
            if not self.mini:
                self.create_line(c + k, c - k, c + 2, c - 2, fill=cor, width=2)
                self.create_line(c - k, c + k, c - 2, c + 2, fill=cor, width=2)
                self._seta(c + 1, c - 1, -1, 1, cor)
                self._seta(c - 1, c + 1, 1, -1, cor)
            else:
                self.create_line(c + 2, c - 2, c + k, c - k, fill=cor, width=2)
                self.create_line(c - 2, c + 2, c - k, c + k, fill=cor, width=2)
                self._seta(c + k + 1, c - k - 1, 1, -1, cor)
                self._seta(c - k - 1, c + k + 1, -1, 1, cor)



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


def area_visivel(root):
    """(x, y, largura, altura) da area de todos os monitores."""
    if os.name == "nt":
        try:
            import ctypes
            gm = ctypes.windll.user32.GetSystemMetrics
            return gm(76), gm(77), gm(78), gm(79)
        except Exception:  # noqa: BLE001
            pass
    return 0, 0, root.winfo_screenwidth(), root.winfo_screenheight()


def definir_identidade_windows():
    """Faz a barra de tarefas tratar o programa como app proprio (e nao como 'Python')."""
    import ctypes
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Hartha.TrituradorArquivoPermanente")


def definir_icone_windows(root, ico):
    """Aplica o logo nos icones grande (barra de tarefas/Alt+Tab) e pequeno (titulo) da janela."""
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    user32.LoadImageW.restype = wintypes.HANDLE
    user32.LoadImageW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR, wintypes.UINT, ctypes.c_int,
                                  ctypes.c_int, wintypes.UINT]
    user32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.SendMessageW.restype = ctypes.c_ssize_t
    user32.GetParent.argtypes = [wintypes.HWND]
    user32.GetParent.restype = wintypes.HWND
    alvo = user32.GetParent(root.winfo_id()) or root.winfo_id()
    gm = user32.GetSystemMetrics
    for tipo, cx in ((1, gm(11)), (0, gm(49))):  # ICON_BIG (SM_CXICON), ICON_SMALL (SM_CXSMICON)
        h = user32.LoadImageW(None, ico, 1, cx, cx, 0x10)  # IMAGE_ICON, LR_LOADFROMFILE
        if h:
            user32.SendMessageW(alvo, 0x0080, tipo, h)  # WM_SETICON


# ----------------------------------------------------------------------------- Windows: console e atalhos
NOME_ATALHO = "Triturador Hartha.lnk"


def aviso_windows(titulo, texto, erro=False):
    """Caixa de mensagem nativa (funciona mesmo sem tkinter). Fora do Windows, so imprime."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, texto, titulo, 0x10 if erro else 0x40)
            return
        except Exception:  # noqa: BLE001
            pass
    try:
        print("%s: %s" % (titulo, texto))
    except Exception:  # noqa: BLE001
        pass


_PROCESSOS_PYTHON = ("py.exe", "pyw.exe", "python.exe", "pythonw.exe")


def ocultar_console_windows(api=None, nomes=None):
    """Aberto por python.exe/py.exe com duplo clique (console proprio)? Esconde a 'tela preta'.
    Se o console pertence a um terminal em uso (cmd, PowerShell...), nao mexe. `api`/`nomes` so p/ teste."""
    import ctypes
    if api is None:
        if os.name != "nt":
            return False
        api = ctypes.windll
    try:
        k, u = api.kernel32, api.user32
        hwnd = k.GetConsoleWindow()
        if not hwnd:
            return False                      # sem console (pythonw/.exe): nada a fazer
        pids = (ctypes.c_uint * 16)()
        n = k.GetConsoleProcessList(pids, 16)
        outros = [pids[i] for i in range(min(n, 16)) if pids[i] != os.getpid()]
        if outros:
            ler = nomes or (lambda pid: _nome_processo_windows(api, pid))
            if any((ler(pid) or "").lower() not in _PROCESSOS_PYTHON for pid in outros):
                return False                  # tem um terminal de verdade nesse console
        u.ShowWindow(hwnd, 0)                 # SW_HIDE: some a janela preta...
        k.FreeConsole()                       # ...e solta o console
        return True
    except Exception:  # noqa: BLE001
        return False


def _nome_processo_windows(api, pid):
    import ctypes
    h = api.kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return ""
    try:
        buf = ctypes.create_unicode_buffer(520)
        tam = ctypes.c_uint(520)
        if api.kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(tam)):
            return os.path.basename(buf.value)
    finally:
        api.kernel32.CloseHandle(h)
    return ""


class _AtalhoCOM:
    """Cria/le arquivos .lnk pela interface IShellLinkW do Windows (sem PowerShell/VBScript)."""

    CLSID = "{00021401-0000-0000-C000-000000000046}"
    IID_LINK = "{000214F9-0000-0000-C000-000000000046}"
    IID_ARQ = "{0000010B-0000-0000-C000-000000000046}"

    def __init__(self):
        import ctypes
        self.c = ctypes
        self.ole = ctypes.OleDLL("ole32")
        self.ole.CoInitialize(None)
        self.p = ctypes.c_void_p()
        self.ole.CoCreateInstance(ctypes.byref(self._guid(self.CLSID)), None, 1,
                                  ctypes.byref(self._guid(self.IID_LINK)), ctypes.byref(self.p))
        self.arq = ctypes.c_void_p()
        self._m(self.p, 0, ctypes.c_void_p, ctypes.c_void_p)(
            self.p, ctypes.byref(self._guid(self.IID_ARQ)), ctypes.byref(self.arq))

    def _guid(self, texto):
        c = self.c

        class GUID(c.Structure):
            _fields_ = [("a", c.c_ulong), ("b", c.c_ushort), ("c", c.c_ushort), ("d", c.c_ubyte * 8)]
        g = GUID()
        self.ole.CLSIDFromString(c.c_wchar_p(texto), c.byref(g))
        return g

    def _m(self, ptr, idx, *tipos):
        c = self.c
        tabela = c.cast(c.cast(ptr, c.POINTER(c.c_void_p))[0], c.POINTER(c.c_void_p))
        return c.WINFUNCTYPE(c.HRESULT, c.c_void_p, *tipos)(tabela[idx])

    def _texto(self, idx, cch=2048):
        buf = self.c.create_unicode_buffer(cch)
        self._m(self.p, idx, self.c.c_void_p, self.c.c_int)(self.p, self.c.addressof(buf), cch)
        return buf.value

    def salvar(self, caminho, alvo, args, pasta, icone, indice, descricao):
        c = self.c
        self._m(self.p, 20, c.c_wchar_p)(self.p, alvo)               # SetPath
        self._m(self.p, 11, c.c_wchar_p)(self.p, args)               # SetArguments
        self._m(self.p, 9, c.c_wchar_p)(self.p, pasta)               # SetWorkingDirectory
        self._m(self.p, 7, c.c_wchar_p)(self.p, descricao)           # SetDescription
        self._m(self.p, 17, c.c_wchar_p, c.c_int)(self.p, icone, indice)  # SetIconLocation
        self._m(self.arq, 6, c.c_wchar_p, c.c_int)(self.arq, caminho, 1)  # IPersistFile::Save

    def ler(self, caminho):
        """Reabre o .lnk do disco e devolve (alvo, argumentos, pasta, icone, indice)."""
        c = self.c
        self._m(self.arq, 5, c.c_wchar_p, c.c_uint)(self.arq, caminho, 0)  # IPersistFile::Load
        alvo = c.create_unicode_buffer(2048)
        self._m(self.p, 3, c.c_void_p, c.c_int, c.c_void_p, c.c_uint)(self.p, c.addressof(alvo), 2048, None, 0)
        ico = c.create_unicode_buffer(2048)
        idx = c.c_int()
        self._m(self.p, 16, c.c_void_p, c.c_int, c.c_void_p)(self.p, c.addressof(ico), 2048, c.byref(idx))
        return alvo.value, self._texto(10), self._texto(8), ico.value, idx.value

    def fechar(self):
        for ptr in (self.arq, self.p):
            try:
                self.c.WINFUNCTYPE(self.c.c_ulong, self.c.c_void_p)(
                    self.c.cast(self.c.cast(ptr, self.c.POINTER(self.c.c_void_p))[0],
                                self.c.POINTER(self.c.c_void_p))[2])(ptr)  # Release
            except Exception:  # noqa: BLE001
                pass


def _pasta_area_de_trabalho():
    import ctypes
    buf = ctypes.create_unicode_buffer(1024)
    # CSIDL_DESKTOPDIRECTORY: a pasta REAL da Area de Trabalho (inclusive se estiver no OneDrive)
    if ctypes.windll.shell32.SHGetFolderPathW(None, 0x10, None, 0, buf) == 0:
        return buf.value
    return os.path.join(os.path.expanduser("~"), "Desktop")


def _pythonw_atual():
    """pythonw.exe (sem console) do MESMO Python que esta rodando o programa."""
    exe = sys.executable
    pasta, nome = os.path.split(exe)
    if nome.lower() == "pythonw.exe":
        return exe
    cand = os.path.join(pasta, "pythonw.exe")
    return cand if os.path.exists(cand) else exe


def _icone_permanente(base):
    """Copia o logo para %LOCALAPPDATA%\\TrituradorHartha (nome novo => sem icone antigo em cache)."""
    import shutil
    origem = os.path.join(base, "icone.ico")
    pasta = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "TrituradorHartha")
    os.makedirs(pasta, exist_ok=True)
    destino = os.path.join(pasta, "TrituradorHartha.ico")
    shutil.copyfile(origem, destino)
    return destino


def criar_atalhos():
    """Cria 'Triturador Hartha.lnk' (com o logo) na pasta do programa e na Area de Trabalho,
    apontando direto para o pythonw.exe deste computador (nunca depende da associacao de .pyw).
    Devolve (ok, texto)."""
    if os.name != "nt":
        return False, "Atalhos .lnk so existem no Windows."
    frozen = getattr(sys, "frozen", False)
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    pasta = os.path.dirname(os.path.abspath(sys.executable if frozen else __file__))
    avisos = []
    if frozen:
        alvo, args, icone = sys.executable, "", sys.executable      # logo embutido no proprio .exe
        quem = "TrituradorHartha.exe"
    else:
        alvo = _pythonw_atual()
        script = os.path.join(pasta, "Triturador.pyw")
        if not os.path.exists(script):
            script = os.path.abspath(__file__)
        args = '"%s"' % script
        icone = _icone_permanente(base)
        quem = alvo
        if os.path.basename(alvo).lower() != "pythonw.exe":
            avisos.append("Nao achei o pythonw.exe; o programa escondera a tela preta sozinho.")
        if tk is None:
            avisos.append("ATENCAO: este Python esta sem o tkinter (Tcl/Tk). Reinstale o Python "
                          "marcando 'tcl/tk and IDLE', ou use o TrituradorHartha.exe.")
    destinos = [os.path.join(pasta, NOME_ATALHO), os.path.join(_pasta_area_de_trabalho(), NOME_ATALHO)]
    feitos = []
    for destino in destinos:
        try:
            if os.path.exists(destino):
                os.remove(destino)                                  # recria do zero (evita icone em cache)
            com = _AtalhoCOM()
            try:
                com.salvar(destino, alvo, args, pasta, icone, 0, "Triturador de Arquivo Permanente")
                com.fechar()
                com = _AtalhoCOM()
                lido = com.ler(destino)                             # confere o que foi gravado de verdade
            finally:
                com.fechar()
            logo_ok = os.path.exists(lido[3]) and os.path.normcase(lido[3]) == os.path.normcase(icone)
            if not logo_ok:
                avisos.append("Atalho sem o logo: %s (icone esperado: %s)" % (destino, icone))
            feitos.append(destino)
        except Exception as e:  # noqa: BLE001
            avisos.append("Falhou em %s: %s" % (destino, e))
    try:  # pede ao Windows para atualizar os icones na tela
        import ctypes
        import subprocess
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0, None, None)  # SHCNE_ASSOCCHANGED
        subprocess.run(["ie4uinit.exe", "-show"], timeout=15, creationflags=0x08000000,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:  # noqa: BLE001
        pass
    ok = len(feitos) > 0 and not any(a.startswith(("Falhou", "Atalho sem")) for a in avisos)
    linhas = ["Atalho com o logo criado:" if feitos else "Nao foi possivel criar o atalho."]
    linhas += ["  " + f for f in feitos]
    linhas += ["", "Abre com: " + quem]
    linhas += [""] + avisos if avisos else []
    return ok, "\n".join(linhas)


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
        aviso_windows("Triturador - erro", txt[-900:], erro=True)


def run_gui():
    import threading
    import time
    from tkinter import filedialog, messagebox, ttk

    NORMAL_W, NORMAL_H = 800, 640
    MINI_W, MINI_H = 360, 244  # ~6x menor em area que a janela normal
    ui = {"mini": False, "F": MOLDURA, "tam": (NORMAL_W, NORMAL_H)}

    if os.name == "nt":
        try:
            definir_identidade_windows()
        except Exception:  # noqa: BLE001
            pass

    root = tk.Tk()
    root.title(TITULO)
    root.minsize(640, 520)
    estado = ler_estado()                  # memoria: modo (mini/aberto) e posicao da ultima vez
    area = area_visivel(root)
    nw, nh = estado.get("w", NORMAL_W), estado.get("h", NORMAL_H)
    if not (640 <= nw <= area[2] and 520 <= nh <= area[3]):
        nw, nh = NORMAL_W, NORMAL_H
    ui["tam"] = (nw, nh)
    comeca_mini = estado.get("mini", False)
    if "x" in estado and "y" in estado:
        gx, gy = estado["x"], estado["y"]
    else:
        gx, gy = max(0, (root.winfo_screenwidth() - nw) // 2), max(0, (root.winfo_screenheight() - nh) // 3)
    gx, gy = ajustar_posicao(gx, gy, nw, nh, area)
    root.geometry("%dx%d+%d+%d" % (nw, nh, gx, gy))
    # Janela comum: outras janelas podem ficar na frente dela (lado a lado / sobrepostas).
    root.report_callback_exception = lambda *e: registrar_erro(e)
    root.configure(bg=BG)
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    ico = os.path.join(base, "icone.ico")
    try:
        root.iconbitmap(ico)
        root.iconbitmap(default=ico)  # tambem para os dialogos
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
    pendente = {"id": None}

    def redesenhar(_e=None):
        if pendente["id"]:
            root.after_cancel(pendente["id"])
        pendente["id"] = root.after(50, lambda: desenhar_moldura(
            moldura, max(moldura.winfo_width(), 100), max(moldura.winfo_height(), 100), ui["F"]))

    def posicionar_miolo():
        inset = ui["F"] + 4
        miolo.place(x=inset, y=inset, relwidth=1, relheight=1, width=-2 * inset, height=-2 * inset)

    moldura.bind("<Configure>", redesenhar)
    posicionar_miolo()

    items = []

    head = Cabecalho(miolo, TITULO, height=98)
    head.pack(fill="x")
    btn_mini = BotaoMini(head, lambda: alternar_mini())
    btn_mini.place(relx=1.0, x=-10, y=10, anchor="ne")

    zona_box = tk.Frame(miolo, bg=PANEL)
    zona_box.pack(fill="x")
    drop = Zona(zona_box, "ARRASTE E SOLTE AQUI", height=84)
    drop.pack(fill="x", padx=14, pady=(14, 8))

    bar_btn = tk.Frame(miolo, bg=PANEL)
    bar_btn.pack(fill="x", padx=14)

    # Botao e painel de animacao ficam no rodape (empacotados antes da lista p/ nao sumirem)
    go = Botao(miolo, "TRITURAR AGORA OS ARQUIVOS", width=300, height=54, cima=CRIMSON,
               baixo=CRIMSON_DARK, borda=GOLD, cor_texto="#ffffff",
               fonte=("Segoe UI", 14, "bold"))
    go.pack(side="bottom", fill="x", padx=14, pady=(8, 14))
    fogo = tk.Canvas(miolo, height=176, bg=Faiscas.BG, highlightthickness=0)
    sim = Faiscas(740, 176)
    logo_img = tk.PhotoImage(data="".join(LOGO_B64))   # 84 px
    logo_peq = logo_img.subsample(2)                    # 42 px (modo mini)
    est = {"burning": False, "msg": "", "ativo": False, "n": 0, "total": None, "feito": 0, "disp": 0.0}
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

    def refresh_drop():
        if ui["mini"]:
            n = len(items)
            drop.set_text("%d ITEM(NS) PRONTO(S)\nSOLTE MAIS OU TRITURE" % n if n else "SOLTE AQUI")

    def mostrar_painel():
        if ui["mini"]:
            drop.pack_forget()
            fogo.config(height=96)
            fogo.pack(in_=zona_box, fill="x", padx=14, pady=(8, 6))
        else:
            fogo.config(height=176)
            fogo.pack(side="bottom", fill="x", padx=14, before=frame)

    def esconder_painel():
        fogo.pack_forget()
        if ui["mini"] and not drop.winfo_ismapped():
            drop.pack(fill="x", padx=14, pady=(8, 6))

    def pos_atual():
        m = re.match(r"(\d+)x(\d+)\+(-?\d+)\+(-?\d+)", root.geometry())
        return (int(m.group(3)), int(m.group(4))) if m else (root.winfo_x(), root.winfo_y())

    def definir_mini(mini, pos=None):
        ui["mini"] = mini
        x, y = pos if pos else pos_atual()
        if mini:
            if not pos:
                ui["tam"] = (root.winfo_width(), root.winfo_height())
            ui["F"] = MOLDURA_MINI
            bar_btn.pack_forget()
            frame.pack_forget()
            drop.pack_configure(pady=(8, 6))
            drop.config(height=70)
            go.config(height=42, text="TRITURAR AGORA", fonte=("Segoe UI", 12, "bold"))
            head.set_compacto(True)
            drop.set_compacto(True)
            root.minsize(300, 220)
            posicionar_miolo()
            larg, alt = MINI_W, MINI_H
            refresh_drop()
        else:
            ui["F"] = MOLDURA
            drop.pack_configure(pady=(14, 8))
            drop.config(height=84)
            go.config(height=54, text="TRITURAR AGORA OS ARQUIVOS", fonte=("Segoe UI", 14, "bold"))
            head.set_compacto(False)
            drop.set_compacto(False)
            bar_btn.pack(fill="x", padx=14, after=zona_box)
            frame.pack(fill="both", expand=True, padx=14, pady=(8, 0), after=bar_btn)
            drop.set_text("ARRASTE E SOLTE AQUI")
            root.minsize(640, 520)
            posicionar_miolo()
            larg, alt = ui["tam"]
        x, y = ajustar_posicao(x, y, larg, alt, area_visivel(root))
        root.geometry("%dx%d+%d+%d" % (larg, alt, x, y))
        btn_mini.set_mini(mini)
        redesenhar()

    def alternar_mini():
        if est["burning"]:
            return  # nao troca de tamanho no meio da trituracao
        if est["ativo"]:  # animacao terminando: encerra e esconde antes de trocar
            est["ativo"] = False
            sim.sparks, sim.intensity = [], 0.0
            esconder_painel()
        definir_mini(not ui["mini"])
        salvar()

    # ---- memoria da janela (modo + posicao), gravada ao mover/redimensionar e ao fechar
    agenda = {"id": None}

    def salvar():
        x, y = pos_atual()
        larg, alt = ui["tam"] if ui["mini"] else (root.winfo_width(), root.winfo_height())
        gravar_estado({"mini": ui["mini"], "x": x, "y": y, "w": larg, "h": alt})

    def agendar_salvar(e=None):
        if e is not None and e.widget is not root:
            return
        if agenda["id"]:
            root.after_cancel(agenda["id"])
        agenda["id"] = root.after(600, salvar)

    def fechar():
        salvar()
        root.destroy()

    root.bind("<Configure>", agendar_salvar, add="+")
    root.protocol("WM_DELETE_WINDOW", fechar)

    def lw_msg():
        return 30 if ui["mini"] else 60

    def tick():
        agora = time.perf_counter()
        dt = (agora - est.get("t_ant", agora)) * 1000.0
        est["t_ant"] = agora
        if est["ativo"]:  # ajuste automatico: PC lento => menos faiscas, animacao continua fluida
            est["ema"] = est.get("ema", 30.0) * 0.85 + min(dt, 300.0) * 0.15
            if est["ema"] > 55:
                sim.carga = max(0.35, sim.carga - 0.06)
            elif est["ema"] < 38:
                sim.carga = min(1.0, sim.carga + 0.02)
        if est["burning"]:  # percentual real (bytes x passadas), suavizado
            tot = est.get("total")
            real = min(1.0, est["feito"] / float(tot)) if tot else 0.0
            est["disp"] += (real - est["disp"]) * 0.25
            if real >= 1.0 and est["disp"] > 0.995:
                est["disp"] = 1.0
            head.set_pct(int(est["disp"] * 100 + 0.5))
        elif est.get("pct_ate") and time.time() >= est["pct_ate"]:
            est["pct_ate"] = None
            head.set_pct(None)
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
                k = sh[0]
                if k == "line":
                    fogo.create_line(*sh[1], fill=sh[2], width=sh[3], capstyle="round")
                elif k == "oval":
                    fogo.create_oval(sh[1], sh[2], sh[3], sh[4], fill=sh[5], outline=sh[6])
                else:  # logo
                    fogo.create_image(sh[1], sh[2], image=logo_peq if ui["mini"] else logo_img, anchor="n")
            if est["msg"]:
                for dx, dy, cor in ((1, 1, "black"), (0, 0, "#f4dd8c")):
                    fogo.create_text(10 + dx, 8 + dy, text=est["msg"], fill=cor, anchor="nw",
                                     font=("Segoe UI", 10, "bold"), width=max(60, w / 2 - lw_msg()))
            if not est["burning"] and not sim.vivo():
                est["ativo"] = False
                esconder_painel()
        root.after(30, tick)

    def add(paths):
        for p in paths:
            p = os.path.abspath(p)
            if p not in items and os.path.exists(p):
                items.append(p)
                lb.insert("end", p)
        refresh_drop()

    def add_files():
        add(filedialog.askopenfilenames(title="Escolha os arquivos"))

    def add_folder():
        d = filedialog.askdirectory(title="Escolha a pasta")
        if d:
            add([d])

    def clear_all():
        lb.delete(0, "end")
        items.clear()
        refresh_drop()

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
            except Exception:  # noqa: BLE001  (so aparencia; nunca derruba o programa)
                pass
            try:
                definir_icone_windows(root, ico)  # logo na barra de tarefas / Alt+Tab
            except Exception:  # noqa: BLE001
                pass
        if comeca_mini:
            definir_mini(True, pos=(gx, gy))
        root.update()
        root.after(300, ligar_arrastar)
    elif comeca_mini:
        definir_mini(True, pos=(gx, gy))

    def work(targets):
        # Roda em segundo plano: NAO mexe na janela; so guarda o resultado (a janela le no tick).
        errs, count = [], [0]
        t0 = time.time()

        def prog(p):
            count[0] += 1
            est["msg"] = os.path.basename(p)

        def bcb(n):
            est["feito"] += n

        try:
            est["total"] = unidades_trabalho(targets, 3)
            for t in targets:
                shred_path(t, 3, prog, errs, bcb)
        except Exception as e:  # noqa: BLE001
            errs.append(("(geral)", str(e)))
        est["result"] = (errs, count[0], t0 + 4.0)  # animacao fica no minimo 4 s

    def done(errs, count):
        est["burning"] = False
        est["msg"] = ""
        head.set_pct(100)
        est["pct_ate"] = time.time() + 2.5   # mostra 100% por instantes e some
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
        if not ui["mini"]:
            drop.set_text("ARRASTE E SOLTE AQUI")
        sim.sparks, sim.intensity, sim.mini = [], 0.0, ui["mini"]
        est["ema"] = 30.0
        est.update(total=None, feito=0, disp=0.0, pct_ate=None)
        head.set_pct(0)
        mostrar_painel()
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
    ap.add_argument("--criar-atalho", nargs="?", const="", default=None, metavar="ARQUIVO_SAIDA",
                    help="cria o atalho com o logo (pasta e Area de Trabalho); opcional: grava o resultado em ARQUIVO")
    a = ap.parse_args()
    a.passes = max(1, a.passes)
    if a.criar_atalho is not None:
        ok, texto = criar_atalhos()
        if a.criar_atalho:
            with open(a.criar_atalho, "w", encoding="utf-16") as f:
                f.write(texto)
        else:
            aviso_windows("Triturador Hartha", texto, erro=not ok)
        return 0 if ok else 1
    if not a.paths:
        ocultar_console_windows()  # aberto por python.exe/duplo clique: some com a tela preta
        if tk is None:
            aviso_windows("Triturador Hartha",
                          "Este Python esta sem o componente tkinter (Tcl/Tk), necessario para a janela.\n\n"
                          "Reinstale o Python marcando \"tcl/tk and IDLE\" ou use o TrituradorHartha.exe.",
                          erro=True)
            return 1
        try:
            run_gui()
        except Exception:  # noqa: BLE001
            registrar_erro()
            return 1
        return 0
    return run_cli(a)


if __name__ == "__main__":
    sys.exit(main())

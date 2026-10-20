"""Testa a decisao de esconder a tela preta com um Windows simulado (sem janela de console no Linux/Wine)."""
import importlib.util, os, types
sp = importlib.util.spec_from_file_location("t", os.path.join(os.path.dirname(__file__), "..", "triturador.py"))
m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
meu = os.getpid()

def cenario(rotulo, tem_janela, pids, nomes, esperado):
    chamadas = []
    class K:
        def GetConsoleWindow(self): return 4242 if tem_janela else 0
        def GetConsoleProcessList(self, arr, n):
            for i, p in enumerate(pids): arr[i] = p
            return len(pids)
        def FreeConsole(self): chamadas.append("FreeConsole")
    class U:
        def ShowWindow(self, h, cmd): chamadas.append("ShowWindow")
    r = m.ocultar_console_windows(api=types.SimpleNamespace(kernel32=K(), user32=U()), nomes=lambda p: nomes.get(p, ""))
    assert r == esperado and (len(chamadas) == 2) == esperado, rotulo
    print("OK ", rotulo)

cenario("duplo clique com python.exe", True, [meu], {}, True)
cenario("via py.exe + python.exe", True, [meu, 1], {1: "py.exe"}, True)
cenario("dentro do cmd.exe", True, [meu, 2], {2: "cmd.exe"}, False)
cenario("dentro do powershell.exe", True, [meu, 3], {3: "powershell.exe"}, False)
cenario("pythonw/.exe (sem console)", False, [], {}, False)

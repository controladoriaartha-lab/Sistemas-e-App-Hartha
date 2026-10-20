' Triturador Hartha - cria o atalho COM O LOGO neste computador (pasta do programa + Area de Trabalho).
' Sem tela preta. Rode UMA VEZ em cada computador, com este arquivo na MESMA pasta do triturador.py
' (ou do TrituradorHartha.exe). Nao copie o .lnk de um computador para outro: rode isto no novo.
Option Explicit
Dim sh, fso, pasta, script, exe, py, cmd, saida, rc, texto, f

Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta  = fso.GetParentFolderName(WScript.ScriptFullName)
script = pasta & "\triturador.py"
exe    = pasta & "\TrituradorHartha.exe"
saida  = Expande("%TEMP%") & "\triturador_atalho_resultado.txt"
If fso.FileExists(saida) Then fso.DeleteFile saida, True

py = ""
If fso.FileExists(script) Then py = AcharPython()

If py <> "" Then
  cmd = """" & py & """ """ & script & """ --criar-atalho """ & saida & """"
ElseIf fso.FileExists(exe) Then
  cmd = """" & exe & """ --criar-atalho """ & saida & """"
Else
  MsgBox "Nao encontrei o Python neste computador nem o TrituradorHartha.exe nesta pasta." & vbCrLf & vbCrLf & _
         "Instale o Python 3 (python.org, marcando ""tcl/tk and IDLE"") ou copie o TrituradorHartha.exe" & vbCrLf & _
         "para esta pasta e rode este arquivo de novo." & vbCrLf & vbCrLf & "Pasta: " & pasta, 16, "Triturador Hartha"
  WScript.Quit 1
End If

rc = sh.Run(cmd, 0, True)   ' 0 = janela oculta (nunca aparece tela preta)

texto = ""
If fso.FileExists(saida) Then
  Set f = fso.OpenTextFile(saida, 1, False, -1)   ' -1 = Unicode (acentos)
  If Not f.AtEndOfStream Then texto = f.ReadAll
  f.Close
End If
If texto = "" Then texto = "O programa nao respondeu (codigo " & rc & ")." & vbCrLf & "Comando: " & cmd

If rc = 0 Then
  MsgBox texto, 64, "Triturador Hartha"
Else
  MsgBox texto, 48, "Triturador Hartha - atencao"
End If

' ----------------------------------------------------------------------------
' Expande variaveis de ambiente e remove caracteres nulos sobrando no fim (alguns ambientes devolvem)
Function Expande(t)
  Dim r
  r = sh.ExpandEnvironmentStrings(t)
  Do While Len(r) > 0
    If Right(r, 1) = Chr(0) Then r = Left(r, Len(r) - 1) Else Exit Do
  Loop
  Expande = r
End Function

Function Existe(p)
  Existe = False
  If p <> "" Then Existe = fso.FileExists(p)
End Function

Function Reg(chave)
  Dim v
  v = ""
  On Error Resume Next
  v = sh.RegRead(chave)
  If Err.Number <> 0 Then
    v = ""
    Err.Clear
  End If
  On Error GoTo 0
  Reg = v
End Function

' Python registrado no Windows (instalador oficial e Microsoft Store), versoes mais novas primeiro
Function PorRegistro(janela)
  Dim n, raizes, r, k, w, d
  PorRegistro = ""
  For n = 16 To 7 Step -1
    raizes = Array("HKCU\Software\Python\PythonCore\3." & n, _
                   "HKLM\Software\Python\PythonCore\3." & n, _
                   "HKLM\Software\WOW6432Node\Python\PythonCore\3." & n & "-32", _
                   "HKCU\Software\Python\PythonCore\3." & n & "-32")
    For Each r In raizes
      k = r & "\InstallPath\"
      If janela Then w = Reg(k & "WindowedExecutablePath") Else w = Reg(k & "ExecutablePath")
      If Existe(w) Then
        PorRegistro = w
        Exit Function
      End If
      d = Reg(k)
      If d <> "" Then
        If Right(d, 1) <> "\" Then d = d & "\"
        If janela Then w = d & "pythonw.exe" Else w = d & "python.exe"
        If Existe(w) Then
          PorRegistro = w
          Exit Function
        End If
      End If
    Next
  Next
End Function

' PATH (ignora o "atalho" da Microsoft Store, que so abre a loja)
Function PorPath(nome)
  Dim partes, i, p, c
  PorPath = ""
  partes = Split(Expande("%PATH%"), ";")
  For i = 0 To UBound(partes)
    p = Trim(partes(i))
    If p <> "" Then
      If InStr(LCase(p), "\windowsapps") = 0 Then
        If Right(p, 1) <> "\" Then p = p & "\"
        c = p & nome
        If Existe(c) Then
          PorPath = c
          Exit Function
        End If
      End If
    End If
  Next
End Function

' Pastas comuns de instalacao (pega a versao mais nova)
Function PorPastas(nome)
  Dim bases, b, pa, sp, melhor, melhorNum, num, c
  PorPastas = ""
  melhor = "": melhorNum = -1
  bases = Array(Expande("%LOCALAPPDATA%") & "\Programs\Python", _
                Expande("%ProgramFiles%"), _
                Expande("%ProgramFiles(x86)%"), "C:\")
  For Each b In bases
    If fso.FolderExists(b) Then
      For Each sp In fso.GetFolder(b).SubFolders
        If LCase(Left(sp.Name, 7)) = "python3" Then
          c = sp.Path & "\" & nome
          num = Val(Mid(sp.Name, 7))
          If Existe(c) And num > melhorNum Then
            melhor = c
            melhorNum = num
          End If
        End If
      Next
    End If
  Next
  PorPastas = melhor
End Function

Function AcharPython()
  Dim r
  AcharPython = ""
  r = PorRegistro(True)
  If r = "" Then r = PorPath("pythonw.exe")
  If r = "" Then r = PorPastas("pythonw.exe")
  If r = "" Then r = PorRegistro(False)
  If r = "" Then r = PorPath("python.exe")
  If r = "" Then r = PorPastas("python.exe")
  AcharPython = r
End Function

' Cria o atalho "Triturador Hartha" (com icone) na Area de Trabalho. Sem tela preta.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
exe = pasta & "\dist\TrituradorHartha.exe"
If Not fso.FileExists(exe) Then exe = pasta & "\TrituradorHartha.exe"
Set lnk = sh.CreateShortcut(sh.SpecialFolders("Desktop") & "\Triturador Hartha.lnk")
If fso.FileExists(exe) Then
  lnk.TargetPath = exe
Else
  ' Sem .exe: usa pythonw (sem console) com o Triturador.pyw
  lnk.TargetPath = "pythonw.exe"
  lnk.Arguments = """" & pasta & "\Triturador.pyw"""
End If
lnk.WorkingDirectory = pasta
lnk.IconLocation = pasta & "\icone.ico"
lnk.Save
MsgBox "Atalho criado na Area de Trabalho.", 64, "Triturador Hartha"

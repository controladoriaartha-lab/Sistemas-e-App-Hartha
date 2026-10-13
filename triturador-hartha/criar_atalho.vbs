' Cria o atalho "Triturador Hartha" COM O LOGO (nesta pasta e na Area de Trabalho).
' Sem tela preta. Coloque este arquivo na MESMA pasta do Triturador.pyw e do icone.ico
' e de dois cliques. Depois pode copiar/mover o atalho .lnk para onde quiser.
Option Explicit
Dim sh, fso, pasta, alvo, ico, caminhos, i, lnk
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
ico   = pasta & "\icone.ico"

alvo = pasta & "\Triturador.pyw"
If Not fso.FileExists(alvo) Then alvo = pasta & "\TrituradorHartha.exe"
If Not fso.FileExists(alvo) Then
  MsgBox "Nao encontrei Triturador.pyw nem TrituradorHartha.exe nesta pasta:" & vbCrLf & pasta, 16, "Triturador Hartha"
  WScript.Quit 1
End If
If Not fso.FileExists(ico) Then
  MsgBox "Nao encontrei o arquivo icone.ico nesta pasta:" & vbCrLf & pasta, 16, "Triturador Hartha"
  WScript.Quit 1
End If

caminhos = Array(pasta & "\Triturador Hartha.lnk", sh.SpecialFolders("Desktop") & "\Triturador Hartha.lnk")
For i = 0 To UBound(caminhos)
  Set lnk = sh.CreateShortcut(caminhos(i))
  lnk.TargetPath = alvo
  lnk.WorkingDirectory = pasta
  lnk.IconLocation = ico & ",0"
  lnk.Description = "Triturador de Arquivo Permanente"
  lnk.Save
Next
MsgBox "Atalho com o logo criado:" & vbCrLf & vbCrLf & caminhos(0) & vbCrLf & caminhos(1), 64, "Triturador Hartha"

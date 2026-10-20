# Triturador Hartha

**Uso mais simples:** dê dois cliques em `TrituradorHartha.exe` (já vem pronto, não precisa instalar nada).

Aplicativo portátil (um único arquivo, sem instalação, sem dependências) que apaga
arquivos e pastas **permanentemente**, sem passar pela lixeira.

Como funciona, por arquivo: sobrescreve o conteúdo (padrões 00/FF/55/AA + dados
aleatórios; a última passada é sempre aleatória, padrão 3 passadas), força gravação
no disco (`fsync`), zera o tamanho, troca o nome por um aleatório e só então remove.

## Usar
- **Arrastar e soltar:** arraste quantos arquivos e pastas quiser para a janela (ou use os botões), confira a lista e clique em **TRITURAR AGORA OS ARQUIVOS**. Durante a exclusão, chamas animadas mostram que os arquivos estão sendo destruídos.
- **Interface (sem tela preta):** `TrituradorHartha.exe` ou duplo clique em `Triturador.pyw`.
- **Linha de comando:** `python triturador.py [-p N] [-y] CAMINHO ...` (sem `-y` exige digitar `APAGAR`).
- **Gerar o .exe portátil (Windows):** rodar `build_windows.bat` → `dist\TrituradorHartha.exe` (sem console, com ícone).
- **Atalho na Área de Trabalho:** duplo clique em `criar_atalho.vbs`.
- `gerar_icone.py` recria o `icone.ico` (opcional, requer Pillow).

## Proteções
Recusa raiz da unidade, pasta do usuário e pastas do sistema. Links simbólicos nunca
são seguidos (remove só o atalho).

## Limites (leia antes de confiar)
- **SSD/NVMe, pendrive e cartão:** o controlador faz *wear-leveling*, então a sobrescrita
  pode não atingir as células antigas. Para esses discos, o método confiável é **criptografia
  de disco (BitLocker/VeraCrypt) + TRIM**, ou descartar a chave/o disco. Em HDD comum, funciona bem.
- **Sistemas com journaling/snapshots** (NTFS com Shadow Copy, APIs de histórico de arquivos,
  btrfs/ZFS) podem manter cópias antigas.
- **Cópias fora do arquivo:** nuvem (OneDrive/Drive), backups, histórico de versões, arquivos
  temporários e miniaturas não são afetados.
- **Arquivos já enviados à lixeira ou apagados antes** não são triturados; para isso seria
  necessário limpar o espaço livre (não incluído nesta versão).
- Não há desfazer. Confira a lista antes de confirmar.

## Visual e comportamento (v9)
- Moldura 3D em relevo (metal dourado escovado, chanfro e parafusos) em volta de todo o aplicativo;
  paleta azul-marinho + dourado; logo grande ao lado do título; barra de título escura (Windows 11).
- **Janela comum:** não fica mais "por cima de tudo". Outras janelas podem cobri-la, lado a lado ou
  parcialmente sobrepostas. Soltar arquivos funciona em qualquer ponto visível da janela.
- **Modo mini:** botão no canto superior direito do cabeçalho reduz a janela para ~6x menos área
  (360x244) e amplia de volta. No mini dá para soltar arquivos e triturar normalmente.
- **Animação ao triturar:** o logo do triturador aparece no painel de baixo, vibrando como máquina
  em trabalho, e por baixo dele jorra uma chuva rápida de faíscas (como aço sendo moído), com rastro,
  quique no chão e estrelinhas. Se o computador for lento, o programa reduz sozinho a quantidade de faíscas.

## Memória da janela (v11)
O programa lembra **o modo (mini ou aberto) e a posição** em que foi fechado e reabre igual. Fica gravado em
`TrituradorHartha.estado.json`, ao lado do programa (portátil; se a pasta não permitir escrita, usa `%APPDATA%`).
Se a posição gravada ficar fora da tela (ex.: monitor desconectado), a janela volta para dentro dela.
Para "esquecer", apague esse arquivo.

## Percentual e ícone
- Durante a trituração aparece o **percentual real** (bytes x passadas) ao lado do botão de ampliar/reduzir.
- O logo aparece na barra de tarefas e no Alt+Tab (o programa se identifica ao Windows como app próprio,
  em vez de "Python", inclusive quando aberto pelo `Triturador.pyw`).

## Instalar em outro computador (atalho com o logo, sem tela preta)
1. Copie a pasta inteira do programa para o computador (precisa ter `triturador.py` + `Triturador.pyw` +
   `icone.ico` + `criar_atalho.vbs`; ou só o `TrituradorHartha.exe` se o computador não tiver Python).
2. **Neste computador**, dê dois cliques em `criar_atalho.vbs`. Ele localiza o Python instalado (registro do
   Windows, PATH e pastas comuns), cria `Triturador Hartha.lnk` **com o logo** na própria pasta e na Área de
   Trabalho, confere o resultado e mostra uma mensagem. Sem tela preta.
3. Não copie o `.lnk` de um computador para outro: ele guarda o caminho do computador onde foi criado.
   Rode o `criar_atalho.vbs` em cada computador (pode rodar de novo quando quiser; ele recria do zero).

O atalho aponta direto para o `pythonw.exe` (Python sem console), por isso **não depende** de como o Windows
associa arquivos `.pyw`, que era a causa da tela preta. O logo fica guardado em
`%LOCALAPPDATA%\TrituradorHartha\TrituradorHartha.ico` (não some se a pasta do programa mudar).
Se o Windows bloquear arquivos `.vbs`, rode no Prompt: `pythonw triturador.py --criar-atalho`.
Sem Python, o `TrituradorHartha.exe` já traz o logo e não abre console.

**Proteções extras:** se o programa for aberto de outro jeito (por exemplo, duplo clique em `triturador.py`) e
aparecer a tela preta, ele a esconde sozinho (mas não mexe se você abriu pelo Prompt/PowerShell). Se o
Python do computador estiver sem tkinter, aparece um aviso explicando, em vez de não abrir nada.

## Se a janela sumir (corrigido na v7)
Causa real encontrada em teste: o gancho de arrastar-e-soltar era descartado da memória e, depois,
chamava o tkinter dentro do callback do Windows; ambos derrubavam o programa. Foi corrigido e testado.

A janela fica sempre por cima das outras (não esconde atrás do Explorador ao arrastar).
Se o programa fechar por algum erro, ele grava os detalhes em `triturador_erro.log`
(na mesma pasta do programa) e mostra um aviso na tela.

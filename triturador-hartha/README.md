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

## Visual (v8)
Moldura 3D em relevo (metal dourado escovado, chanfro e parafusos) em volta de todo o aplicativo,
barra de título escura com texto dourado (Windows 11), botões modernos e paleta azul-marinho + dourado.
A janela fica sempre por cima das demais (reafirmado a cada segundo) e aceita soltar arquivos
em qualquer ponto dela, mesmo sobreposta a outras janelas.

## Se a janela sumir (corrigido na v7)
Causa real encontrada em teste: o gancho de arrastar-e-soltar era descartado da memória e, depois,
chamava o tkinter dentro do callback do Windows; ambos derrubavam o programa. Foi corrigido e testado.

A janela fica sempre por cima das outras (não esconde atrás do Explorador ao arrastar).
Se o programa fechar por algum erro, ele grava os detalhes em `triturador_erro.log`
(na mesma pasta do programa) e mostra um aviso na tela.

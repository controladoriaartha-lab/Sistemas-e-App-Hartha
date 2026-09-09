# Site — Finanças & Engenharia de IA Aplicada

Site institucional de Geovanil / ARTHA: atuação como CFO e Controller fracionado
(Interim CFO), controladoria, FP&A e automação com IA Generativa.

## Conteúdo

| Arquivo | Descrição |
|---|---|
| `index.html` | Versão final do site — arquivo único, autocontido (fontes e imagens embutidas), com camada de movimento. Logo ARTHA aplicado na seção **Sobre**, com recorte de fundo transparente e proporção ajustada para desktop e celular. |
| `portfolio-movimento/` | Três estudos de linguagem de movimento para o mesmo conteúdo, para comparação: |
| `portfolio-movimento/index.html` | Página que abre as três opções lado a lado. |
| `portfolio-movimento/opcao-1-parallax.html` | Parallax Executivo — sóbrio, institucional (navy + verde). |
| `portfolio-movimento/opcao-2-aurora.html` | Aurora Animada — fundo aurora, glassmorphism, palavra rotativa, botão magnético. |
| `portfolio-movimento/opcao-3-kinetic.html` | Kinetic Typography — tipografia grande, revelação por máscara, marquee de números. |

## Notas técnicas

- Arquivos únicos, sem build. `index.html` já serve para GitHub Pages.
- As opções de `portfolio-movimento/` dependem apenas do Google Fonts e respeitam
  `prefers-reduced-motion`.
- `index.html` embute todos os assets em base64 (~1,5 MB).

# NEUROCORP9 - Diário Corporal por Voz

App web (React + Vite + TypeScript + Recharts) a partir do PRD e do Kit NEUROCORP9.
Funciona 100% local por padrão: dados no `localStorage`, classificação por regras PT-BR.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5174 (porta definida em .claude/launch.json do repo)
npm run build
```

Voz: Web Speech API (`pt-BR`), funciona no Chrome/Edge com HTTPS ou localhost.
Sem suporte de voz, use o campo de texto.

## O que está implementado (PRD)

| RF | Status |
|---|---|
| RF01/02 Voz PT-BR | Web Speech API (Deepgram/Whisper ficam para a versão nativa) |
| RF03 Classificação | Regras locais + Edge Function opcional (`VITE_CLASSIFY_URL`) |
| RF04 Edição manual | Intensidade editável e remoção por registro |
| RF05 Gráfico corporal | SVG com ids head, shoulders, arms, core, legs, feet |
| RF06 Timeline | Lista do dia em ordem reversa |
| RF07 Radar | 6 dimensões, % da rotina ideal |
| RF08 Não feitos | Diff rotina ideal x registros, botão "Fazer agora" |
| RF09 Histórico | Evolução semanal do Índice NEUROCORP9 (7 dias) |
| RF10-12 | Pendentes: nudges, export CSV, fila offline/sync |

## Fórmulas

- Score = (duração × intensidade) / 2
- Índice NEUROCORP9 = 0,4 × Corpo + 0,3 × Mente + 0,3 × Casa
- Corpo = pontos de Física/Movimento ÷ meta de 60 pts/dia (`META_CORPO_PTS`, limitado a 100)
- Mente = % da rotina Mental + Intelectual cumprida; Casa = % de Organização + Limpeza
- Rotina ideal padrão em `src/types.ts` (`ROTINA_PADRAO`)

## Supabase + IA (opcional)

1. Crie um projeto no Supabase e rode `supabase/schema.sql` no SQL Editor.
2. `supabase secrets set OPENAI_API_KEY=...` e `supabase functions deploy classify`.
3. Copie `.env.example` para `.env.local` e preencha `VITE_CLASSIFY_URL` e `VITE_SUPABASE_ANON_KEY`.

Com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidos, aparece "Entrar para sincronizar"
(e-mail + senha). Logado, os registros vão para `activities_log` com RLS e atualizam em
tempo real entre dispositivos; deslogado, segue no `localStorage`. Os dados locais não são
migrados automaticamente ao entrar.

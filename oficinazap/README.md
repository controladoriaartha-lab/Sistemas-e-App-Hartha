# OficinaZap v0.2 — padrão multi-oficina

Protótipo navegável (arquivo único, sem build) do assistente de **agendamento + financeiro
pelo WhatsApp** para oficinas mecânicas, evoluído a partir do rascunho v0.1 para servir
**várias oficinas com o mesmo padrão**.

**Como ver:** abra `index.html` no navegador. Os dados são fictícios e ficam no
`localStorage` (um espaço separado por oficina). Nada é publicado nem enviado de verdade.

## O que mudou em relação à v0.1

### 1. Padrão para várias oficinas
- **Seletor de oficina** no topo (cada uma com dados, cor, horários, serviços e número próprios).
- **＋ Nova oficina a partir do padrão**: nome, segmento (mecânica, auto elétrica, funilaria,
  pneus, moto), boxes, horários e cor. O catálogo de serviços do segmento, a política de
  almoço, as mensagens e o checklist de go-live vêm prontos.
- **Ficha de implantação** (`⬇ Exportar` / `⬆ Importar` / `⧉ Duplicar`): JSON só com
  configuração e serviços — **sem dados de clientes ou financeiros** (LGPD). Modelo em
  `padrao/oficina.template.json`.
- **Checklist de go-live** por oficina (Meta, número, templates, Calendar, treinamento…).
- Já vêm 3 oficinas de exemplo: *Mecânica do Zé* (2 boxes), *Auto Elétrica Silva*
  (3 boxes, outro horário) e *Bom Pneu* (vazia, para ver o estado “oficina nova”).

### 2. Almoço estendido, com aviso por WhatsApp
O dono pode estender o almoço de um dia em **15 min, 30 min, 1 h, 1h30, 2 h ou valor livre**:
- **Pelo painel** (Agenda → card “Almoço do dia”): o modal mostra *quem é impactado*,
  *para que horário vai* e a **prévia da mensagem**; só envia depois do “Aplicar”.
- **Pelo WhatsApp do dono**: “*almoço mais 1 hora hoje*”, “*estende o almoço 30 min*”,
  “*almoço amanhã mais 1h30*”, “*almoço volta ao normal*” — o assistente responde com o
  impacto e pede confirmação.
- **Política da oficina** (Config): *empurrar* o cliente para depois do almoço e avisar,
  ou *liberar o horário e pedir para remarcar*. Opção de avisar também os demais clientes
  da tarde (informativo).
- A agenda e o assistente passam a respeitar o novo horário na hora (nenhum cliente novo é
  agendado na janela). Ao **voltar ao normal**, quem já foi avisado recebe a atualização.
- Os envios aparecem na aba **Avisos**, com o template Meta usado (`almoco_estendido`).

### 3. Outras melhorias sobre o rascunho
- **Horário real por oficina** (dias, abre/fecha, sábado, almoço, antecedência) em vez do
  fixo 08–18/12–13. **Feriados nacionais** fecham o dia automaticamente; **Fechar este dia**
  cobre folgas e feriados locais/móveis, movendo os clientes para “aguardando remarcação”.
- **Remarcar** de verdade (cliente pelo chat; dono pelo painel) — antes só havia agendar e cancelar.
- **Lembretes 24h** acionáveis e **dar baixa** em contas a pagar/receber (antes impossível).
- **Edição e exclusão auditáveis** de lançamentos (histórico + desfazer), busca e filtro por mês.
- **Projeção corrigida**: usa os 3 últimos meses *fechados* (o mês corrente, parcial, pesava
  errado), e a comparação do faturamento é pelo *mesmo período* do mês anterior.
- 8 KPIs (inclui taxas de cartão estimadas e “a pagar em 7 dias” vs. saldo), catálogo de
  serviços editável, estados vazios, acessibilidade (foco, rótulos, `prefers-reduced-motion`),
  layout mobile e escape de HTML em todos os campos editáveis.

## Arquitetura de produção (o que o protótipo simula)
`padrao/schema.sql` é o banco multi-oficina (PostgreSQL/Supabase): toda tabela tem
`oficina_id`, o acesso é isolado por **RLS** e a **dupla marcação é impossível por
constraint** (exclusão de sobreposição por box). O webhook do WhatsApp identifica a
oficina pelo número que recebeu a mensagem (`oficinas.wa_phone_number_id`).
`padrao/templates-whatsapp.md` traz os 3 templates a aprovar na Meta.

| No protótipo | Em produção |
|---|---|
| Intenção/OCR/áudio simulados com regras | LLM + visão + Whisper |
| Agenda local | Google Calendar free/busy + `agendamentos` |
| Envio “simulado” na aba Avisos | WhatsApp Cloud API (template fora da janela de 24 h) |
| `localStorage` por oficina | Postgres com RLS |

## Onboarding de uma oficina nova (≈ 1 dia)
1. **＋ Nova oficina** (ou importar a ficha) → ajustar serviços e horários.
2. Cadastrar número do dono (autorizado) e número do assistente.
3. Submeter os 3 templates na Meta; conectar o Google Calendar.
4. Rodar o teste ponta a ponta do checklist (agendar, remarcar, cancelar, lançar foto/áudio, estender almoço).
5. Treinar o dono (30 min) e acompanhar a primeira semana.

## Limitações do protótipo
- Dados só no navegador; não há autenticação nem integração real.
- Feriados móveis e municipais não são automáticos (use “Fechar este dia”).
- “Empurrar” reposiciona cada cliente no primeiro horário livre após o almoço (passo de 15 min);
  se não houver vaga no dia, ele vai para “aguardando remarcação”.

# Decisões · OficinaZap

## Definidas com o responsável pelo projeto (12/10/2026)
| Tema | Decisão |
|---|---|
| Número de WhatsApp | A oficina piloto já tem número; ele será migrado para a Cloud API (verificar se não está preso ao app WhatsApp Business comum). |
| Capacidade | 2 boxes no piloto; parâmetro `oficinas.boxes`. |
| Atendimento | Autônomo (sem aprovação por resposta). Casos ambíguos ou urgentes transferem para o dono. |
| Regime tributário | Opcional: `simples`, `mei`, `outro`, `nao_informado`. |
| Modelo comercial | Piloto numa oficina, depois produto para várias: multi-tenant desde o início (`oficina_id` + RLS). |

## Decisões de arquitetura (propostas, a validar)
- **O banco é a fonte da verdade da agenda**; o Google Calendar é espelho. Conflito é barrado em `criar_agendamento()` com advisory lock + contagem de capacidade.
- **Financeiro por WhatsApp só para números em `contatos_autorizados`.** Cliente comum nunca chega ao módulo financeiro.
- **Caixa × competência:** `lancamentos` guarda `data_caixa` (visão do dono) e `data_competencia` (margem por serviço). Cartão parcelado gera entradas futuras de caixa.
- **Edições de lançamento** gravam `lancamentos_historico`; nada é sobrescrito.
- **MVP em duas entregas:** (1) agenda + lançamentos por texto/foto + saldo e relatório semanal; (2) painel completo, projeção por cenários (com 6+ meses de histórico), áudio, cobrança.
- **Templates da Meta** necessários para lembrete, cobrança e relatório semanal (fora da janela de 24 h). Submeter na semana 1.

## Pendências
- Regra de cobrança de peça: por conta do cliente × comprada pela oficina.
- Maquininha integrada ou registro manual das taxas.
- Política de retenção LGPD (prazo) e texto de consentimento versionado.

## Backlog / observações (12/10/2026)
- **Ajuste de expediente pelo dono via WhatsApp** (ex.: "vou esticar meu almoço em 30 min / 1 hora hoje"):
  - O dono, número em `contatos_autorizados`, avisa em linguagem natural; o sistema confirma ("Almoço hoje vai até 14h30. Confirma?") antes de gravar.
  - Efeito 1: cria um registro em `bloqueios` (motivo "almoço estendido") ou prorroga a pausa só naquele dia, sem alterar `horarios_funcionamento`.
  - Efeito 2: o assistente avisa quem entrar em contato no período ("Estamos em horário de almoço, retornamos às 14h30") e só propõe horários depois do retorno.
  - Efeito 3: agendamentos já confirmados que caírem na janela bloqueada devem ser listados ao dono, com oferta de remarcar e avisar os clientes (template da Meta, se fora da janela de 24 h).
  - Dados a modelar: tipo do aviso (almoço estendido, saída antecipada, folga), início, fim, mensagem automática opcional, quem registrou.

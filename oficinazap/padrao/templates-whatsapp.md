# Templates de WhatsApp (Meta) — padrão OficinaZap v1.0

Mensagens enviadas **fora da janela de 24 h** de atendimento só são entregues se forem
**templates aprovados pela Meta**. Cadastre os três abaixo no WhatsApp Manager de cada
número de oficina (categoria **Utility**, idioma **pt_BR**) antes do go-live. Os nomes
são os mesmos usados pelo protótipo (aba **Avisos**), então o orquestrador não muda de
oficina para oficina.

> Os textos são sugestões. A Meta pode pedir ajustes na aprovação; mantenha os nomes
> dos templates e a ordem das variáveis.

## 1. `lembrete_24h`
Lembrete automático 24 h antes do horário.

```
Olá {{1}}! Lembrete: seu horário na {{2}} é amanhã, {{3}}, às {{4}} ({{5}}).
Precisa remarcar? É só responder aqui.
```
| Var | Conteúdo | Exemplo |
|---|---|---|
| {{1}} | primeiro nome do cliente | Maria |
| {{2}} | nome da oficina | Mecânica do Zé |
| {{3}} | data | ter 13/10 |
| {{4}} | hora | 13:00 |
| {{5}} | serviço | Troca de óleo |

Botões (resposta rápida): `Remarcar` · `Cancelar`

## 2. `almoco_estendido`
Dono estendeu o almoço e o horário do cliente mudou, foi liberado ou segue valendo.
O orquestrador monta o trecho `{{4}}` conforme a política da oficina:

| Caso | Valor de {{4}} |
|---|---|
| **empurrar** | `Seu atendimento (Troca de óleo) que era às 13:00 passou para às 14:00.` |
| **remarcar** | `Por isso precisamos remarcar seu horário das 13:00 (Troca de óleo).` |
| **informativo** | `Seu horário das 13:00 está mantido.` |
| **voltou ao normal** | `O almoço voltou ao normal e seu horário das 14:00 segue valendo.` |

```
Olá {{1}}! Aviso da {{2}}: hoje voltamos do almoço às {{3}}. {{4}}
Responda REMARCAR se preferir outro horário.
```
| Var | Exemplo |
|---|---|
| {{1}} | Carlos |
| {{2}} | Mecânica do Zé |
| {{3}} | 14:00 |
| {{4}} | (um dos textos da tabela acima) |

Botões (resposta rápida): `Remarcar` · `Pode ser`

## 3. `horario_alterado`
Dia fechado (folga, feriado local, imprevisto) ou remarcação feita pela oficina.

```
Olá {{1}}! A {{2}} precisa alterar seu horário de {{3}}.
Responda REMARCAR para ver novas opções ou CANCELAR.
```
| Var | Exemplo |
|---|---|
| {{1}} | Maria |
| {{2}} | Mecânica do Zé |
| {{3}} | ter 13/10 às 13:00 |

Botões (resposta rápida): `Remarcar` · `Cancelar`

---

### Boas práticas
- Envie só para quem **já conversou com a oficina** (consentimento / opt-in).
- Registre cada envio na tabela `avisos` (status `enfileirado → enviado → entregue → lido`).
- O comando do dono (“almoço mais 1 hora”) só vale se vier do número `dono_wa` da oficina.

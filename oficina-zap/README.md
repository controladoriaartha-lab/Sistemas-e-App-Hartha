# OficinaZap

Assistente de WhatsApp para oficinas mecânicas: **agendamento autônomo** + **financeiro por WhatsApp** (foto, áudio, texto), vendido como produto para várias oficinas.

- `prototipo/oficinazap.html`: protótipo interativo e escopo original (v0.1).
- `supabase/migrations/001_base_multi_oficina.sql`: esquema multi-oficina com RLS e agendamento sem dupla marcação.
- `supabase/functions/whatsapp-webhook/`: webhook da WhatsApp Cloud API (verificação, assinatura HMAC, idempotência).
- `docs/decisoes.md`: decisões de produto e arquitetura.

## Estado
Fase 1 (fundação) iniciada. Nada aplicado em ambiente remoto ainda.

## Configuração do webhook (segredos no Supabase, nunca no código)
`WA_VERIFY_TOKEN`, `WA_APP_SECRET`, e depois `WA_ACCESS_TOKEN` para envio de respostas.

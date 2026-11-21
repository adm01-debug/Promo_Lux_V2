# Estado dos itens executaveis — Promo_Lux_V2

Data: 2026-11-21 11:25
Base: origin/main @ a37f3197 (merge PR #80)

## Item 2 — Soft delete ampliado para tabelas de negocio
- PR #82 (branch claude/feat-softdelete-negocio-261121-0834): migration aditiva 20261121083400_soft_delete_tabelas_negocio.sql (deleted_at + indices parciais em email_suppressions, email_accounts, api_keys, webhooks) + ampliacao do padrao de purge (8 tabelas) + UI RecycleBinView com 4 abas novas.
- Validacao local (repo na PR): tsc --noEmit EXIT 0; eslint arquivo tocado EXIT 0; build EXIT 0; db:lint OK; dry-run da migration em transacao com ROLLBACK no banco real OK (nada aplicado).
- Fix pos-revisao: tipagem dos rows da lixeira (Record<string, unknown>) — commit 5e156dc0.
- Estado: ABERTA, aguardando (a) dono ajustar billing da org (Actions budget bloqueia CI) e (b) APROVADO do dono (Regra 8 — DDL). Nao aplicada em producao.

## Item 3 — Rotacao ADMIN_LIST_TOKEN
- Token antigo (exposto no historico publico f7bec29) rotacionado.
- VITE_ADMIN_LIST_TOKEN atualizado no Vercel (producao + preview, 201); ADMIN_LIST_TOKEN atualizado no Supabase (201); redeploy Vercel READY no commit a37f3197 (mesmo da main).
- Verificacao real: token antigo -> 401 Unauthorized; token novo -> 200 com companies reais (total 5). CORS da edge function confirmado (OPTIONS 200).
- Estado: CONCLUIDO e verificado. Valores novos nunca em commit; apenas em secrets dos servicos.

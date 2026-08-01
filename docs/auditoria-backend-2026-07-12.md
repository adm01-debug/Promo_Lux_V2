# Auditoria Profunda de Back-End — LUX IA

**Data:** 2026-07-12 · **Autor:** Engenharia Back-End Sênior · **Escopo:** arquitetura, dados, segurança, performance, operação, custos.

---

## 1. Sumário Executivo

O sistema é um SaaS multi-tenant (organizações) de raspagem e prospecção por IPC, com backend em PostgreSQL (Lovable Cloud/Supabase), Edge Functions e frontend React. A postura geral é **madura**: 55 tabelas, **100% com RLS habilitado**, isolamento por organização via `is_org_member`/`has_role`, DLQ com backoff exponencial, circuit breakers, snapshots de saúde, alertas e cron jobs.

**Principais achados desta auditoria:**

| # | Categoria | Severidade | Status |
|---|-----------|-----------|--------|
| 1 | Funções internas de manutenção/admin executáveis por chamador **anônimo** (anon key pública) | 🔴 Alta | ✅ Corrigido |
| 2 | Chaves estrangeiras sem índice (varredura em cascata) | 🟡 Média | ✅ Corrigido |
| 3 | `Extension in Public` (linter) | 🔵 Baixa | Aceito/Backlog |
| 4 | Proteção de senha vazada (HIBP) / OTP expiry | 🟡 Média | Recomendado |
| 5 | Padrão "auth.uid() IS NULL = worker confiável" em SECURITY DEFINER | 🟡 Média | Mitigado por grants |

---

## 2. Detalhamento por Categoria

### 2.1 Segurança 🔴 → ✅

**Problema (crítico):** várias funções `SECURITY DEFINER` de manutenção e administração tinham `EXECUTE` concedido a `anon`. O guard interno seguia o padrão `IF auth.uid() IS NOT NULL AND NOT has_role(...,'admin') THEN RAISE`, ou seja, **um chamador sem JWT (auth.uid() NULL) passava direto** — e a anon key é pública no bundle do frontend.

**Evidência (pré-fix):** 11 funções com `has_function_privilege('anon', ..., 'EXECUTE') = true`, incluindo:
- `prune_dlq_health_snapshots()` → **DELETE** de dados (perda).
- `reset_circuit_breaker(text)` → reset de disjuntores (estabilidade).
- `evaluate_dlq_alerts(...)` / `evaluate_partition_policies()` → **spam de notificações** a admins.
- `capture_db_health_snapshot()` / `capture_dlq_health_snapshots()` → inserção não autorizada.

**Impacto:** perda de dados, poluição de métricas, negação de serviço leve e assédio de notificações — tudo sem autenticação.

**Correção aplicada (migração):**
```sql
-- Manutenção/cron: apenas service_role/postgres
REVOKE EXECUTE ON FUNCTION public.capture_db_health_snapshot() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_dlq_health_snapshots() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_dlq_alerts(int,int,int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_dlq_health_snapshots() FROM anon, authenticated;
-- log_automation_event revogado via loop (assinatura longa)
-- Admin via UI: remove apenas anon (guard de papel permanece)
REVOKE EXECUTE ON FUNCTION public.reset_circuit_breaker(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_partition_policies() FROM anon;
-- Defesa em profundidade (mantém authenticated)
REVOKE EXECUTE ON FUNCTION public.enqueue_scrape_task(...) FROM anon;
REVOKE EXECUTE ON FUNCTION public.replay_dead_letter(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_latency_stats(int,int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dlq_health_trend(int) FROM anon;
GRANT EXECUTE ... TO service_role; -- cron/edge continuam
```
**Resultado:** linter caiu de **41 → 33** issues. Cron (roda como `postgres`, superuser) e Edge Functions (`service_role`) seguem funcionando.

**Recomendação futura (endurecimento):** trocar o padrão de guard por checagem explícita de role real em vez de "sem JWT". Ex.: `IF current_setting('request.jwt.role', true) IS DISTINCT FROM 'service_role' AND NOT has_role(auth.uid(),'admin') THEN RAISE`. Isso remove a dependência de grants para a garantia de segurança.

**Recomendações de Auth (backlog):**
- Ativar **Leaked Password Protection (HIBP)** e reduzir OTP expiry (< 1h).
- Confirmar que sign-up anônimo está desativado (padrão) e provider Google configurado.

### 2.2 Banco de Dados & Performance 🟡 → ✅

- **RLS:** 100% das tabelas públicas — excelente. Nenhuma policy concede `anon` indevidamente (0 policies com role anon).
- **FKs sem índice (corrigido):** `scrape_queue.scrape_job_id` e `partition_advisories.policy_id` não tinham índice → varredura em cascata em joins/DELETE. Índices criados.
- **Slow queries:** nenhuma query de aplicação acima de ~44 ms; topo é `circuit_breakers` por `service_name` (0,97 ms médio, 171 chamadas) — saudável. `campaign_ab_stats` (30 ms, 1 chamada) e `api_latency_trend` merecem observação sob volume.
- **Recomendações:** garantir índices parciais em colunas de `status`/`next_run_at` da fila (padrão de claim `FOR UPDATE SKIP LOCKED`); avaliar `pg_stat_statements` periodicamente após crescimento de dados.

### 2.3 Lógica de Negócio & Manutenibilidade 🔵

- DLQ, backoff exponencial com jitter, circuit breakers, idempotency keys e auditoria via trigger estão bem modelados e seguem boas práticas.
- **Gap:** o padrão de "worker sem JWT" espalhado por muitas funções acopla segurança a grants. Centralizar em um helper `assert_service_or_admin()` reduz risco de regressão.
- **Testes:** existe suíte (`withOrg.registry.test.ts`, fixtures). Recomenda-se cobertura de RLS por role e testes de contrato das RPCs sensíveis.

### 2.4 Operação & Custos 🔵

- Cron jobs de captura/prune agendados (15 min / diário) — bom para retenção e custo.
- Retenção de 30 dias em snapshots evita crescimento descontrolado.
- **Recomendação:** alertas de erro das Edge Functions (via logs) e painel de latência já iniciado; concluir UI de configuração de thresholds por org.

---

## 3. Lista de Prioridades (Roadmap)

1. **[Crítico — FEITO]** Revogar EXECUTE anônimo em funções de sistema.
2. **[Importante]** Endurecer guards SECURITY DEFINER com checagem de role explícita (não depender de grants).
3. **[Importante]** Ativar HIBP + reduzir OTP expiry.
4. **[Desejável — FEITO]** Índices em FKs descobertas.
5. **[Desejável]** Mover extensões de `public` para schema `extensions`.
6. **[Desejável]** Ampliar testes de RLS/contrato das RPCs.

---

## 4. Benchmarking

| Dimensão | LUX IA | Padrão de mercado | Veredito |
|----------|--------|-------------------|----------|
| RLS coverage | 100% | 100% (obrigatório multi-tenant) | ✅ No padrão |
| Isolamento multi-tenant | `is_org_member`/`has_role` (SECURITY DEFINER) | Recomendado | ✅ No padrão |
| Resiliência (DLQ, circuit breaker, backoff) | Presente | Frequentemente ausente em MVPs | ✅ Acima da média |
| Observabilidade (snapshots, alertas, cron) | Presente | Comum em produtos maduros | ✅ No padrão |
| Superfície SECURITY DEFINER exposta | Corrigida | Menor superfície = melhor | ✅ Após fix |

**Referências:** OWASP Top 10 (A01 Broken Access Control), Supabase DB Linter (0028/0029), PostgreSQL — FK indexing, princípio de menor privilégio.

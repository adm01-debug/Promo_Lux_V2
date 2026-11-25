-- ---------------------------------------------------------------------------
-- Baixa o limite critico de p95 do alarme de latencia: 1500 ms -> 800 ms
-- ---------------------------------------------------------------------------
-- A API publica ficou rapida depois do round-trip unico (#193) e do aquecimento
-- no smoke (#191). Janela limpa medida em producao (captured_at >= 24/11 21:30Z,
-- 260 snapshots, 1463 requests, 0 erros): p95 medio de 262 a 298 ms por rota e
-- pior snapshot de 694 ms (/public-api/companies) - nenhum snapshot chegou a
-- 1500 ms e nenhum alerta nasceu no periodo.
--
-- Em 1500 ms o alarme so acorda num desastre (~5x a media atual). Em 800 ms ele
-- acusa uma regressao real: ~2,7x de folga sobre a media de hoje e 15% acima do
-- pior p95 ja observado, ainda exigindo 3 ciclos consecutivos (45 min de smoke)
-- e respeitando o cooldown de 6 h de `api_latency_alert_history`.
--
-- O fallback da funcao (`_p95_critical_ms DEFAULT 1500`) so vale para
-- organizacao com snapshots e SEM linha em `api_latency_alert_settings`; a
-- migration 20261124211000 cria a linha para toda organizacao com chave ativa,
-- entao esse caminho fica inalcancavel pela via de alerta atual.
-- ---------------------------------------------------------------------------

alter table public.api_latency_alert_settings
  alter column p95_critical_ms set default 800;

update public.api_latency_alert_settings
set p95_critical_ms = 800,
    updated_at = now()
where p95_critical_ms > 800;
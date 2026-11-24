-- ---------------------------------------------------------------------------
-- Limite de alerta de latencia para toda organizacao com chave ativa
-- ---------------------------------------------------------------------------
-- `latency-alerts` (edge) e `evaluate_api_latency_alerts()` (cron SQL) iteram
-- `api_latency_alert_settings`: organizacao sem linha nao tem limite, nao tem
-- alerta e falha em silencio, mesmo com trafego. Verificado em producao em
-- 24/11/2026: existe 1 organizacao com chave ativa (Promo Brindes,
-- 6cd7921e-5753-40e5-a1c0-69ebc9c2f946) e ela e a unica linha da tabela.
--
-- Esta migration insere 0 linhas hoje; existe para o caso de uma segunda
-- organizacao passar a usar a API publica - a via de alerta nasce configurada
-- em vez de ficar inerte ate alguem notar. Idempotente e segura no replay do
-- zero (nenhuma chave ativa -> nenhuma linha).
-- ---------------------------------------------------------------------------

insert into public.api_latency_alert_settings (organization_id)
select distinct k.organization_id
from public.api_keys k
join public.organizations o on o.id = k.organization_id
where k.active is true
  and k.deleted_at is null
  and k.organization_id is not null
on conflict (organization_id) do nothing;
-- ---------------------------------------------------------------------------
-- Habilita a avaliacao de alertas de latencia para a organizacao com trafego
-- ---------------------------------------------------------------------------
-- `latency-alerts` (edge function) so itera organizacoes que tem linha
-- habilitada em `api_latency_alert_settings`; a tabela tinha 0 linhas, entao a
-- funcao respondia {"ok":true,"triggered":0} sem nunca avaliar nada - trabalho
-- entregue e deployado, mas inerte.
--
-- Medido em producao (24/11/2026): a unica organizacao com requisicoes na API
-- publica e "Promo Brindes" (6cd7921e-5753-40e5-a1c0-69ebc9c2f946, 182 reqs).
-- Os limites ficam nos defaults da tabela (p95 1500 ms, 3 ciclos, cooldown 6h),
-- os mesmos de `evaluate_api_latency_alerts()`, de modo que as duas vias
-- compartilham o cooldown via `api_latency_alert_history` sem duplicar alerta.
--
-- O INSERT usa SELECT em `organizations` para nao quebrar o replay do zero,
-- onde a organizacao ainda nao existe; ON CONFLICT mantem a idempotencia.

insert into public.api_latency_alert_settings (organization_id)
select o.id
from public.organizations o
where o.id = '6cd7921e-5753-40e5-a1c0-69ebc9c2f946'
on conflict (organization_id) do nothing;

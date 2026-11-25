-- ---------------------------------------------------------------------------
-- Trilha de auditoria: retencao de 5 anos (decisao do dono do produto).
--
-- Requisito de negocio: o registro de "quem fez o que dentro do sistema" tem
-- valor legal e precisa ficar disponivel por 5 anos. Ate agora a trilha tinha
-- teto de 180 dias (`prune_audit_logs(180)` no job `daily-log-retention` e
-- default 180 na propria funcao) — ou seja, o historico de auditoria era
-- apagado em 6 meses, e `docs/LGPD.md` ainda prometia 90.
--
-- Medido em 25/11/2026 (producao, pttzwlbidamibjssqiqb):
--   audit_logs .............. 377 linhas, mais antiga 2026-07-30 (~118 dias)
--   325 dessas linhas ja passaram dos 90 dias prometidos na doc
--   144 delas tem campo `email`; 234 sao dado de negocio (companies/deals/
--   organization_members) e 91 sao log operacional (workflow_runs etc.)
--   100% tem `actor_id` preenchido (3 usuarios reais)
-- Com 5 anos de retencao, **nada e apagado agora** — a mudanca existe para
-- impedir que a trilha continue sendo truncada em 180 dias.
--
-- Janela: 1827 dias = 5*365 + 2. Um periodo de 5 anos pode conter dois anos
-- bissextos, entao esse e o maior numero de dias que cabe em 5 anos; usar
-- 1825 deixaria a trilha ate 2 dias curta em alguns periodos.
--
-- Unico ponto de delecao: verificado no catalogo que apenas
-- `public.prune_audit_logs` executa DELETE em audit_logs, e apenas o job 12
-- (`daily-log-retention`) a chama. Nao ha outro caminho de expurgo.
-- ---------------------------------------------------------------------------

create or replace function public.prune_audit_logs(retention_days integer default 1827)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE deleted_count int;
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: job daily-log-retention nao reagendado';
    return;
  end if;

  begin
    perform cron.unschedule('daily-log-retention');
  exception
    when others then
      raise notice 'daily-log-retention ainda nao agendado neste ambiente';
  end;

  perform cron.schedule(
    'daily-log-retention',
    '15 3 * * *',
    $cron$SELECT public.prune_api_request_logs(90); SELECT public.prune_audit_logs(1827); SELECT public.prune_automation_execution_logs(60);$cron$
  );

  raise notice 'daily-log-retention reagendado com prune_audit_logs(1827) = 5 anos';
end $$;
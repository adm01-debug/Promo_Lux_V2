-- Fix: refresh_org_scores ficou com GRANT EXECUTE apenas para service_role na
-- migration 20261121193000, enquanto as outras quatro funcoes do mesmo pacote
-- foram para "authenticated, service_role". O hook useLeadScores.refresh()
-- chama essa RPC a partir da sessao do usuario, entao o botao "Recalcular"
-- falhava com permission denied para qualquer usuario autenticado.
--
-- manter simetria com compute_lead_score / compute_deal_prediction /
-- refresh_lead_score / refresh_deal_prediction. O gate de admin dentro da
-- funcao (has_org_role) continua sendo a autorizacao real; o GRANT apenas
-- permite que a chamada chegue ate ele.

grant execute on function public.refresh_org_scores(uuid) to authenticated;
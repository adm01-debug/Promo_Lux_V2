-- create_default_deal_stages tinha uma janela de corrida: checava
-- "IF EXISTS (SELECT 1 FROM deal_stages WHERE user_id = _user_id)" e só
-- depois inseria as 6 colunas padrão, sem nenhum lock entre as duas etapas.
-- useDealStages() (frontend) dispara essa RPC via useEffect sempre que a
-- lista carrega vazia — se o hook montar em mais de um lugar ao mesmo tempo
-- (StrictMode em dev, múltiplas abas, remontagem rápida), duas transações
-- podiam ambas ver "0 stages" antes de qualquer INSERT commitar e ambas
-- inserirem o conjunto padrão, duplicando o board Kanban do usuário. Não há
-- constraint único em (user_id, name) que pegasse isso (e adicionar um
-- agora arriscaria falhar em cima de duplicatas que já existam).
-- pg_advisory_xact_lock serializa chamadas concorrentes para o mesmo
-- usuário e libera automaticamente no fim da transação.
CREATE OR REPLACE FUNCTION public.create_default_deal_stages(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('create_default_deal_stages:' || _user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.deal_stages WHERE user_id = _user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.deal_stages (user_id, name, color, position, probability, type) VALUES
    (_user_id, 'Lead', '#94A3B8', 0, 10, 'open'),
    (_user_id, 'Qualificado', '#3B82F6', 1, 25, 'open'),
    (_user_id, 'Proposta', '#A855F7', 2, 50, 'open'),
    (_user_id, 'Negociação', '#F59E0B', 3, 75, 'open'),
    (_user_id, 'Ganho', '#10B981', 4, 100, 'won'),
    (_user_id, 'Perdido', '#EF4444', 5, 0, 'lost');
END $$;

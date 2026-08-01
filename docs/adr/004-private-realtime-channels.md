# ADR-004: Realtime com Canais Privados

## Status
Aceito

## Contexto
O sistema usa Supabase Realtime para atualizar a UI quando empresas ou jobs mudam. Canais públicos expõem dados entre usuários.

## Decisão
- Canais Realtime nomeados com `user_id`: `companies-{userId}`, `scrape-jobs-{userId}`
- Hooks `useRealtimeCompanies` e `useRealtimeScrapeJobs` criam canais privados
- Eventos `postgres_changes` filtrados por `user_id` via filter do canal
- Canal só é criado quando `user` está autenticado (via `useAuth`)

## Consequências
- **Positivo**: Isolamento de dados em tempo real; cada usuário só recebe seus eventos
- **Negativo**: Um canal por usuário por tabela; pode escalar em muitos canais
- **Regra**: Todo novo hook realtime deve incluir `user_id` no nome do canal e no filtro

# ADR-003: Edge Functions como Proxy Seguro

## Status
Aceito

## Contexto
A API externa de raspagem (GMaps Scraper) não possui autenticação própria. Chamá-la diretamente do frontend exporia o endpoint e permitiria abuso.

## Decisão
- Todas as chamadas à API externa passam por edge functions
- Edge functions validam JWT do usuário antes de qualquer operação
- Input validado com Zod schemas tipados
- CORS com whitelist de origins (produção + preview)
- Timeouts explícitos em chamadas externas (`AbortSignal.timeout`)
- Resultados salvos no banco com `user_id` para isolamento via RLS

## Consequências
- **Positivo**: API externa nunca exposta ao cliente; rate limiting e validação centralizados
- **Positivo**: Dados de raspagem persistidos e auditáveis
- **Negativo**: Latência adicional de ~50ms por hop
- **Regra**: Nunca chamar APIs externas diretamente do frontend

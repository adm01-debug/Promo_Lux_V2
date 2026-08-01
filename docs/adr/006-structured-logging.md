# ADR-006: Structured Logging em Edge Functions

## Status
Aceito

## Contexto
Edge functions usavam `console.log/error` não estruturado, dificultando debugging e monitoramento. Frontend também vazava logs em produção.

## Decisão
- Edge functions emitem JSON estruturado:
  ```json
  {
    "function": "ai-agent",
    "request_id": "uuid",
    "level": "info|error",
    "msg": "descrição",
    "duration_ms": 123,
    "ts": "ISO-8601"
  }
  ```
- Cada request gera um `request_id` UUID para rastreabilidade
- Frontend: `console.error` apenas quando `import.meta.env.DEV === true`
- ErrorBoundary condicional em dev mode
- Nenhum `console.log/error` direto em código de produção

## Consequências
- **Positivo**: Logs pesquisáveis e filtráveis; correlação por request_id
- **Positivo**: Sem vazamento de informação em produção
- **Negativo**: Verbosidade ligeiramente maior no código das functions
- **Regra**: Nunca usar `console.log` direto — sempre via `createLogger()`

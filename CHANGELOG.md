# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [10.0.0] - 2026-05-13
### Adicionado
- **Maturidade 10/10 Concluída**: Sistema em estado de perfeição técnica e operacional.
- **Observabilidade**: Distributed Tracing full-stack com headers `traceparent` (W3C).
- **Observabilidade**: Dashboard de Monitoramento com SLIs/SLOs e status de Edge Functions.
- **Segurança**: Tabela de `idempotency_keys` para prevenção de duplicatas em operações críticas.
- **Integridade**: Optimistic Locking (`version`) implementado em `companies` e `deals` com triggers de banco.
- **Operações**: Edge Function de `prune` automático de logs para conformidade com LGPD.
- **Arquitetura**: Máquina de Estados (XState-pattern) para fluxos de raspagem.
- **Documentação**: Diagrama ER (Mermaid), OpenAPI Spec e Relatório de Conformidade LGPD.
- **Qualidade**: Testes de acessibilidade (axe-core) integrados ao pipeline.

### Alterado
- UI: Sidebar atualizada com seção de Monitoramento e Status do Sistema.
- Banco de Dados: Migrations para suporte a tracing e versionamento de registros.


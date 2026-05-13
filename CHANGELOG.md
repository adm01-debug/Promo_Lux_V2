# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.0.0] - 2026-05-13
### Adicionado
- Implementação completa da Onda 1 da Auditoria Técnica.
- ADR-007: Multi-tenant Defense-in-Depth com Proxy Wrapper.
- ADR-008: Política de Soft Delete e Retenção de Dados.
- Configuração de Husky + lint-staged para garantir qualidade no commit.
- Configuração de Commitlint para mensagens de commit padronizadas.
- Integração de `vitest --coverage` com threshold de 70%.
- Job de Security Audit no CI utilizando `gitleaks`.
- CSP (Content Security Policy) e HSTS via meta tags no `index.html`.
- Skip-to-content para melhor acessibilidade.
- Documentação de contribuição (`CONTRIBUTING.md`).

### Alterado
- CI/CD: Playwright agora bloqueia o pipeline em caso de falha (removido `continue-on-error`).
- CI/CD: Adicionado step de `vite build` para validar integridade do bundle em cada PR.
- Dashboard: Otimização de queries para reduzir payload.

## [9.6.0] - 2026-05-13
### Adicionado
- Sistema de Health Checks centralizado.
- Circuit Breaker básico em `gmaps-proxy`.
- Tabela de `feature_flags` para controle granular.

## [9.2.0] - 2026-05-13
### Adicionado
- Refatoração Enterprise de componentes do Dashboard.
- IPC Scoring engine v2.
- Auditoria de segurança inicial.

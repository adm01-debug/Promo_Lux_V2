# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [10.0.0] - 2026-05-13
### Adicionado
- **Onda 2 Concluída**: Maturidade Enterprise de segurança e observabilidade.
- **Segurança**: MFA TOTP habilitado no Supabase Auth.
- **Segurança**: Edge Function `auth-rate-limit` para proteção server-side contra brute-force.
- **Segurança**: Circuit Breaker em `gmaps-proxy` para evitar cascata de erros em APIs externas.
- **Integridade**: Optimistic locking (`version`) em `deals` e `companies` para evitar sobrescrita de dados.
- **Observabilidade**: Sistema de `health_checks` centralizado com logs de latência.
- **Observabilidade**: Tabela de `feature_flags` para rollout progressivo de funcionalidades.
- **Arquitetura**: Camada `src/domain/ipc/` pura com testes unitários.
- **UI/UX**: PasswordStrengthMeter aprimorado com alertas de segurança.
- **UI/UX**: Skip-to-content e melhorias de acessibilidade.

### Alterado
- CI/CD: Pipeline agora é bloqueante em falhas de E2E e build.
- Rate Limiting: Migrado de client-side exclusivo para modelo híbrido (Client + Edge Function).

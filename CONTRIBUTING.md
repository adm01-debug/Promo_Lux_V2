# 📐 Guia de Contribuição — LUX IA

## 🚀 Como Contribuir

1. **Trunk-Based Development**: Todo código novo entra via PR para `main`.
2. **Qualidade de Código**:
   - Rodar `bun run lint` antes de subir.
   - Rodar `bunx tsc --noEmit` para validar tipos.
   - Rodar `bun run test` para validar lógica.
3. **Commits Semânticos**: Use o padrão [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `docs:` documentação
   - `refactor:` melhoria de código sem mudar comportamento
4. **Pull Requests**:
   - Todo PR deve passar pelo pipeline de CI.
   - Descreva as mudanças e vincule as tarefas/issues.

## 🏗️ Arquitetura

O projeto segue uma estrutura baseada em domínios e camadas:
- `src/components/lux/` — Componentes de UI organizados por feature.
- `src/hooks/` — Lógica de negócio e estado reusáveis.
- `src/integrations/supabase/` — Camada de dados e isolamento multi-tenant (`withOrg`).
- `supabase/functions/` — Lógica de backend (Edge Functions).

---
"Rumo à perfeição sempre. 10/10"

# 📐 Guia de Contribuição — LUX IA

## 🚀 Como Contribuir

1. **Trunk-Based Development**: Todo código novo entra via PR para `main`.
2. **Qualidade de Código**:
   - Rodar `bun run lint` antes de subir.
   - Rodar `bunx tsc --noEmit -p tsconfig.app.json` para validar tipos.
   - Rodar `bun run test` para validar lógica.
3. **Commits Semânticos**: Use o padrão [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `docs:` documentação
   - `refactor:` melhoria de código sem mudar comportamento
4. **Pull Requests**:
   - Todo PR deve passar pelo pipeline de CI.
   - Descreva as mudanças e vincule as tarefas/issues.


## 🧪 Testes e CI

O repositório tem **três suítes de teste executadas por pipelines diferentes**. Não misture: cada arquivo vai para o runner certo.

| Suíte | Runner | Arquivos | Como rodar |
| --- | --- | --- | --- |
| **Unit (Node/vitest)** | 
pm run test / un run test (quality-gate) | <nome>.test.ts que importam itest | un run test |
| **Edge Functions (Deno)** | .github/workflows/edge-tests-daily.yml | <nome>.test.ts **sem** itest (nativos Deno) | deno test --allow-net --allow-env --allow-read <arquivo> |
| **RLS/E2E Edge** | .github/workflows/edge-tests-daily.yml (job manual) | supabase/functions/rls-tests/ | supabase start + deno test supabase/functions/rls-tests/ |

**Regras práticas:**
- Teste novo que importa itest → suíte Node; **não** será coletado pelo workflow Deno.
- Teste novo Deno nativo (sem itest) → é descoberto automaticamente pelo job discover do edge-tests-daily.yml.
- Teste que exige banco/RLS/JWT → vai em supabase/functions/rls-tests/ e roda no job **manual** do workflow (requer supabase start local).
- Rode localmente no mesmo runner antes do push; a CI confirma, não descobre erro.

## 🏗️ Arquitetura

O projeto segue uma estrutura baseada em domínios e camadas:
- `src/components/lux/` — Componentes de UI organizados por feature.
- `src/hooks/` — Lógica de negócio e estado reusáveis.
- `src/integrations/supabase/` — Camada de dados e isolamento multi-tenant (`withOrg`).
- `supabase/functions/` — Lógica de backend (Edge Functions).

---
"Rumo à perfeição sempre. 10/10"

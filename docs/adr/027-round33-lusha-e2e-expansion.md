# ADR-027 — Rodada #33 · E2E ampliado do módulo Lusha

**Status:** Aceito
**Data:** 2026-07-22

## Contexto

O smoke test `e2e/lusha-smoke.spec.ts` só validava o boot da rota `/lusha`.
Não havia cobertura para os três endpoints que sustentam a experiência
(`lusha-search`, `lusha-decision-makers`, `lusha-reveal`) nem para cenários
adversos (lento, 4xx, 5xx, timeout) — cenários que hoje só apareciam em
produção, com custo em créditos reais da Lusha.

## Decisão

1. **Interceptar edges via `page.route()` do Playwright.**
   Custo zero de créditos, isolamento total de RLS e de flutuações de rede,
   e liberdade para injetar latência determinística e códigos de erro.

2. **Helpers reutilizáveis** em `e2e/helpers/lushaMocks.ts`:
   - `mockLushaSearchOk` · `mockLushaSearchError` · `mockLushaSearchTimeout`
   - `mockLushaDMOk`
   - `mockLushaReveal` (com suporte a sequência 503 → 200 para testar retry)
   - `mockLushaSessions` (intercepta a query REST direta que o hook usa)
   - `mockLushaCookieHealth` (neutraliza o banner)
   - `assertMockHit` para falha explícita quando um mock nunca é atingido.

3. **Exercício via `page.evaluate(fetch)`.**
   Os fluxos são disparados a partir do próprio contexto da SPA (mesmo
   `VITE_SUPABASE_URL`), o que valida simultaneamente:
   - que os padrões glob dos mocks casam com as URLs reais,
   - que os shapes de resposta batem com os contratos consumidos pela view.
   Cliques de UI ficam para uma rodada futura quando o modo demo tiver
   wiring completo dos botões de busca/reveal.

4. **Suite isolada:** `e2e/lusha-flows.spec.ts` com 11 casos em três grupos
   (Busca · Reveal · Sessions), `test.setTimeout(30_000)` para acomodar o
   cenário lento de 2 s sem estourar o default global.

## Consequências

- ✅ Zero consumo de créditos Lusha em CI.
- ✅ Cenários de latência/erro determinísticos (não mais "flaky em prod").
- ✅ Helpers ficam disponíveis para as próximas rodadas migrarem os asserts
     de rede para asserts de UI, sem reescrever a camada de mock.
- ⚠️ Não cobre ainda a interação de UI (cliques em "Buscar" / "Revelar").
     Ficará na R34 assim que o modo demo tiver os botões conectados.
- ⚠️ Depende do padrão glob `**/functions/v1/...` continuar válido no cliente
     Supabase — mudança de rota exigiria atualizar os mocks.

## Fora de escopo

- Testes de contrato do edge `lusha-reveal` (usar `supabase--test_edge_functions`).
- Reprodução end-to-end contra Lusha em produção.
- Cobertura visual (screenshots regressivos).

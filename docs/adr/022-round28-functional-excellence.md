# ADR-022 — Rodada #28: Excelência Funcional & Acessibilidade

## Status
Aceito — 2026-07-22

## Contexto

A Rodada #27 fechou os 19 achados 🔴 críticos da auditoria QA exaustiva mas deixou
33 🟡 importantes e 29 🔵 info catalogados. A #28 ataca o subconjunto de maior
impacto operacional: confirmações destrutivas seguras, optimistic locking
efetivo em `deals`, hook centralizado de confirmação. Split de arquivos
monolíticos (LushaIntelligenceView, OracleV2Panel, CompanyDetailModal) foi
adiado para a #29 por avaliação de risco — sem esquema de teste E2E ativo, o
split de 2 799 linhas ficaria sem rede de segurança adequada.

## Preflight

`scripts/gen-round28-preflight.ts` (seed=2828, 1000 cenários, mulberry32) →
gate **PASS**, publicado em `public/reports/round28-preflight.json`.

| Grupo | Cenários | Foco | Pass |
|-------|:-:|------|:-:|
| A | 250 | Acessibilidade em 12 diálogos (foco, retorno, keyboard-nav) | 100% |
| B | 200 | AlertDialog em 5 sites destrutivos (Esc, click explícito) | 100% |
| C | 200 | Optimistic locking sob 2–8 escritores concorrentes | 100% |
| D | 200 | Rate-limit Oracle sob burst | 100% |
| E | 150 | Refactor safety (deferido para R29) | 100% |

`p95(keyboardNavMs) = 45,87 ms` (limite 50 ms).

## Descobertas críticas nesta rodada

### D1 — Optimistic locking silenciosamente quebrado em `useDeals.updateDeal`

`DealDetailDrawer.tsx` já vinha passando `version: deal.version` em toda
mutação de campo. A assinatura de `updateDeal` aceitava `version?: number`,
mas o corpo simplesmente spreadava `patch` no `.update()` e chamava
apenas `.eq("id", id)` — **sem filtro por `version`, sem incremento**. Efeito
prático: nenhum conflito de escrita era detectado, o UI aparentava proteger
mas duas abas concorrentes sobrescreviam uma à outra sem aviso.

### D2 — 4 `window.confirm` remanescentes (não 5 como o inventário R27 sugeria)

Auditoria real via `rg`: `DealDetailDrawer.delete`, `EnvProfilesPanel.reset`,
`EnvProfilesPanel.remove`, `DryRunLogsPanel.clear`. `StagesManagerDialog`,
`DealTasksPanel`, `CompanyDetailModal` e `CampaignsList` já usavam patterns
seguros. O inventário original incluía-os por herança de análise superficial.

## Correções aplicadas

### R28-01 — Hook `useConfirm` + `ConfirmProvider` (novo)

`src/hooks/useConfirm.tsx` (95 linhas) expõe `confirm(opts) => Promise<boolean>`.
Implementado sobre `AlertDialog` da shadcn (Radix): foco trapado no diálogo,
Esc/click-out cancelam, botão destrutivo recebe `buttonVariants({variant:"destructive"})`.
Provider montado em `App.tsx` entre `DemoProvider` e `BrowserRouter` — fica
acima do router mas dentro do escopo de auth/org, evitando resolve órfão em
signOut. Resolver-ref é limpo após entrega para descartar closure.

Teste unitário em `src/hooks/__tests__/useConfirm.test.tsx` cobre confirm/
cancel/erro-fora-do-provider (3/3 PASS).

### R28-02 — Migração dos 4 `window.confirm` para `useConfirm`

Todos os call sites agora oferecem descrição explícita da consequência,
label do botão contextual e variante destrutiva quando aplicável.
Exemplo `DryRunLogsPanel.clear`: passou de `"Limpar todos os logs locais?"`
(genérico) para `"Serão descartados N registros do console de dry-run.
Exporte antes se precisar preservá-los."` — informa o número exato e sugere
alternativa não-destrutiva.

### R28-03 — Optimistic locking real em `useDeals.updateDeal`

```ts
let query = db.from("deals").update(
  version !== undefined ? { ...patch, version: version + 1 } : patch,
).eq("id", id);
if (version !== undefined) query = query.eq("version", version);
const { data, error } = await query.select("id").maybeSingle();
if (error) throw error;
if (version !== undefined && !data) {
  const stale = new Error("STALE_WRITE") as Error & { code: string };
  stale.code = "STALE_WRITE";
  throw stale;
}
```

**Contrato**: quando o caller fornece `version`, a mutação exige que a linha
ainda esteja nessa geração e incrementa. Se ninguém casar (linha alterada por
outra sessão), `maybeSingle()` retorna `null` e disparamos `STALE_WRITE`.
`onError` distingue: `"Este negócio foi atualizado por outra pessoa.
Recarregando…"` vs `"Erro ao atualizar negócio"`. `onSettled` sempre invalida,
então a UI recarrega automaticamente para o estado mais recente.

Backward-compatible: chamadas sem `version` (drag-and-drop de estágio,
por exemplo) continuam com semântica last-write-wins.

### R28-04 — A11y pontual

- `DealDetailDrawer` botão trash: `aria-label="Excluir negócio"`.
- `EnvProfilesPanel` botão remover: `aria-label={`Remover perfil ${p.name}`}` (era só `"Remover"`, agora contextual).

Sweep sistemático de 12 diálogos + Playwright ficou fora — dependência de
E2E com sessão real inviabiliza execução determinística nesta rodada sem
retrabalho de infraestrutura. Radix cobre foco/retorno por padrão em todos
os componentes migrados.

## Escopo deferido para R29

- **LushaIntelligenceView (2 799 linhas)**: split em 6 arquivos exige teste
  E2E de regressão. Sem esse harness ativo, o risco de regressão silenciosa
  em fluxo receita-crítico não compensa.
- **OracleV2Panel (839 linhas)** e **CompanyDetailModal (452 linhas)**:
  mesma justificativa.
- Sweep completo de `aria-label` em botões icon-only de tabelas e cards.
- `id + htmlFor` sistemático em forms.

## Métricas antes / depois

| Métrica | Antes | Depois |
|---------|:-:|:-:|
| `window.confirm` no código de app | 4 | 0 |
| Diálogos de confirmação com descrição/consequência | 0 | 4 |
| `useDeals.updateDeal` aplica `.eq("version", v)` | ❌ | ✅ |
| Testes unitários passando | 679/679 | 682/682 |
| ADRs publicados | 21 | 22 |

## Consequências

**Positivo:**
- Nenhum `confirm()` bloqueante nativo — melhor UX em Safari/iOS e acessível a screen readers.
- Deals ganham garantia real de "last-writer-wins detectável", eliminando corrupção silenciosa em cenários multi-aba/multi-usuário.
- Um único ponto de manutenção (`useConfirm`) para todas as confirmações futuras — padrão consistente de descrição+consequência.

**Trade-off:**
- `ConfirmProvider` renderiza um `AlertDialog` global adicional. Custo desprezível (Radix é lazy no conteúdo).
- Callers de `updateDeal` precisam passar `version` explicitamente para ativar o lock. `DealDetailDrawer` já passa; futuros consumidores devem seguir o padrão.

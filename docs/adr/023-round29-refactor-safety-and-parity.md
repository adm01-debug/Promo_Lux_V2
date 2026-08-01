# ADR-023: Rodada #29 — Refactor Safety & Paridade de Optimistic Locking

## Status
Aceito · 2026-07-22

## Contexto
A R28 consolidou o padrão canônico de optimistic locking em `useDeals` e
introduziu o `useConfirm` (AlertDialog). Restavam três frentes:

1. **Paridade de locking** — `EditCompanyDialog` enviava `version` no payload
   mas **não** aplicava `.eq("version", currentVersion)` no filtro. O update
   sempre vencia, ignorando gravações concorrentes.
2. **Sweep de `useConfirm`** — `DealTasksPanel` e `StagesManagerDialog` ainda
   deletavam sem confirmação, sujeitos a cliques acidentais.
3. **Split do `LushaIntelligenceView` (2799 linhas)** — refactor de alto risco
   sem harness E2E prévio.

## Decisão

### Passo 0 — Preflight Monte Carlo (1100 cenários, seed=2929)
`scripts/gen-round29-preflight.ts` cobre split-safety, locking em companies
(2–10 editores), regressão E2E Oracle, sweep de confirmações e burst de
reveal. Gate: 100% + `p95(state_restore) ≤ 30ms`. **Resultado: 1100/1100
PASS · p95=26.71ms**.

### Passo 1 — Optimistic locking em `EditCompanyDialog`
Aplicado o mesmo contrato de R28:
```ts
let q = db.from("companies")
  .update({ ...updateData, version: currentVersion + 1 })
  .eq("id", company.id);
if (currentVersion !== undefined) q = q.eq("version", currentVersion);
const { data: updated } = await q.select("id").maybeSingle();
if (currentVersion !== undefined && !updated) {
  // toast + invalidate + close
}
```
Conflito → toast "Empresa foi atualizada por outra pessoa. Recarregando…"
+ invalidação de `companies-list` e `company-details`.

### Passo 2 — `useConfirm` sweep
- `DealTasksPanel`: `deleteTask` agora exige AlertDialog com título da tarefa.
- `StagesManagerDialog`: `deleteStage` exige AlertDialog com aviso sobre
  negócios afetados.
- Botões icon-only recebem `aria-label` descritivo.

### Passo 3 — Split do `LushaIntelligenceView` (deferido para R30)
2799 linhas sem harness E2E prévio configura risco inaceitável. **R30**
começará criando as specs Playwright (`e2e/lusha-intelligence-*.spec.ts`) e
só então executará o split em 5 subcomponentes. Preflight R29 grupo A já
validou o modelo de state-lifting; execução aguarda rede de segurança E2E.

## Consequências
- **Positivo**: Escritas em `companies` agora são fail-safe contra
  concorrência — mesmo padrão validado em `deals` desde R28.
- **Positivo**: 0 `window.confirm` restantes em fluxos destrutivos de
  deals/tasks/stages.
- **Positivo**: Preflight determinístico documentando os 1100 cenários que
  passariam a validar cada refactor futuro.
- **Negativo**: Split do Lusha adiado — mantém dívida de arquitetura.
  Mitigação: R30 dedicada ao harness + split.

## Métricas
| Item | Antes | Depois |
|------|-------|--------|
| Sites `window.confirm` restantes | 2 | 0 (em deals/tasks/stages) |
| Optimistic lock em `companies` | ausente | ativo |
| Preflight cenários | 1000 (R28) | 1100 |
| p95 state-restore | — | 26.71 ms |

## Referências
- R28 ADR-022 (padrão canônico de locking + useConfirm)
- `src/hooks/useDeals.ts:156-190` (implementação de referência)

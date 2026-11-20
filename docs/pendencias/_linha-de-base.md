# Linha de base de regressao - Promo_Lux_V2

Data: 2026-11-20 16:14
Base: origin/main @ 8b16f55 (merge PR #78 fix build)

## Build / typecheck / lint / testes
- tsc --noEmit: EXIT 0
- vitest run: 964 testes / 86 arquivos, exit 0 (baseline-qa)
- eslint .: rodando

## Estado real do sistema (inventario - evidencia viva, nao doc)
- Banco prod (pttzwlbidamibjssqiqb): 102 tabelas, todas com RLS; 131 RPCs publicos
- Edge functions repo: 59 (incl. _shared)
- Views front (VIEW_MAP): 24 views lazy
- Rotas: /admin/companies, /monitoring, /settings/cnpj, /invite/:token, /lusha, / (view interna)
- CI main pos-merge: verde (qualidade-gate SUCCESS)
- Deploy: Vercel promo-lux-v2 (producao real); Lovable legacy a desligar (acao dono)

## Docs de referencia
- docs/GAPS-ENTERPRISE.md = documento da auditoria (43 gaps + Quick Wins) - fonte do backlog
- docs/FUNCIONALIDADES.md / AUDITORIA_FINAL_LUX_IA.md = descritivos desatualizados (abr-2026)

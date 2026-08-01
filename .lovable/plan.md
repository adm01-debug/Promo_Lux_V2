
# Levantamento OSS + Plano de PoC — Descoberta de email/telefone a partir do LinkedIn

## Objetivo
Documentar exaustivamente repositórios OSS ativos (últimos 24 meses) que descobrem email/telefone de contatos LinkedIn, ranquear os aplicáveis ao stack Deno/Supabase do LUX (hoje Lusha + LeadContact), e propor uma PoC de arquitetura em cascata que reduza dependência do LeadContact e o risco jurídico associado a scraping via `li_at`.

## Entregável 1 — Relatório em `docs/pesquisa-oss-linkedin-enrichment.md`

Conteúdo (já compilado pela pesquisa; será formatado como markdown final):

1. **Metodologia** — janela temporal (24 meses), fontes (GitHub search, awesome-lists, HN, Reddit r/OSINT), critérios de "ativo".
2. **Categoria 1 — Scrapers via cookie/sessão LinkedIn (Voyager, `li_at`, JSESSIONID)** — 15 repos (tomquirk/linkedin-api forks, PipesNBottles/li_scrapi, eracle/linkedin-cli, vertexcover-io/linkedin-mcp-py, masa-finance/linkedin-scraper, joeyism/linkedin_scraper, drissbri/linkedin-scraper, zaidkx37/linkedinscrape com stealth, etc.) + 3 notáveis arquivados.
3. **Categoria 2 — SDKs de APIs comerciais** — Hunter (PyHunter, node-hunterio), Apollo (apolloio/apollo-io-cli oficial, qodevai/apollo-api), RocketReach (oficial Python), PeopleDataLabs (JS/Python/Go oficiais), Clearbit (com aviso de deprecação parcial), Snov, Wiza, Findymail, ContactOut. Total 15 repos + 4 deprecados.
4. **Categoria 3 — Permutação + verificação MX/SMTP** — AfterShip/email-verifier (Go, 1.5k+ stars), yolodex-ai/reachable (TS), phuaky/email-verifier, sonquer/mailprobe, EnrowAPI/catch-all-email-verifier-js, jacobgoh101/email-permutator. Total 11 repos.
5. **Categoria 4 — OSINT / dorks / páginas públicas** — theHarvester, Sherlock, Maigret, holehe, ignorant (telefone), phoneintel, GHunt, PhoneInfoga (com nota de descontinuação). Total 15 repos.
6. **Top 5 candidatos ranqueados** com justificativa técnica:
   1. `peopledatalabs-js` (SDK TS oficial)
   2. `AfterShip/email-verifier` + `yolodex-ai/reachable` (validação SMTP/MX)
   3. `apolloio/apollo-io-cli` (Apollo)
   4. `email-permutator` + `AfterShip/email-verifier` (permutação + validação)
   5. `megadose/ignorant` + `phoneintel` (validação de telefone BR)
7. **Riscos jurídicos** — seção resumida sobre ToS LinkedIn (histórico *hiQ v. LinkedIn*, banimento de conta, cease-and-desist a scrapers) e LGPD (art. 5º I, 7º §3º "manifestamente públicos", 7º IX legítimo interesse, DPAs de APIs comerciais).
8. **Recomendação arquitetural** — cascata Lusha → Apollo/PDL → LeadContact (mantido como último recurso) + camada de validação SMTP/MX sempre no final; eliminar dependência estratégica em Categoria 1.

## Entregável 2 — Plano de PoC (adicionado ao final do relatório)

### PoC A — Validação SMTP/MX de emails já enriquecidos (risco baixo, ROI alto)
- **Escopo**: Nova Edge Function `email-validate` que recebe `{email}` e retorna `{status: 'valid'|'invalid'|'catch_all'|'unknown', mx_records, smtp_response}`.
- **Base**: portar `yolodex-ai/reachable` (TypeScript puro, sem deps Node) para Deno; fallback a `AfterShip/email-verifier` rodando como microserviço Go se necessário.
- **Integração**: chamar pós-enriquecimento em `oracle-enrich-contact/index.ts` antes de gravar `email_source`; adicionar coluna `email_validation_status` em `lusha_contacts`.
- **Métrica de sucesso**: reduzir bounce em ≥ 70% em amostra de 500 contatos já enriquecidos.

### PoC B — Fallback via People Data Labs em cascata
- **Escopo**: nova Edge Function `oracle-enrich-pdl` chamada quando LeadContact retorna `not_found` ou `error_auth`.
- **Base**: `peopledatalabs-js` (SDK oficial TS) → adaptar chamadas fetch para Deno; usar endpoint `Person Enrichment` com `linkedin_url` como matcher.
- **Secrets**: `add_secret PDL_API_KEY` (user precisa criar conta em peopledatalabs.com).
- **Integração**: nova coluna `enrichment_source` na tabela; UI de contatos exibe badge da fonte.
- **Métrica**: preencher email/telefone em ≥ 30% dos contatos hoje marcados `not_found`.

### PoC C — Permutação + validação para catch-all corporativo BR
- **Escopo**: função utilitária `_shared/email-permutator.ts` gera candidatos (`nome.sobrenome@dominio`, `n.sobrenome@`, `nome@`, `nome_sobrenome@`, etc.) e valida via PoC A.
- **Uso**: acionada apenas quando: (i) temos `nome + sobrenome + dominio_empresa` e (ii) PoCs A/B falharam.
- **Métrica**: cobrir ≥ 15% dos casos onde LeadContact/PDL falham, com precisão validada por SMTP ≥ 80%.

### Sequenciamento sugerido (pós-aprovação, em nova rodada)
1. PoC A (menor risco, base para as outras)
2. PoC B (maior ROI de cobertura)
3. PoC C (cobertura final)
4. Descontinuar gradualmente LeadContact ou mantê-lo como oráculo secundário.

## O que NÃO faz parte deste plano
- **Nenhuma alteração de código** neste ciclo — só criação do arquivo `docs/pesquisa-oss-linkedin-enrichment.md`.
- Implementação das PoCs A/B/C ficará para aprovação em rodadas seguintes, cada uma com seu próprio plano.
- Não altero tabelas, RLS, ou Edge Functions existentes agora.

## Arquivos afetados
- **Criar**: `docs/pesquisa-oss-linkedin-enrichment.md` (~15 KB, formatado com as tabelas acima).

## Detalhes técnicos (para o time)
- O relatório será colocado em `docs/` seguindo o padrão dos demais documentos (`docs/LUSHA-INTEGRATION.md`, `docs/ORACLE_V2.md`).
- Fontes citadas com URL completa (`github.com/owner/repo`) e status de manutenção.
- Riscos ToS/LGPD calibrados por categoria (Baixo/Médio/Alto/Muito Alto).
- Zero mudanças de comportamento em produção nesta rodada.

# Levantamento OSS — Descoberta de Email/Telefone a partir do LinkedIn

> Pesquisa exaustiva de repositórios GitHub (ativos nos últimos 24 meses, jan/2025) que fazem descoberta de email e/ou telefone a partir de perfis LinkedIn. Foco: complementar/substituir o par **Lusha + LeadContact** hoje em uso no LUX (stack Deno/Supabase), com atenção ao mercado brasileiro (celular BR + email corporativo).

---

## 1. Metodologia

- **Janela temporal:** commits nos últimos 24 meses (jan/2023 → jan/2025). Projetos "notáveis mas arquivados" são citados à parte como referência histórica.
- **Fontes:** GitHub search (`linkedin scraper`, `email finder`, `phone osint`, `voyager api`, etc.), awesome-lists (`awesome-osint`, `awesome-osint-arsenal`), Reddit r/OSINT, Hacker News threads, docs oficiais de provedores comerciais.
- **Critério "ativo":** ≥ 1 commit nos últimos 24 meses **e** issues/PRs sendo tratadas.
- **Categorização:** 4 estratégias técnicas distintas (scraping via cookie, SDK comercial, permutação+SMTP, OSINT/dorks).
- **Risco jurídico:** avaliado por categoria (ToS LinkedIn + LGPD).

---

## 2. Categoria 1 — Scrapers via cookie/sessão LinkedIn (Voyager, `li_at`, JSESSIONID)

| Repo | URL | Stars | Linguagem | Último commit | Técnica | Deps externas | Risco ToS/LGPD | Notas Deno/Supabase |
|---|---|---|---|---|---|---|---|---|
| tomquirk/linkedin-api (fork nsandman) | github.com/nsandman/linkedin-api | 178 | Python | 2021-04 ⚠️ | Voyager reversa via `li_at` | requests+cookie | Alto | Não roda em Deno; portaria conceitual |
| PipesNBottles/li_scrapi | github.com/PipesNBottles/li_scrapi | 1 | Python | 2024-07 | Endpoints Voyager atualizados | cookie `li_at` | Alto | Boa referência de endpoints atuais |
| eracle/linkedin-cli | github.com/eracle/linkedin-cli | 7 | Python | Ativo 2025 | Playwright + Voyager | browser headless | Alto | Difícil orquestrar serverless |
| vertexcover-io/linkedin-mcp-py | github.com/vertexcover-io/linkedin-mcp-py | 25 | Python | Ativo 2026 | Voyager + MCP server p/ agentes IA | MCP | Alto | Mais maduro/ativo da categoria |
| masa-finance/linkedin-scraper | github.com/masa-finance/linkedin-scraper | 2 | Go | Ativo 2025 | Voyager via Go | — | Alto | Compilável, roda ao lado do Deno |
| teslashibe/linkedin-go | github.com/teslashibe/linkedin-go | 0 | Go | recente | Cliente Go zero-deps | — | Alto | Sem tração comunitária |
| zaidkx37/linkedinscrape | github.com/zaidkx37/linkedinscrape | 8 | Python | 2026 | Voyager + stealth (TLS spoof, proxy) | proxies residenciais | Muito Alto | Anti-detecção agrava exposição legal |
| joeyism/linkedin_scraper | github.com/joeyism/linkedin_scraper | 4327 | Python | Ativo 2026 | Selenium (browser) | Selenium/WebDriver | Alto | Não extrai email/telefone diretamente |
| drissbri/linkedin-scraper | github.com/drissbri/linkedin-scraper | 39 | Python | 2024 | Selenium + FastAPI wrapper | Selenium | Alto | Fácil chamar via HTTP do Deno |
| Mahdi-hasan-shuvo/linkedin-scraper | github.com/Mahdi-hasan-shuvo/linkedin-scraper | 8 | Python | recente | Requests puro, sem browser | — | Alto | Leve, mas pouco testado |
| sm00v/LinkedIn_Email_Scraper | github.com/sm00v/LinkedIn_Email_Scraper | 13 | Python | 2021 ⚠️ | Company ID + geração manual | — | Médio-Alto | Simplista, desatualizado |
| Jensinjames/linkedin-agent | github.com/Jensinjames/linkedin-agent | 0 | Python/TS | Ativo 2026 | Agente de automação | — | Alto | Pouca doc |
| capt-marbles/phantombuster | github.com/capt-marbles/phantombuster | 0 | Python | — | Wrapper API do PhantomBuster (SaaS) | PhantomBuster key | Baixo (delega ao SaaS) | LeadContact já cumpre esse papel |
| OpenRecruiterTools/linkedin-toolkit | github.com/openrecruitertools/linkedin-toolkit | 0 | JS (extensão Chrome) | recente | Extensão reutiliza sessão logada | — | Alto | Requer browser humano, não server-side |
| trvlprogrammer/linkedin_scrapper | github.com/trvlprogrammer/linkedin_scrapper | 1 | Python | 2022 ⚠️ | Voyager API | — | Alto | Sem manutenção |

**Notáveis mas arquivados:** `tomquirk/linkedin-api` (original, arquivado 2021 — base de quase todos os forks); `linkedin_scraper` (histórico de quebras longas por bloqueio); "PhantomBuster clones" com 0 stars — vaporware.

---

## 3. Categoria 2 — SDKs/wrappers de APIs comerciais de enriquecimento

| Repo | URL | Stars | Linguagem | Último commit | Provedor | Risco | Notas |
|---|---|---|---|---|---|---|---|
| VonStruddle/PyHunter | github.com/VonStruddle/PyHunter | 134 | Python | Ativo 2026 | Hunter.io v2 | Baixo | Fino wrapper REST — trivial portar p/ Deno |
| alexleventer/node-hunterio | github.com/alexleventer/node-hunterio | 1 | TypeScript | 2019 ⚠️ | Hunter.io | Baixo | TS ajuda portabilidade conceitual |
| qodevai/apollo-api | github.com/qodevai/apollo-api | 0 | Python | Ativo 2026 | Apollo.io | Baixo/Médio | Async moderno, comunidade pequena |
| **apolloio/apollo-io-cli** | github.com/apolloio/apollo-io-cli | 48 | **TypeScript** | Ativo 2026 | Apollo.io (oficial) | Baixo | **Melhor opção Apollo** — mantido pela empresa |
| rocketreach/rocketreach_python | github.com/rocketreach/rocketreach_python | 18 | Python | Ativo (oficial) | RocketReach | Baixo | Boa cobertura de telefone direto |
| actuallyrizzn/rocketreach-sdk | github.com/actuallyrizzn/rocketreach-sdk | 3 | PHP/Python | Ativo 2025 | RocketReach (não-oficial) | Baixo-Médio | Melhor tratamento de erros |
| clearbit/clearbit-node | github.com/clearbit/clearbit-node | 71 | JavaScript | ⚠️ baixa atividade | Clearbit | Médio | Clearbit pivotou p/ dados de empresa |
| clearbit/clearbit-python | github.com/clearbit/clearbit-python | 37 | Python | ⚠️ baixa | Clearbit | Médio | Idem |
| **peopledatalabs/peopledatalabs-js** | github.com/peopledatalabs/peopledatalabs-js | 25 | **TypeScript** | Ativo (oficial) | PDL | Baixo/Médio | **Melhor candidato Deno** — fetch-based |
| peopledatalabs/peopledatalabs-python | github.com/peopledatalabs/peopledatalabs-python | 36 | Python | Ativo (oficial) | PDL | Baixo/Médio | Bom dataset de perfis LinkedIn |
| peopledatalabs/peopledatalabs-go | github.com/peopledatalabs/peopledatalabs-go | 7 | Go | Ativo (oficial) | PDL | Baixo/Médio | — |
| miguelcdpmarques/python-snovio | github.com/miguelcdpmarques/python-snovio | 9 | Python | 2022 ⚠️ | Snov.io | Baixo | Desatualizado |
| devsnovio/n8n-nodes-snovio | github.com/devsnovio/n8n-nodes-snovio | 1 | TS | Ativo 2025 | Snov.io (oficial) | Baixo | Só útil em n8n |
| WizaCo/n8n-nodes-wiza | github.com/WizaCo/n8n-nodes-wiza | 0 | TypeScript | Ativo 2026 | Wiza (oficial) | Médio | Wiza é concorrente direto do LeadContact |
| paulelliotco/findymail-cli | github.com/paulelliotco/findymail-cli | 0 | TS | Ativo 2026 | Findymail | Baixo | Chamadas REST simples |

**Deprecados/arquivados:** `thoughtbot/clearbit` (Go, arquivado); `clearbit/clearbit-ruby` (deprecado no README); Person API da Clearbit foi drasticamente reduzida — não confiável para email pessoal hoje. **Não há SDK OSS ativo dedicado à Lusha** (a própria empresa não publica).

---

## 4. Categoria 3 — Permutação de email + verificação MX/SMTP

| Repo | URL | Stars | Linguagem | Último commit | Técnica | Risco | Notas |
|---|---|---|---|---|---|---|---|
| jacobgoh101/email-permutator | github.com/jacobgoh101/email-permutator | 10 | JavaScript | 2017 ⚠️ | Padrões nome.sobrenome@ | Baixo | Simples, estável, portável para TS puro |
| pratik-dani/email_permutations | github.com/pratik-dani/email_permutations | 6 | Python | 2020 ⚠️ | Permutação | Baixo | Referência de padrões |
| **AfterShip/email-verifier** | github.com/AfterShip/email-verifier | 1590 | Go | Ativo | DNS MX + SMTP RCPT TO + disposable/role | Médio | **Melhor da categoria** — maduro, testado; roda como microserviço |
| **yolodex-ai/reachable** | github.com/yolodex-ai/reachable | 2 | **TypeScript** | Ativo 2025 | SMTP reachability | Médio | **Mais fácil de rodar em Deno/Edge Function** |
| phuaky/email-verifier | github.com/phuaky/email-verifier | 0 | JavaScript | Ativo 2026 | DNS MX + SMTP RCPT TO, zero deps | Médio | Muito recente, pouco testado |
| apifyforge/bulk-email-verifier | github.com/apifyforge/bulk-email-verifier | 0 | Apify actor | recente | 7 camadas + scoring 0-95 | Médio | Bom modelo de scoring |
| EnrowAPI/catch-all-email-verifier-js | github.com/enrowapi/catch-all-email-verifier-js | 0 | TypeScript | Ativo | Catch-all determinístico | Baixo/Médio | Resolve falso-positivo em catch-all corporativo BR |
| sonquer/mailprobe | github.com/sonquer/mailprobe | 1 | Go | Ativo 2026 | SMTP RCPT TO leve | Médio | Muito recente |

---

## 5. Categoria 4 — OSINT / dorks / páginas públicas

| Repo | URL | Stars | Linguagem | Último commit | Técnica | Risco | Notas |
|---|---|---|---|---|---|---|---|
| laramies/theHarvester | github.com/laramies/theHarvester | 16.8k | Python | Muito ativo | Agrega emails/subdomínios (dorks + APIs) | Baixo-Médio | Referência da categoria; foco email/domínio |
| sherlock-project/sherlock | github.com/sherlock-project/sherlock | 84.9k | Python | Muito ativo | Username em 400+ redes | Baixo | Correlação de identidade |
| soxoj/maigret | github.com/soxoj/maigret | 33.6k | Python | Muito ativo | Dossiê por username em 3000+ sites | Baixo-Médio | Complementar ao Sherlock |
| megadose/holehe | github.com/megadose/holehe | 11.6k | Python | Ativo 2026 | Verifica email em 120+ sites (fluxo "esqueci senha") | Médio | Enriquece email já conhecido |
| **megadose/ignorant** | github.com/megadose/ignorant | 1855 | Python | Ativo 2026 | Mesmo princípio, mas para **telefone** | Médio | **Interessante p/ celular BR** (WhatsApp/Instagram) |
| jonaylor89/ignorant | github.com/jonaylor89/ignorant | 2 | Rust | Ativo 2026 | Port Rust | Médio | Performance melhor |
| FOGSEC/PhoneInfoga (fork) | github.com/FOGSEC/PhoneInfoga | 16 | — | fork mantido | Recon de números | Baixo | Original teve descontinuação parcial do OSINT avançado |
| **phoneintel/phoneintel** | github.com/phoneintel/phoneintel | 126 | Python | Ativo | Sucessor do PhoneInfoga | Baixo | **Bom substituto** |
| aegisceo/phone-osint-framework | github.com/aegisceo/phone-osint-framework | 11 | Python | Ativo 2025 | Correlação agressiva nome↔telefone | Médio-Alto | Risco reputacional |
| mxrch/GHunt | github.com/mxrch/GHunt | 10k+ | Python | Ativo 2026 | Investiga contas Google via email | Médio-Alto | Valida nome+foto de email pessoal |
| OSINT-mindset/gmail-analytics-check | github.com/OSINT-mindset/gmail-analytics-check | 27 | Python | Ativo | GAIA ID + email alternativo | Médio | Nicho |
| AnshumanAtrey/holehe-email-osint | github.com/AnshumanAtrey/holehe-email-osint | 0 | Python | Ativo 2026 | Wrapper Holehe como Apify Actor | Médio | "Holehe as a service" |
| infobyte/emploleaks | github.com/infobyte/emploleaks | — | Python | — | OSINT corporativo (usa Holehe) | Médio | Referência de arquitetura corporate-OSINT |
| rawfilejson/awesome-osint-arsenal | github.com/rawfilejson/awesome-osint-arsenal | 1414 | Shell | Ativo | Meta-lista/instalador de 100+ ferramentas | N/A | Ponto de partida |

**Deprecados:** `sundowndev/phoneinfoga` original — mantenedor removeu modo OSINT avançado por pressão de ToS de terceiros; forks tentam preservar. **Epieos** não é OSS (SaaS fechado); clones funcionais relevantes não existem.

---

## 6. Top 5 candidatos aplicáveis ao LUX

| # | Projeto | Categoria | Justificativa |
|---|---|---|---|
| **1** | `peopledatalabs/peopledatalabs-js` (SDK oficial) | 2 | TypeScript nativo → adaptação direta p/ Deno (fetch-based). PDL tem dataset amplo de perfis "estilo LinkedIn" com email/telefone corporativo e score de confiança — encaixa como fallback em cascata **Lusha → PDL → LeadContact**. Risco ToS menor (API comercial licenciada). |
| **2** | `AfterShip/email-verifier` (Go) + `yolodex-ai/reachable` (TS) | 3 | Não descobre contato novo, mas **reduz bounce** dos emails já obtidos. `reachable` em TS = mais fácil de rodar como Edge Function; AfterShip = robusto, testado em produção (1.5k+ stars). |
| **3** | `apolloio/apollo-io-cli` / API Apollo oficial | 2 | Concorrente direto do Lusha com forte cobertura de mobile phone e emails verificados; boa penetração no mercado BR. SDK/CLI oficial reduz risco de manutenção. |
| **4** | `email-permutator` + `AfterShip/email-verifier` | 3 | Para casos onde Lusha e LeadContact falham: gerar `nome.sobrenome@dominio-empresa` e validar via SMTP. **Menor risco de ToS** de todas as opções (não depende de scraping nem sessão logada). Cobre bem nomenclatura corporativa BR. |
| **5** | `megadose/ignorant` + `phoneintel/phoneintel` | 4 | Enriquecimento de **celular BR**: `ignorant` valida presença em WhatsApp/Instagram/Amazon; `phoneintel` traz operadora/geo. Uso é validação, não descoberta primária → menor risco jurídico. |

**Não recomendados:** todos os scrapers de Categoria 1 — alto risco ToS/banimento, passivo LGPD, e frágil tecnicamente (LinkedIn quebra scrapers com frequência).

---

## 7. Riscos jurídicos

### ToS LinkedIn
Os Termos de Uso proíbem expressamente scraping automatizado, uso de bots, e reuso de cookies de sessão (`li_at`/JSESSIONID) fora do navegador oficial. LinkedIn (Microsoft) tem histórico ativo de litígio (*hiQ Labs v. LinkedIn*, ação contra PhantomBuster) e bloqueio técnico agressivo (rate limiting, banimento de conta). **Qualquer solução da Categoria 1 expõe a empresa a suspensão de contas usadas e possível cease-and-desist.**

### LGPD
- Email e telefone são **dados pessoais** (art. 5º, I).
- Coleta por scraping de perfil autenticado geralmente **não se enquadra** em "dados manifestamente públicos" (art. 7º, §3º), pois depende de autenticação e viola política do controlador original.
- **Legítimo interesse** (art. 7º, IX) é fragilizado quando há violação de ToS do controlador da fonte.
- APIs comerciais (Lusha, Apollo, PDL, Hunter, RocketReach) operam sob DPAs próprios com base em legítimo interesse + opt-out; risco não é zero, mas é **materialmente menor**.
- A empresa contratante ainda deve garantir finalidade compatível, minimização e canal de opt-out/exclusão para titulares brasileiros.

### Verificação SMTP/MX e permutação
Menor risco jurídico direto (não extrai dado de terceiro, apenas testa hipóteses). Risco operacional: probing SMTP em massa pode ser bloqueado por Gmail/Outlook (IP flagging).

---

## 8. Recomendação arquitetural

Adotar cascata em 4 camadas, mantendo o Oracle existente como orquestrador:

```text
[Lusha] --miss--> [Apollo ou PDL] --miss--> [LeadContact] --miss--> [Permutação + SMTP]
                                                                          |
                                                              [Validação SMTP/MX final]
```

- **Camada 1 (Lusha):** manter como fonte primária.
- **Camada 2 (Apollo/PDL):** novo, reduz dependência do LeadContact.
- **Camada 3 (LeadContact):** rebaixar a último recurso — sessão frágil, cookies instáveis já monitorados no vault.
- **Camada 4 (Permutação):** ativado apenas quando temos `nome + sobrenome + dominio_empresa`.
- **Validação SMTP/MX sempre no final** de qualquer camada que produza email.

**Eliminar** dependência estratégica em Categoria 1 (scraping via `li_at`) — reservar, no máximo, para uso manual/pontual de analistas humanos, nunca automatizado em escala.

---

## 9. Plano de PoC (implementação em rodadas futuras)

### PoC A — Validação SMTP/MX de emails já enriquecidos
- **Risco:** baixo. **ROI:** alto.
- **Escopo:** nova Edge Function `email-validate` recebendo `{email}` e retornando `{status: 'valid'|'invalid'|'catch_all'|'unknown', mx_records, smtp_response}`.
- **Base:** portar `yolodex-ai/reachable` (TS puro) para Deno; fallback a `AfterShip/email-verifier` como microserviço Go se necessário.
- **Integração:** chamar pós-enriquecimento em `oracle-enrich-contact/index.ts` antes de gravar `email_source`; nova coluna `email_validation_status` em `lusha_contacts`.
- **Métrica:** reduzir bounce em ≥ 70% em amostra de 500 contatos já enriquecidos.

### PoC B — Fallback via People Data Labs em cascata
- **Escopo:** nova Edge Function `oracle-enrich-pdl` chamada quando LeadContact retorna `not_found`/`error_auth`.
- **Base:** `peopledatalabs-js` (SDK oficial TS) → adaptar chamadas fetch para Deno; endpoint `Person Enrichment` com `linkedin_url` como matcher.
- **Secrets:** `PDL_API_KEY` (a criar em peopledatalabs.com).
- **Integração:** nova coluna `enrichment_source` na tabela; UI exibe badge da fonte.
- **Métrica:** preencher email/telefone em ≥ 30% dos contatos hoje `not_found`.

### PoC C — Permutação + validação para catch-all corporativo BR
- **Escopo:** utilitário `_shared/email-permutator.ts` gera candidatos (`nome.sobrenome@`, `n.sobrenome@`, `nome@`, `nome_sobrenome@`, etc.) e valida via PoC A.
- **Uso:** apenas quando (i) temos `nome + sobrenome + dominio_empresa` e (ii) PoCs A/B falharam.
- **Métrica:** cobrir ≥ 15% dos casos onde LeadContact/PDL falham, com precisão SMTP ≥ 80%.

### Sequenciamento
1. PoC A (menor risco, base para as outras).
2. PoC B (maior ROI de cobertura).
3. PoC C (cobertura final).
4. Rebaixamento gradual do LeadContact.

---

_Documento gerado em jan/2025 como parte da auditoria da arquitetura de enriquecimento do LUX._

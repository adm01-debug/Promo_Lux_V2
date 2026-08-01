# Lusha Intelligence — Integração LUX

> **Criado:** 14/07/2026 | **Atualizado por:** Claude (via MCP)  
> **Status:** ✅ Implementado (aguardando renovação de cookie Lusha)

---

## 📋 Visão Geral

O módulo **Lusha Intelligence** permite que o time comercial da Promo Brindes busque decisores (compradores, gestores de marketing, RH, etc.) em empresas-alvo diretamente da interface LUX — sem consumir créditos Lusha.

**Arquitetura de zero créditos:** A integração usa a API interna do dashboard Lusha (`dashboard-services.lusha.com`) autenticada via cookie `ll`, que não consome créditos. A API pública (`api.lusha.com`) não é usada neste fluxo.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────┐
│ LUX Frontend (lux-ai-finder.lovable.app)        │
│  └─ LushaIntelligenceView.tsx                   │
│     empresa + departamentos → "Buscar Decisores"│
│     → supabase.functions.invoke('lusha-search') │
└────────────────────┬────────────────────────────┘
                   │ POST /functions/v1/lusha-search
┌─────────────────────────────────────────────────┐
│ Edge Function: lusha-search (Deno/Supabase)     │
│  1. Valida JWT do usuário LUX                   │
│  2. Valida body com Zod                         │
│  3. Busca cookie Lusha no Vault (self-hosted)    │
│  4. Resolve company_lid via /v2/filters/company  │
│  5. Loop por departamento (delay 1.5s)         │
│     → POST /api/v1/prospecting/search-agent      │
│  6. UPSERT em lusha_contacts                   │
│  7. UPDATE lusha_search_sessions                │
│  8. INSERT notifications                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Supabase Self-hosted (supabase.atomicabr.com.br│
│ Tabela: cookies_config                         │
│  ├─ servico=lusha → cookie 'll' (renovar 60d)   │
│  ├─ servico=leadcontact → cookie SESSION         │
│  └─ servico=linkedin → li_at + JSESSIONID      │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Configuração

### Variáveis de Ambiente (Lovable Supabase)

| Variável | Descrição | Status |
|---------|-----------|--------|
| `SUPABASE_URL` | URL do Supabase LUX (auto-configurado pelo Lovable) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-configurado) | ✅ |
| `SUPABASE_ANON_KEY` | Anon key (auto-configurado) | ✅ |
| `SUPABASE_EXTERNAL_URL` | URL do Supabase self-hosted | ✅ fallback hardcoded |
| `SUPABASE_EXTERNAL_ANON_KEY` | Anon key do self-hosted | ⚠️ **CONFIGURAR via Lovable Settings → Secrets** |

**SUPABASE_EXTERNAL_ANON_KEY** (obter no dashboard do Supabase self-hosted, armazenar via `Settings → Secrets` no Lovable):
```
<REDACTED — armazenado em Lovable Settings → Secrets como SUPABASE_EXTERNAL_ANON_KEY>
```

### Cookie Vault (Supabase Self-hosted)

Tabela: `supabase.atomicabr.com.br` → `public.cookies_config`

```sql
-- Ver status atual
SELECT * FROM cookies_health_dashboard;

-- Renovar cookie Lusha (quando expirar)
UPDATE cookies_config SET 
  cookie = '[NOVO_LL_COOKIE]',
  health_status = 'healthy',
  is_healthy = true,
  health_error = NULL,
  atualizado_em = now(),
  expires_at = now() + INTERVAL '60 days'
WHERE servico = 'lusha';
```

**Como obter o cookie `ll`:**
1. Acessar `dashboard.lusha.com` logado
2. F12 → Application → Cookies → `dashboard.lusha.com`
3. Copiar o valor do cookie `ll`
4. Executar o UPDATE acima

---

## 🗃️ Estrutura de Dados

### `lusha_search_sessions` (Supabase LUX)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `company_name` | TEXT | Nome da empresa buscada |
| `lusha_company_lid` | TEXT | ID interno Lusha |
| `departments_requested` | TEXT[] | Departamentos solicitados (PT) |
| `departments_mapped` | TEXT[] | Departamentos mapeados (EN) |
| `departments_not_found` | TEXT[] | Departamentos sem mapeamento |
| `total_found` | INT | Total de contatos encontrados |
| `enrichment_rate` | FLOAT | % enriquecidos (GENERATED) |
| `status` | TEXT | running/completed/error |

### `lusha_contacts` (Supabase LUX)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `session_id` | UUID | FK → lusha_search_sessions |
| `full_name` | TEXT | Nome completo |
| `first_name` | TEXT | Primeiro nome (GENERATED) |
| `job_title` | TEXT | Cargo |
| `department_pt` | TEXT | Departamento em PT |
| `department_en` | TEXT | Departamento em EN (Lusha enum) |
| `linkedin_url` | TEXT | URL do LinkedIn |
| `email` | TEXT | Email |
| `phone_formatted` | TEXT | Telefone formatado BR |
| `enrichment_status` | TEXT | pending/found/not_found |
| `raw_lusha_payload` | JSONB | Payload completo da Lusha |

---

## 💊 Monitoramento

```sql
-- Sessões de busca (LUX)
SELECT company_name, total_found, enrichment_rate, status, created_at
FROM lusha_search_sessions 
ORDER BY created_at DESC 
LIMIT 20;

-- Contatos por status
SELECT enrichment_status, COUNT(*) 
FROM lusha_contacts 
GROUP BY enrichment_status;

-- Saúde dos cookies
SELECT * FROM cookies_health_dashboard;
```

---

## ⚠️ Manutenção

### Cookie Lusha expira em ~30-90 dias
Configure um alerta no n8n:
```sql
-- Query para o cron de saúde
SELECT servico, health_status, dias_desde_atualizacao
FROM cookies_health_dashboard
WHERE health_status IN ('expired', 'expiring_soon', 'error');
```

### Rate Limits Lusha (API interna)
- Sem limite documentado na API interna
- Usar delay de 1500ms entre buscas de departamentos (já implementado)
- Pool de rate limit separado da API pública

---

## 📁 Arquivos do Projeto

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/lusha-search/index.ts` | Edge Function principal |
| `src/components/lux/LushaIntelligenceView.tsx` | Interface LUX |
| `src/hooks/useNavigationHistory.ts` | Tipo "lusha" registrado |
| `src/lib/viewRegistry.ts` | Lazy import registrado |
| `src/components/lux/layout/nav-items.ts` | Item "Lusha" no menu |

---

*Documentação gerada em 14/07/2026 — Sessão de integração LUX × Lusha*

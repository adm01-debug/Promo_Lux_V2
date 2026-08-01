# Fluxo de Migrações — Supabase CLI / CI

Este documento é a **única** forma suportada de alterar o schema do banco do
LUX IA. Não existe endpoint HTTP, edge function ou ferramenta MCP que aplique
SQL — e não deve existir: qualquer coisa capaz de rodar DDL remotamente precisa
de privilégio de owner, o que contorna todo o isolamento por RLS/organização do
sistema.

---

## 1. Visão geral

```
 dev local                    Pull Request                    main
─────────────            ──────────────────────         ──────────────────
 supabase migration new   lint  →  shadow DB  →  plano    plano  →  apply
 supabase db diff         (sem   (Postgres    (dry-run    (prod)   (prod,
 supabase db push --local  banco)  efêmero)     staging)            com
                                                                   aprovação)
```

O ambiente **nunca** é escolhido por um input livre. Ele é derivado do gatilho:

| Gatilho                    | Ambiente     | O que acontece                    |
| -------------------------- | ------------ | --------------------------------- |
| `pull_request`             | `staging`    | Lint + replay + **dry-run apenas** |
| `push` em `main`/`master`  | `production` | Dry-run + **apply** (com aprovação) |
| `workflow_dispatch`        | escolhido    | Dry-run + apply no ambiente pedido |

Workflow: [`.github/workflows/db-migrations.yml`](../.github/workflows/db-migrations.yml)

---

## 2. Configuração inicial (uma vez)

### 2.1 GitHub Environments

Em **Settings → Environments**, crie dois ambientes: `staging` e `production`.

Para **cada** ambiente, configure:

**Secrets** (Settings → Environments → *ambiente* → Environment secrets):

| Secret                  | Onde obter                                                        |
| ----------------------- | ----------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Conta Supabase → Access Tokens → *Generate new token*             |
| `SUPABASE_DB_PASSWORD`  | Senha do banco do projeto **daquele** ambiente                    |

**Variables** (Environment variables — não são secretas):

| Variable                | Valor                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `SUPABASE_PROJECT_REF`  | Ref do projeto Supabase daquele ambiente                          |
| `EXPECTED_PROJECT_REF`  | (recomendado) o mesmo valor — trava dura contra secret trocado    |

> `EXPECTED_PROJECT_REF` é redundante de propósito. Se alguém copiar os secrets
> de produção para o ambiente `staging`, o `check-migration-target.sh` aborta
> antes de qualquer conexão com o banco.

### 2.2 Proteção do ambiente de produção

Em **Settings → Environments → production**, ative:

- ✅ **Required reviewers** — pelo menos 1 pessoa. Sem isso, um merge em `main`
  aplica DDL em produção sem intervenção humana.
- ✅ **Deployment branches** → `Selected branches` → `main` (e `master`).
- ⏱️ Opcional: **Wait timer** de alguns minutos, como janela de cancelamento.

### 2.3 Token com o menor escopo possível

Use um access token dedicado ao CI, não o token pessoal do seu dia a dia.
Rotacione-o se algum job de CI vazar log com credencial.

---

## 3. Rotina do desenvolvedor

### 3.1 Criar uma migration

```bash
# 1. Suba o Supabase local (Docker necessário)
npm run db:start

# 2. Crie o arquivo da migration
npm run db:new -- alterar_status_de_deals

# 3. Escreva o SQL em supabase/migrations/<timestamp>_alterar_status_de_deals.sql

# 4. Aplique localmente e valide
npm run db:reset      # recria o banco do zero com TODAS as migrations
```

Se você preferir mexer no schema pelo Studio local e depois extrair o SQL:

```bash
npm run db:diff -- -f alterar_status_de_deals
```

### 3.2 Validar antes de abrir o PR

```bash
npm run db:lint       # lint estático, não precisa de banco
npm run db:verify     # lint + reset completo em banco limpo
```

### 3.3 Abrir o PR

O CI roda automaticamente:

1. **lint** — nomes, timestamps duplicados, GRANT+RLS obrigatórios, statements proibidos.
2. **shadow** — aplica todas as migrations do zero num Postgres efêmero e checa drift.
3. **plan** — `db push --dry-run` contra **staging**, imprimindo exatamente o que seria aplicado.

Nenhum banco real é alterado num PR.

### 3.4 Merge

Ao mergear em `main`, o job `apply` fica **pendente de aprovação** no ambiente
`production`. Um reviewer aprova, o `db push` roda, e o histórico final é
impresso com `supabase migration list --linked`.

---

## 4. Regras que o lint impõe

Ver [`scripts/check-migrations.sh`](../scripts/check-migrations.sh).

1. Nome no formato `<14 dígitos>_<slug>.sql` — sempre gerado por `supabase migration new`.
2. Sem timestamps duplicados (quebram a ordenação determinística do CLI).
3. Arquivo não pode estar vazio.
4. Proibido `ALTER DATABASE` (o Supabase rejeita) e DDL nos schemas gerenciados
   `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
5. Todo `CREATE TABLE` em `public` precisa, **na mesma migration**, de:
   - `GRANT ... ON public.<tabela> TO ...`
   - `ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY`

   Sem o GRANT, o PostgREST devolve *permission denied* mesmo com RLS correta.
   Sem o RLS, a tabela nasce exposta.

Template mínimo para uma tabela nova, na ordem correta:

```sql
CREATE TABLE public.exemplo (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exemplo TO authenticated;
GRANT ALL ON public.exemplo TO service_role;

ALTER TABLE public.exemplo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplo_org_isolation" ON public.exemplo
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
```

---

## 5. Runbook de incidentes

### Migration falhou no meio do `db push` em produção

O Postgres roda cada arquivo em transação, então uma migration que falha não
deixa DDL parcial — mas ela **não** é registrada em
`supabase_migrations.schema_migrations`. Passos:

1. Leia o erro no log do job `apply`.
2. Corrija o SQL **numa nova migration** ou corrigindo o arquivo que falhou
   (ele ainda não foi registrado, então editá-lo é seguro).
3. Abra um novo PR. Não rode `db push` manualmente da sua máquina — isso pula
   as guardas e o registro de aprovação.

### Histórico local e remoto divergiram

```bash
supabase migration list --linked   # compara local × remoto
supabase migration repair --status applied <timestamp>    # marca como aplicada
supabase migration repair --status reverted <timestamp>   # desmarca
```

Use `repair` só quando você tiver certeza do estado real do banco — ele mexe no
registro, não no schema.

### Preciso reverter

O Supabase CLI não tem `down migrations`. Reversão é uma **nova migration**
que desfaz a anterior, passando pelo mesmo fluxo de revisão. Antes de aplicar
DDL destrutivo em produção (`DROP COLUMN`, `DROP TABLE`), exporte os dados
afetados.

---

## 6. O que este fluxo deliberadamente não faz

- **Não expõe SQL arbitrário por HTTP/MCP.** Nenhuma edge function aplica
  migrations. O servidor MCP do app tem apenas ferramentas de leitura,
  parametrizadas e sob o token do usuário (RLS por organização).
- **Não guarda `SUPABASE_SERVICE_ROLE_KEY` nem a URL direta do banco no
  repositório.** As credenciais de migração vivem só nos GitHub Environments e
  só o runner de CI as vê.
- **Não permite aplicar em produção sem revisão humana**, por construção
  (Required reviewers no Environment).

# Template de Migration (sem credenciais)

Este fluxo **não usa** `SERVICE_ROLE_KEY` nem `DB_URL`. A migration é gerada como
arquivo SQL versionado e aplicada pelo canal interno do Lovable Cloud (ou pelo
`supabase db push` no CI, que autentica via `SUPABASE_ACCESS_TOKEN` + `PROJECT_REF`
guardados em GitHub Environments — nunca em código).

## Como pedir

Diga apenas **o que** deve mudar no schema. Exemplos:

- "adicionar coluna `instagram_handle text` em `public.companies`"
- "criar tabela `public.lead_notes` com `deal_id`, `body`, isolada por organização"
- "criar índice em `scrape_queue(status, run_at)`"

Eu gero a migration correspondente e ela passa pelo seu review antes de rodar.

---

## Padrão obrigatório — nova tabela

Ordem não-negociável: CREATE → GRANT → RLS → POLICY.

```sql
CREATE TABLE public.<tabela> (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- ... colunas de domínio ...
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_<tabela>_org_id ON public.<tabela>(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;
GRANT ALL ON public.<tabela> TO service_role;
-- GRANT SELECT ON public.<tabela> TO anon;  -- somente se houver policy para anon

ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<tabela>_select_org" ON public.<tabela>
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "<tabela>_write_org" ON public.<tabela>
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TRIGGER trg_<tabela>_updated_at
  BEFORE UPDATE ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

## Padrão — alterar tabela existente

```sql
ALTER TABLE public.<tabela>
  ADD COLUMN IF NOT EXISTS <coluna> <tipo>;

-- backfill idempotente, se necessário
UPDATE public.<tabela> SET <coluna> = <default> WHERE <coluna> IS NULL;

-- só depois do backfill
ALTER TABLE public.<tabela> ALTER COLUMN <coluna> SET NOT NULL;
```

Regras:
- Regras que dependem de tempo (`expire_at > now()`) vão em **trigger**, nunca em `CHECK`.
- `DROP COLUMN` exige verificar antes se alguma Edge Function ou hook lê a coluna.
- Colunas `GENERATED ALWAYS` nunca entram em `INSERT`/`UPDATE` do código.

## Padrão — função / RPC

```sql
CREATE OR REPLACE FUNCTION public.<fn>(_arg uuid)
RETURNS <tipo>
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ...
$$;

REVOKE ALL ON FUNCTION public.<fn>(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.<fn>(uuid) TO authenticated;
```

## Verificação local antes do push

```bash
npm run db:lint      # linter estático de migrations
npm run db:verify    # lint + reset do banco local (aplica tudo do zero)
npm run db:plan      # dry-run contra o alvo linkado
```

## O que nunca aparece aqui

| Item | Onde vive |
|---|---|
| `SERVICE_ROLE_KEY` | Apenas em Edge Functions, via `Deno.env.get`. Inacessível ao agente e ao repo. |
| `DB_URL` / senha do Postgres | Não utilizada neste fluxo. |
| `SUPABASE_ACCESS_TOKEN` | GitHub Environment secret, consumido só pelo job de CI. |

Nenhum desses valores é impresso em log, commitado ou exposto em endpoint.

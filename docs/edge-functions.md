# Edge Functions — Documentação

## Visão Geral

As edge functions rodam no Deno runtime via Lovable Cloud. Todas compartilham padrões comuns:

- **Autenticação**: JWT validado em código via `auth.getClaims()`
- **CORS**: Whitelist dinâmico de origins (produção + preview)
- **Validação**: Schemas Zod para todo input
- **Logging**: Structured JSON logs com `request_id`
- **Erros**: Respostas tipadas com status codes corretos (400, 401, 500)

---

## ai-agent

**Endpoint**: `POST /functions/v1/ai-agent`

### Descrição
Chat IA contextualizado com dados do banco do usuário. Usa Lovable AI Gateway (Gemini 2.5 Flash).

### Request
```json
{
  "message": "Quais empresas têm score acima de 80?"
}
```

### Headers
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Contexto injetado automaticamente
- Total de empresas e enriquecidas
- Top 10 empresas por IPC score
- Últimas 5 empresas adicionadas
- Distribuição por setor
- Critérios IPC ativos
- Contagem de workflows e jobs

### Response
```json
{
  "reply": "📊 Você tem 12 empresas com score acima de 80..."
}
```

### Validação
| Campo     | Tipo   | Restrição          |
|-----------|--------|--------------------|
| `message` | string | min 1, max 2000    |

---

## gmaps-proxy

**Endpoint**: `/functions/v1/gmaps-proxy?action=<action>`

### Ações

#### `GET ?action=list`
Lista jobs de raspagem. Sincroniza status com API externa.

**Response**:
```json
{
  "jobs": [...],
  "api_online": true
}
```

#### `POST ?action=create`
Cria novo job de raspagem.

**Body**:
```json
{
  "name": "Restaurantes SP",
  "keywords": ["restaurante", "bar"],
  "lang": "pt",
  "zoom": 15,
  "lat": "-23.55",
  "lon": "-46.63",
  "radius": 10000,
  "depth": 1,
  "email": true,
  "fast_mode": false
}
```

| Campo       | Tipo      | Default       | Restrição           |
|-------------|-----------|---------------|---------------------|
| `name`      | string    | —             | 1–255 chars         |
| `keywords`  | string[]  | —             | 1–20 items, 1–200 chars cada |
| `lang`      | string    | `"pt"`        | 2–5 chars           |
| `zoom`      | int       | `15`          | 1–21                |
| `lat`       | string    | `"0"`         | max 30 chars        |
| `lon`       | string    | `"0"`         | max 30 chars        |
| `radius`    | int       | `10000`       | 100–100.000         |
| `depth`     | int       | `1`           | 1–10                |
| `email`     | boolean   | `true`        |                     |
| `fast_mode` | boolean   | `false`       |                     |
| `max_time`  | int       | `480000000000`| positivo            |
| `proxies`   | string[]  | `[]`          | max 10              |

#### `DELETE ?action=delete&id=<uuid>`
Remove job do banco e da API externa.

#### `POST ?action=sync-results`
Baixa resultados CSV da API externa, cria empresas com IPC scoring, gera notificação.

**Body**:
```json
{ "job_id": "uuid" }
```

**Response**:
```json
{
  "companies_created": 45,
  "total_results": 50
}
```

---

## workflow-engine

**Endpoint**: `/functions/v1/workflow-engine?action=<action>`

### Ações

#### `GET ?action=list`
Lista workflows com seus runs.

#### `POST ?action=create`
Cria workflow.

**Body**:
```json
{
  "name": "Pipeline Restaurantes",
  "description": "Raspar e pontuar restaurantes em SP",
  "steps": [{ "type": "scrape" }, { "type": "enrich" }, { "type": "score" }],
  "config": { "keywords": ["restaurante"], "radius": 5000 }
}
```

#### `POST ?action=run`
Executa workflow em 4 etapas:

1. **Scrape** — Cria job na API externa
2. **Enrich** — Importa resultados de jobs completos
3. **IPC Score** — Pontua empresas sem score
4. **Finalize** — Calcula métricas e notifica

**Body**: `{ "workflow_id": "uuid" }`

#### `POST ?action=toggle-status`
Altera status do workflow.

**Body**:
```json
{ "workflow_id": "uuid", "new_status": "active|paused|draft" }
```

#### `DELETE ?action=delete&id=<uuid>`
Remove workflow.

---

## rls-tests

**Endpoint**: `POST /functions/v1/rls-tests`

### Descrição
Testes automatizados de Row-Level Security. Cria dois usuários temporários e valida:

1. Anon não pode ler nenhuma tabela
2. Anon não pode inserir em nenhuma tabela
3. User B não vê empresas de User A
4. User B não pode atualizar empresas de User A
5. User B não pode deletar empresas de User A
6. User A pode ver próprias empresas
7. Isolamento cross-table (workflows)
8. Isolamento de profiles

Cleanup automático dos dados de teste após execução.

### Response
```json
{
  "allPassed": true,
  "total": 25,
  "passed": 25,
  "failed": 0,
  "results": [...]
}
```

# 🗺️ Diagrama Entidade-Relacionamento (ERD)

Este diagrama representa a arquitetura de dados multi-tenant do LUX IA.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ PROFILES : "possui"
    ORGANIZATIONS ||--o{ COMPANIES : "gerencia"
    ORGANIZATIONS ||--o{ CAMPAIGNS : "executa"
    ORGANIZATIONS ||--o{ DEALS : "rastreia"
    ORGANIZATIONS ||--o{ AUDIT_LOGS : "registra"
    
    PROFILES ||--o{ USER_ROLES : "tem_papel"
    PROFILES ||--o{ SCRAPE_JOBS : "inicia"
    
    COMPANIES ||--o{ DEALS : "origina"
    COMPANIES ||--o{ SCRAPE_RESULTS : "resultado_de"
    
    CAMPAIGNS ||--o{ CAMPAIGN_EVENTS : "gera"
    CAMPAIGNS ||--o{ WORKFLOW_RUNS : "executa"
    
    SCRAPE_JOBS ||--o{ SCRAPE_RESULTS : "contém"
    
    ORGANIZATIONS {
        uuid id PK
        string name
        string plan
        jsonb settings
        timestamp created_at
    }
    
    PROFILES {
        uuid id PK
        uuid organization_id FK
        string full_name
        string email
    }
    
    COMPANIES {
        uuid id PK
        uuid organization_id FK
        string name
        string sector
        string website
        float ipc_score
        int version "Optimistic Locking"
    }
    
    SCRAPE_JOBS {
        uuid id PK
        uuid organization_id FK
        string status "pending|running|completed|failed"
        string source "gmaps"
        jsonb config
    }
    
    DEALS {
        uuid id PK
        uuid organization_id FK
        uuid company_id FK
        string stage
        numeric value
        int version
    }
```

## Descrição das Tabelas Principais

- **organizations**: Unidade raiz de isolamento (Tenant).
- **profiles**: Usuários vinculados a uma organização.
- **companies**: Leads/Empresas prospectadas ou importadas.
- **scrape_jobs**: Registros de processos de raspagem (Google Maps, etc).
- **deals**: Oportunidades no funil de vendas (CRM).
- **audit_logs**: Trilha de auditoria imutável por organização.

---
*Gerado automaticamente via documentação técnica.*

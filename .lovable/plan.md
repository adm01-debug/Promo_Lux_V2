

## Testes E2E para Fluxos Principais

Adicionar testes de integração end-to-end usando Playwright (já configurado no projeto via `lovable-agent-playwright-config`) cobrindo os 3 fluxos críticos: autenticação, navegação e CRUD de empresas.

### Estrutura de Arquivos

Novos arquivos em `e2e/`:
- `e2e/auth.spec.ts` — Login, signup, validações, logout
- `e2e/navigation.spec.ts` — **Estender** o existente com cobertura completa
- `e2e/companies-crud.spec.ts` — Criar, ler, atualizar, deletar empresas
- `e2e/helpers/auth.ts` — Helper para login programático reutilizável
- `e2e/helpers/selectors.ts` — Seletores estáveis centralizados

### Cobertura por Fluxo

**1. Autenticação (`auth.spec.ts`)**
- Página de login renderiza com tabs Entrar/Criar Conta
- Validação de email inválido mostra erro
- Validação de senha curta no signup (< 8 chars)
- Toggle "Esqueceu a senha?" abre overlay de reset
- Botão Google login está visível e clicável
- Rate limit warning aparece após múltiplas tentativas falhas
- Redirect para `/login` quando não autenticado em rota protegida

**2. Navegação (`navigation.spec.ts` estendido)**
- Sidebar navega entre todas as 10 views (dashboard, companies, analytics, etc.)
- Breadcrumbs atualizam corretamente
- Título do documento muda dinamicamente (`{view} — LUX IA`)
- Atalho Ctrl+B colapsa/expande sidebar
- Atalho Ctrl+K abre Command Palette
- Atalhos Alt+1-9 navegam para views específicas
- Mobile bottom nav funciona em viewport 390x844
- Botão "Voltar" funciona quando há histórico
- Modo Foco (⌘⇧F) oculta sidebar e header

**3. CRUD de Empresas (`companies-crud.spec.ts`)**
- Lista de empresas carrega com paginação
- Busca filtra resultados em tempo real
- Filtros por setor/localização/status funcionam
- Botão "Adicionar Empresa" abre dialog
- Submeter form com dados válidos cria empresa (toast de sucesso)
- Validação de CNPJ inválido mostra erro
- Edit dialog pré-preenche dados existentes
- Update reflete na tabela após salvar
- Delete pede confirmação e remove da lista
- Export CSV gera download
- Tooltip do score IPC aparece no hover

### Estratégia Técnica

**Autenticação nos testes**: Usar `helpers/auth.ts` que cria sessão Supabase programaticamente via `supabase.auth.signInWithPassword`, evitando depender de UI de login em cada teste. Variáveis de ambiente `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (com fallback para modo demo).

**Modo Demo**: Para CRUD sem afetar produção, ativar `DemoContext` via localStorage no `beforeEach`, garantindo dados isolados e idempotentes.

**Seletores estáveis**: Adicionar `data-testid` apenas onde labels/roles não são suficientes (botões de ação em rows, dropdowns mobile). Preferir queries acessíveis (`getByRole`, `getByLabel`).

**Mocks de rede**: Para fluxos com edge functions (gmaps-proxy, ai-agent), interceptar com `page.route()` retornando fixtures determinísticas.

**Execução**: Comando `npx playwright test` (já configurado). CI workflow `.github/workflows/ci.yml` será atualizado para rodar suite E2E após testes unitários.

### Arquivos a Editar
- `e2e/navigation.spec.ts` — expandir cobertura
- `.github/workflows/ci.yml` — adicionar step de E2E
- `src/components/lux/CompanyTable.tsx` — adicionar `data-testid` nas action buttons (mínimo, não-invasivo)
- `src/components/lux/AddCompanyDialog.tsx` — `data-testid` no submit
- `src/pages/Login.tsx` — `data-testid` nos forms de login/signup

### Arquivos a Criar
- `e2e/auth.spec.ts`
- `e2e/companies-crud.spec.ts`
- `e2e/helpers/auth.ts`
- `e2e/helpers/selectors.ts`
- `e2e/fixtures/companies.json`

### Resultado Esperado
~35-40 cenários E2E cobrindo os caminhos críticos do usuário, executáveis localmente e em CI, com tempo total estimado < 3 min.


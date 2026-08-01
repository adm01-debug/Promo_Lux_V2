# Schema das Tabelas Principais — LUX IA

> Extraído de `information_schema` + `pg_constraint` do Postgres (Lovable Cloud).


## Tenancy & Auth


### `organizations`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `name` | text | NOT NULL |  |  |
| 3 | `slug` | text | NOT NULL |  |  |
| 4 | `owner_id` | uuid | NOT NULL |  |  |
| 5 | `created_at` | timestamptz | NOT NULL | now() |  |
| 6 | `updated_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(slug)`


### `organization_members`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `user_id` | uuid | NOT NULL |  |  |
| 4 | `role` | app_role | NOT NULL | 'viewer'::app_role |  |
| 5 | `created_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(organization_id, user_id)`


### `organization_invites`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `token` | text | NOT NULL | encode(extensions.gen_random_bytes(24), 'hex'::text) |  |
| 4 | `role` | app_role | NOT NULL | 'viewer'::app_role |  |
| 5 | `created_by` | uuid | NOT NULL |  |  |
| 6 | `accepted_by` | uuid |  |  |  |
| 7 | `accepted_at` | timestamptz |  |  |  |
| 8 | `expires_at` | timestamptz | NOT NULL | (now() + '7 days'::interval) |  |
| 9 | `revoked` | boolean | NOT NULL | false |  |
| 10 | `created_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(token)`


### `profiles`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL |  | → `users.id` (ON DELETE CASCADE) |
| 2 | `full_name` | text |  |  |  |
| 3 | `avatar_url` | text |  |  |  |
| 4 | `skin` | text | NOT NULL | 'gold'::text |  |
| 5 | `created_at` | timestamptz | NOT NULL | now() |  |
| 6 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 7 | `notification_prefs` | jsonb | NOT NULL | '{"email_notifs": true, "scrape_notifs": true, "signal_notifs": true, "weekly_report": false}'::jsonb |  |
| 8 | `onboarding_completed` | boolean | NOT NULL | false |  |


### `user_roles`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL |  | → `users.id` (ON DELETE CASCADE) |
| 3 | `role` | app_role | NOT NULL |  |  |

**Índices únicos:**
- `(user_id, role)`


## Prospecção / CRM


### `companies`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `name` | text | NOT NULL |  |  |
| 3 | `sector` | text |  |  |  |
| 4 | `location` | text |  |  |  |
| 5 | `website` | text |  |  |  |
| 6 | `phone` | text |  |  |  |
| 7 | `email` | text |  |  |  |
| 8 | `employees` | text |  |  |  |
| 9 | `revenue` | numeric |  |  |  |
| 10 | `source` | text | NOT NULL | 'manual'::text |  |
| 11 | `ipc_score` | integer |  | 0 |  |
| 12 | `enriched` | boolean |  | false |  |
| 13 | `starred` | boolean |  | false |  |
| 14 | `raw_data` | jsonb |  | '{}'::jsonb |  |
| 15 | `created_at` | timestamptz | NOT NULL | now() |  |
| 16 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 17 | `lat` | float8 |  |  |  |
| 18 | `lng` | float8 |  |  |  |
| 19 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 20 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 21 | `version` | integer | NOT NULL | 1 |  |
| 22 | `cnpj` | text |  |  |  |
| 23 | `linkedin_url` | text |  |  |  |
| 24 | `instagram_url` | text |  |  |  |
| 25 | `description` | text |  |  |  |
| 26 | `logo_url` | text |  |  |  |
| 27 | `deleted_at` | timestamptz |  |  |  |
| 28 | `latitude` | float8 |  |  |  |
| 29 | `longitude` | float8 |  |  |  |
| 30 | `place_id` | text |  |  |  |
| 31 | `cid` | text |  |  |  |
| 32 | `plus_code` | text |  |  |  |
| 33 | `google_maps_url` | text |  |  |  |
| 34 | `street_view_url` | text |  |  |  |
| 35 | `rating` | numeric |  |  |  |
| 36 | `review_count` | integer |  |  |  |
| 37 | `price_range` | text |  |  |  |
| 38 | `business_status` | text |  |  |  |
| 39 | `thumbnail_url` | text |  |  |  |
| 40 | `images` | text[] |  |  |  |
| 41 | `open_hours` | jsonb |  |  |  |
| 42 | `popular_times` | jsonb |  |  |  |
| 43 | `timezone` | text |  |  |  |
| 44 | `descriptions` | text |  |  |  |
| 45 | `owner_claimed` | boolean |  |  |  |
| 46 | `reservations_url` | text |  |  |  |
| 47 | `order_online_url` | text |  |  |  |
| 48 | `menu_url` | text |  |  |  |

**Índices únicos:**
- `(organization_id, place_id) WHERE (place_id IS NOT NULL) AND (deleted_at IS NULL)`
- `(name, source)`


### `company_reviews`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `company_id` | uuid | NOT NULL |  | → `companies.id` (ON DELETE CASCADE) |
| 4 | `external_id` | text |  |  |  |
| 5 | `author_name` | text |  |  |  |
| 6 | `author_avatar` | text |  |  |  |
| 7 | `rating` | numeric |  |  |  |
| 8 | `comment` | text |  |  |  |
| 9 | `owner_response` | text |  |  |  |
| 10 | `reviewed_at` | timestamptz |  |  |  |
| 11 | `raw_data` | jsonb |  |  |  |
| 12 | `created_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(company_id, external_id) WHERE external_id IS NOT NULL`


### `stakeholders`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE CASCADE) |
| 3 | `full_name` | text | NOT NULL |  |  |
| 4 | `role` | text |  |  |  |
| 5 | `department` | text |  |  |  |
| 6 | `seniority` | text |  | 'unknown'::text |  |
| 7 | `email` | text |  |  |  |
| 8 | `phone` | text |  |  |  |
| 9 | `linkedin_url` | text |  |  |  |
| 10 | `avatar_url` | text |  |  |  |
| 11 | `confidence_score` | integer |  | 50 |  |
| 12 | `source` | text |  | 'manual'::text |  |
| 13 | `tags` | text[] |  | '{}'::text[] |  |
| 14 | `notes` | text |  |  |  |
| 15 | `last_contacted_at` | timestamptz |  |  |  |
| 16 | `raw_data` | jsonb |  | '{}'::jsonb |  |
| 17 | `created_at` | timestamptz | NOT NULL | now() |  |
| 18 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 19 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 20 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `deals`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 3 | `stage_id` | uuid | NOT NULL |  | → `deal_stages.id` (ON DELETE RESTRICT) |
| 4 | `title` | text | NOT NULL |  |  |
| 5 | `description` | text |  |  |  |
| 6 | `value` | numeric |  | 0 |  |
| 7 | `currency` | text | NOT NULL | 'BRL'::text |  |
| 8 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE SET NULL) |
| 9 | `stakeholder_id` | uuid |  |  | → `stakeholders.id` (ON DELETE SET NULL) |
| 10 | `expected_close_date` | date |  |  |  |
| 11 | `closed_at` | timestamptz |  |  |  |
| 12 | `priority` | text | NOT NULL | 'medium'::text |  |
| 13 | `tags` | text[] |  | '{}'::text[] |  |
| 14 | `position` | integer | NOT NULL | 0 |  |
| 15 | `created_at` | timestamptz | NOT NULL | now() |  |
| 16 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 17 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 18 | `version` | integer | NOT NULL | 1 |  |
| 19 | `deleted_at` | timestamptz |  |  |  |


### `deal_stages`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 3 | `name` | text | NOT NULL |  |  |
| 4 | `color` | text | NOT NULL | '#D4A520'::text |  |
| 5 | `position` | integer | NOT NULL | 0 |  |
| 6 | `probability` | integer | NOT NULL | 0 |  |
| 7 | `type` | text | NOT NULL | 'open'::text |  |
| 8 | `created_at` | timestamptz | NOT NULL | now() |  |
| 9 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 10 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `deal_tasks`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 3 | `deal_id` | uuid |  |  | → `deals.id` (ON DELETE CASCADE) |
| 4 | `title` | text | NOT NULL |  |  |
| 5 | `description` | text |  |  |  |
| 6 | `due_at` | timestamptz |  |  |  |
| 7 | `remind_at` | timestamptz |  |  |  |
| 8 | `reminded` | boolean | NOT NULL | false |  |
| 9 | `completed` | boolean | NOT NULL | false |  |
| 10 | `completed_at` | timestamptz |  |  |  |
| 11 | `priority` | text | NOT NULL | 'medium'::text |  |
| 12 | `created_at` | timestamptz | NOT NULL | now() |  |
| 13 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 14 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `deal_activities`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 3 | `deal_id` | uuid | NOT NULL |  | → `deals.id` (ON DELETE CASCADE) |
| 4 | `type` | text | NOT NULL | 'note'::text |  |
| 5 | `title` | text | NOT NULL |  |  |
| 6 | `content` | text |  |  |  |
| 7 | `metadata` | jsonb |  | '{}'::jsonb |  |
| 8 | `created_at` | timestamptz | NOT NULL | now() |  |
| 9 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `intent_signals`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE CASCADE) |
| 3 | `company_name` | text | NOT NULL |  |  |
| 4 | `type` | text | NOT NULL | 'website_visit'::text |  |
| 5 | `signal` | text | NOT NULL |  |  |
| 6 | `strength` | text | NOT NULL | 'medium'::text |  |
| 7 | `details` | text |  |  |  |
| 8 | `metadata` | jsonb |  | '{}'::jsonb |  |
| 9 | `created_at` | timestamptz | NOT NULL | now() |  |
| 10 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 11 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


## Raspagem (GMaps)


### `scrape_jobs`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `external_id` | text |  |  |  |
| 3 | `name` | text | NOT NULL |  |  |
| 4 | `status` | scrape_job_status | NOT NULL | 'pending'::scrape_job_status |  |
| 5 | `source` | text | NOT NULL | 'gmaps'::text |  |
| 6 | `config` | jsonb | NOT NULL | '{}'::jsonb |  |
| 7 | `results_count` | integer |  | 0 |  |
| 8 | `error_message` | text |  |  |  |
| 9 | `started_at` | timestamptz |  |  |  |
| 10 | `completed_at` | timestamptz |  |  |  |
| 11 | `created_at` | timestamptz | NOT NULL | now() |  |
| 12 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 13 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 14 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 15 | `auto_sync` | boolean |  | false |  |
| 16 | `config_hash` | text |  |  |  |
| 17 | `trace_id` | uuid |  |  |  |
| 18 | `extra_reviews` | boolean |  | false |  |

**Índices únicos:**
- `(organization_id, config_hash) WHERE (status = ANY (ARRAY['pending'::scrape_job_status, 'running'::scrape_job_status, 'working'::scrape_job_status])) AND (config_hash IS NOT NULL)`


### `scrape_queue`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  |  |
| 3 | `user_id` | uuid | NOT NULL |  |  |
| 4 | `scrape_job_id` | uuid |  |  | → `scrape_jobs.id` (ON DELETE SET NULL) |
| 5 | `source` | text | NOT NULL | 'gmaps'::text |  |
| 6 | `payload` | jsonb | NOT NULL | '{}'::jsonb |  |
| 7 | `status` | scrape_queue_status | NOT NULL | 'queued'::scrape_queue_status |  |
| 8 | `attempts` | integer | NOT NULL | 0 |  |
| 9 | `max_attempts` | integer | NOT NULL | 6 |  |
| 10 | `priority` | integer | NOT NULL | 0 |  |
| 11 | `base_delay_secs` | integer | NOT NULL | 5 |  |
| 12 | `max_delay_secs` | integer | NOT NULL | 300 |  |
| 13 | `next_run_at` | timestamptz | NOT NULL | now() |  |
| 14 | `locked_at` | timestamptz |  |  |  |
| 15 | `locked_by` | text |  |  |  |
| 16 | `last_error` | text |  |  |  |
| 17 | `created_at` | timestamptz | NOT NULL | now() |  |
| 18 | `updated_at` | timestamptz | NOT NULL | now() |  |


### `scrape_results`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `job_id` | uuid | NOT NULL |  | → `scrape_jobs.id` (ON DELETE CASCADE) |
| 3 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE SET NULL) |
| 4 | `raw_data` | jsonb | NOT NULL | '{}'::jsonb |  |
| 5 | `processed` | boolean |  | false |  |
| 6 | `created_at` | timestamptz | NOT NULL | now() |  |
| 7 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 8 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `scrape_dead_letter`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `queue_id` | uuid |  |  |  |
| 3 | `organization_id` | uuid | NOT NULL |  |  |
| 4 | `user_id` | uuid | NOT NULL |  |  |
| 5 | `scrape_job_id` | uuid |  |  |  |
| 6 | `source` | text | NOT NULL | 'gmaps'::text |  |
| 7 | `payload` | jsonb | NOT NULL | '{}'::jsonb |  |
| 8 | `attempts` | integer | NOT NULL | 0 |  |
| 9 | `last_error` | text |  |  |  |
| 10 | `failed_at` | timestamptz | NOT NULL | now() |  |
| 11 | `replayed_at` | timestamptz |  |  |  |
| 12 | `created_at` | timestamptz | NOT NULL | now() |  |


### `org_proxies`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `label` | text | NOT NULL |  |  |
| 4 | `proxy_type` | text | NOT NULL | 'http'::text |  |
| 5 | `url` | text | NOT NULL |  |  |
| 6 | `is_active` | boolean | NOT NULL | true |  |
| 7 | `usage_count` | integer | NOT NULL | 0 |  |
| 8 | `last_used_at` | timestamptz |  |  |  |
| 9 | `created_at` | timestamptz | NOT NULL | now() |  |
| 10 | `updated_at` | timestamptz | NOT NULL | now() |  |


### `org_scrape_rate_limits`
**PK:** `organization_id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 2 | `max_concurrent` | integer | NOT NULL | 5 |  |
| 3 | `max_per_hour` | integer | NOT NULL | 100 |  |
| 4 | `notes` | text |  |  |  |
| 5 | `created_at` | timestamptz | NOT NULL | now() |  |
| 6 | `updated_at` | timestamptz | NOT NULL | now() |  |


### `places_api_usage`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `month` | date | NOT NULL |  |  |
| 4 | `calls_essentials` | integer | NOT NULL | 0 |  |
| 5 | `calls_pro` | integer | NOT NULL | 0 |  |
| 6 | `calls_enterprise` | integer | NOT NULL | 0 |  |
| 7 | `estimated_cost_usd` | numeric | NOT NULL | 0 |  |
| 8 | `last_call_at` | timestamptz |  |  |  |
| 9 | `created_at` | timestamptz | NOT NULL | now() |  |
| 10 | `updated_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(organization_id, month)`


### `job_exports`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `job_id` | uuid | NOT NULL |  | → `scrape_jobs.id` (ON DELETE CASCADE) |
| 3 | `user_id` | uuid | NOT NULL |  | → `users.id` (ON DELETE CASCADE) |
| 4 | `organization_id` | uuid |  |  | → `organizations.id` (ON DELETE CASCADE) |
| 5 | `format` | text | NOT NULL |  |  |
| 6 | `status` | text |  | 'pending'::text |  |
| 7 | `file_url` | text |  |  |  |
| 8 | `created_at` | timestamptz |  | now() |  |


## Oracle / Lusha


### `lusha_contacts`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `session_id` | uuid |  |  | → `lusha_search_sessions.id` (ON DELETE SET NULL) |
| 3 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE SET NULL) |
| 4 | `stakeholder_id` | uuid |  |  | → `stakeholders.id` (ON DELETE SET NULL) |
| 5 | `lusha_company_name` | text | NOT NULL |  |  |
| 6 | `lusha_company_lid` | text |  |  |  |
| 7 | `full_name` | text | NOT NULL |  |  |
| 8 | `first_name` | text |  |  |  |
| 9 | `job_title` | text |  |  |  |
| 10 | `department_pt` | text |  |  |  |
| 11 | `department_en` | text |  |  |  |
| 12 | `seniority` | text |  |  |  |
| 13 | `linkedin_url` | text |  |  |  |
| 15 | `email` | text |  |  |  |
| 16 | `email_source` | text |  |  |  |
| 17 | `phone_raw` | text |  |  |  |
| 18 | `phone_formatted` | text |  |  |  |
| 19 | `phone_source` | text |  |  |  |
| 20 | `enrichment_status` | text | NOT NULL | 'pending'::text |  |
| 21 | `bitrix_contact_id` | text |  |  |  |
| 22 | `bitrix_card_id` | text |  |  |  |
| 23 | `is_duplicate` | boolean | NOT NULL | false |  |
| 24 | `has_email` | boolean |  |  |  |
| 25 | `has_phone` | boolean |  |  |  |
| 26 | `confidence_score` | integer |  | 50 |  |
| 27 | `raw_lusha_payload` | jsonb | NOT NULL | '{}'::jsonb |  |
| 28 | `raw_leadcontact_email` | jsonb | NOT NULL | '{}'::jsonb |  |
| 29 | `raw_leadcontact_phone` | jsonb | NOT NULL | '{}'::jsonb |  |
| 30 | `n8n_workflow_id` | text |  |  |  |
| 31 | `n8n_execution_id` | text |  |  |  |
| 32 | `created_at` | timestamptz | NOT NULL | now() |  |
| 33 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 34 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 35 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 36 | `linkedin_followers_count` | integer |  |  |  |
| 37 | `linkedin_connections_count` | integer |  |  |  |
| 38 | `linkedin_skills` | text[] |  |  |  |
| 39 | `linkedin_certifications` | text[] |  |  |  |
| 40 | `linkedin_courses` | text[] |  |  |  |
| 41 | `linkedin_awards` | text[] |  |  |  |
| 42 | `x_url` | text |  |  |  |
| 43 | `company_locations` | jsonb |  |  |  |
| 44 | `company_type` | text |  |  |  |
| 45 | `company_linkedin_followers` | integer |  |  |  |
| 46 | `company_email_domain` | text |  |  |  |
| 47 | `lusha_popularity_tier` | text |  |  |  |
| 48 | `company_linkedin_url` | text |  |  |  |
| 49 | `dedup_hash` | text |  |  |  |
| 50 | `last_enriched_at` | timestamptz |  |  |  |
| 51 | `enrichment_attempts` | integer | NOT NULL | 0 |  |
| 52 | `last_error` | text |  |  |  |
| 53 | `linkedin_public_id` | text |  |  |  |

**Índices únicos:**
- `(organization_id, linkedin_public_id)`
- `(organization_id, lower(TRIM(BOTH FROM full_name)), lower(COALESCE(TRIM(BOTH FROM job_title), ''::text))) WHERE linkedin_public_id IS NULL`


### `lusha_search_sessions`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `company_name` | text | NOT NULL |  |  |
| 3 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE SET NULL) |
| 4 | `lusha_company_lid` | text |  |  |  |
| 5 | `departments_requested` | text[] | NOT NULL | '{}'::text[] |  |
| 6 | `departments_mapped` | text[] | NOT NULL | '{}'::text[] |  |
| 7 | `departments_not_found` | text[] | NOT NULL | '{}'::text[] |  |
| 8 | `total_found` | integer | NOT NULL | 0 |  |
| 9 | `total_enriched` | integer | NOT NULL | 0 |  |
| 10 | `total_inserted_bitrix` | integer | NOT NULL | 0 |  |
| 11 | `total_duplicates` | integer | NOT NULL | 0 |  |
| 12 | `total_empty` | integer | NOT NULL | 0 |  |
| 13 | `total_errors` | integer | NOT NULL | 0 |  |
| 14 | `enrichment_rate` | numeric |  |  |  |
| 15 | `status` | text | NOT NULL | 'running'::text |  |
| 16 | `error_message` | text |  |  |  |
| 17 | `bitrix_card_id` | text |  |  |  |
| 18 | `bitrix_user_id` | text |  |  |  |
| 19 | `started_at` | timestamptz | NOT NULL | now() |  |
| 20 | `completed_at` | timestamptz |  |  |  |
| 21 | `created_at` | timestamptz | NOT NULL | now() |  |
| 22 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 23 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 24 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 25 | `search_type` | text | NOT NULL | 'department_search'::text |  |
| 26 | `domain_searched` | text |  |  |  |
| 27 | `progress_pct` | integer | NOT NULL | 0 |  |
| 28 | `idempotency_key` | text |  |  |  |
| 29 | `bitrix_company_id` | text |  |  |  |

**Índices únicos:**
- `(idempotency_key) WHERE idempotency_key IS NOT NULL`


### `lusha_dm_search_history`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL |  | → `users.id` (ON DELETE CASCADE) |
| 3 | `organization_id` | uuid |  |  |  |
| 4 | `domain` | text | NOT NULL |  |  |
| 5 | `linkedin_url` | text |  |  |  |
| 6 | `status` | text | NOT NULL |  |  |
| 7 | `decision_makers_count` | integer | NOT NULL | 0 |  |
| 8 | `error_message` | text |  |  |  |
| 9 | `duration_ms` | integer |  |  |  |
| 10 | `metadata` | jsonb | NOT NULL | '{}'::jsonb |  |
| 11 | `created_at` | timestamptz | NOT NULL | now() |  |
| 12 | `updated_at` | timestamptz | NOT NULL | now() |  |


### `lusha_credit_usage_log`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  |  |
| 3 | `user_id` | uuid |  |  |  |
| 4 | `operation` | text | NOT NULL |  |  |
| 5 | `endpoint` | text | NOT NULL |  |  |
| 6 | `company_name` | text |  |  |  |
| 7 | `domain` | text |  |  |  |
| 8 | `session_id` | uuid |  |  |  |
| 9 | `bitrix_card_id` | text |  |  |  |
| 10 | `credits_charged` | integer | NOT NULL | 0 |  |
| 11 | `records_returned` | integer | NOT NULL | 0 |  |
| 12 | `success` | boolean | NOT NULL | true |  |
| 13 | `error_code` | text |  |  |  |
| 14 | `request_id` | text |  |  |  |
| 15 | `api_version` | text |  | 'v3'::text |  |
| 16 | `created_at` | timestamptz | NOT NULL | now() |  |


## Campanhas & Email


### `campaigns`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `name` | text | NOT NULL |  |  |
| 3 | `status` | campaign_status | NOT NULL | 'draft'::campaign_status |  |
| 4 | `prospects` | integer | NOT NULL | 0 |  |
| 5 | `sent` | integer | NOT NULL | 0 |  |
| 6 | `opened` | integer | NOT NULL | 0 |  |
| 7 | `replied` | integer | NOT NULL | 0 |  |
| 8 | `meetings` | integer | NOT NULL | 0 |  |
| 9 | `sequence` | jsonb | NOT NULL | '[]'::jsonb |  |
| 10 | `start_date` | timestamptz |  |  |  |
| 11 | `created_at` | timestamptz | NOT NULL | now() |  |
| 12 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 13 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 14 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 15 | `failed` | integer | NOT NULL | 0 |  |
| 16 | `bounced` | integer | NOT NULL | 0 |  |
| 17 | `deleted_at` | timestamptz |  |  |  |
| 18 | `ab_test_enabled` | boolean | NOT NULL | false |  |
| 19 | `ab_min_sample` | integer | NOT NULL | 20 |  |
| 20 | `ab_winner_metric` | text | NOT NULL | 'reply'::text |  |
| 21 | `ab_winner_variant` | text |  |  |  |
| 22 | `ab_winner_decided_at` | timestamptz |  |  |  |


### `campaign_recipients`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 3 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 4 | `campaign_id` | uuid | NOT NULL |  | → `campaigns.id` (ON DELETE CASCADE) |
| 5 | `stakeholder_id` | uuid |  |  | → `stakeholders.id` (ON DELETE SET NULL) |
| 6 | `company_id` | uuid |  |  | → `companies.id` (ON DELETE SET NULL) |
| 7 | `email` | text | NOT NULL |  |  |
| 8 | `full_name` | text |  |  |  |
| 9 | `status` | text | NOT NULL | 'pending'::text |  |
| 10 | `sent_at` | timestamptz |  |  |  |
| 11 | `first_opened_at` | timestamptz |  |  |  |
| 12 | `last_opened_at` | timestamptz |  |  |  |
| 13 | `open_count` | integer | NOT NULL | 0 |  |
| 14 | `first_clicked_at` | timestamptz |  |  |  |
| 15 | `last_clicked_at` | timestamptz |  |  |  |
| 16 | `click_count` | integer | NOT NULL | 0 |  |
| 17 | `replied_at` | timestamptz |  |  |  |
| 18 | `bounced_at` | timestamptz |  |  |  |
| 19 | `unsubscribed_at` | timestamptz |  |  |  |
| 20 | `created_at` | timestamptz | NOT NULL | now() |  |
| 21 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 22 | `current_step` | integer | NOT NULL | 0 |  |
| 23 | `next_action_at` | timestamptz | NOT NULL | now() |  |
| 24 | `sequence_completed_at` | timestamptz |  |  |  |
| 25 | `last_step_error` | text |  |  |  |
| 26 | `variant` | text |  |  |  |

**Índices únicos:**
- `(campaign_id, email)`


### `campaign_messages`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 3 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 4 | `campaign_id` | uuid | NOT NULL |  | → `campaigns.id` (ON DELETE CASCADE) |
| 5 | `recipient_id` | uuid | NOT NULL |  | → `campaign_recipients.id` (ON DELETE CASCADE) |
| 6 | `email_account_id` | uuid |  |  | → `email_accounts.id` (ON DELETE SET NULL) |
| 7 | `step_index` | integer | NOT NULL | 0 |  |
| 8 | `provider` | text |  |  |  |
| 9 | `provider_message_id` | text |  |  |  |
| 10 | `rfc822_message_id` | text |  |  |  |
| 11 | `thread_id` | text |  |  |  |
| 12 | `subject` | text |  |  |  |
| 13 | `sent_at` | timestamptz | NOT NULL | now() |  |
| 14 | `created_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(recipient_id, step_index)`


### `campaign_events`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  |  |
| 3 | `campaign_id` | uuid | NOT NULL |  | → `campaigns.id` (ON DELETE CASCADE) |
| 4 | `recipient_id` | uuid | NOT NULL |  | → `campaign_recipients.id` (ON DELETE CASCADE) |
| 5 | `event_type` | text | NOT NULL |  |  |
| 6 | `url` | text |  |  |  |
| 7 | `ip_address` | text |  |  |  |
| 8 | `user_agent` | text |  |  |  |
| 9 | `metadata` | jsonb |  | '{}'::jsonb |  |
| 10 | `occurred_at` | timestamptz | NOT NULL | now() |  |


### `campaign_replies`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  |  |
| 3 | `campaign_id` | uuid | NOT NULL |  | → `campaigns.id` (ON DELETE CASCADE) |
| 4 | `recipient_id` | uuid | NOT NULL |  | → `campaign_recipients.id` (ON DELETE CASCADE) |
| 5 | `message_id` | uuid |  |  | → `campaign_messages.id` (ON DELETE SET NULL) |
| 6 | `email_account_id` | uuid |  |  | → `email_accounts.id` (ON DELETE SET NULL) |
| 7 | `provider` | text | NOT NULL |  |  |
| 8 | `provider_message_id` | text | NOT NULL |  |  |
| 9 | `thread_id` | text |  |  |  |
| 10 | `in_reply_to` | text |  |  |  |
| 11 | `from_email` | text |  |  |  |
| 12 | `from_name` | text |  |  |  |
| 13 | `subject` | text |  |  |  |
| 14 | `snippet` | text |  |  |  |
| 15 | `body_text` | text |  |  |  |
| 16 | `received_at` | timestamptz | NOT NULL |  |  |
| 17 | `created_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(provider, provider_message_id)`


### `email_accounts`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 3 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 4 | `provider` | text | NOT NULL |  |  |
| 5 | `email` | text | NOT NULL |  |  |
| 6 | `display_name` | text |  |  |  |
| 7 | `access_token` | text |  |  |  |
| 8 | `refresh_token` | text |  |  |  |
| 9 | `expires_at` | timestamptz |  |  |  |
| 10 | `scope` | text |  |  |  |
| 11 | `history_id` | text |  |  |  |
| 12 | `delta_link` | text |  |  |  |
| 13 | `last_polled_at` | timestamptz |  |  |  |
| 14 | `last_error` | text |  |  |  |
| 15 | `active` | boolean | NOT NULL | true |  |
| 16 | `created_at` | timestamptz | NOT NULL | now() |  |
| 17 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 18 | `scope_type` | text | NOT NULL | 'user'::text |  |
| 19 | `reconnect_attempts` | integer | NOT NULL | 0 |  |
| 20 | `reconnect_next_at` | timestamptz |  |  |  |
| 21 | `reconnect_max_attempts` | integer | NOT NULL | 5 |  |
| 22 | `reconnect_base_delay_seconds` | integer | NOT NULL | 300 |  |
| 23 | `reconnect_required` | boolean | NOT NULL | false |  |
| 24 | `reconnect_last_error` | text |  |  |  |

**Índices únicos:**
- `(user_id, provider, email)`


### `email_suppressions`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `email` | text | NOT NULL |  |  |
| 4 | `reason` | text | NOT NULL |  |  |
| 5 | `source_campaign_id` | uuid |  |  | → `campaigns.id` (ON DELETE SET NULL) |
| 6 | `source_recipient_id` | uuid |  |  |  |
| 7 | `notes` | text |  |  |  |
| 8 | `created_at` | timestamptz | NOT NULL | now() |  |
| 9 | `updated_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(organization_id, email)`


### `email_sync_log`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `email_account_id` | uuid | NOT NULL |  | → `email_accounts.id` (ON DELETE CASCADE) |
| 3 | `organization_id` | uuid | NOT NULL |  |  |
| 4 | `scope_type` | text | NOT NULL |  |  |
| 5 | `provider` | text | NOT NULL |  |  |
| 6 | `status` | text | NOT NULL |  |  |
| 7 | `scanned` | integer |  |  |  |
| 8 | `inserted` | integer |  |  |  |
| 9 | `attempt` | integer |  |  |  |
| 10 | `max_attempts` | integer |  |  |  |
| 11 | `next_retry_at` | timestamptz |  |  |  |
| 12 | `reconnect_required` | boolean | NOT NULL | false |  |
| 13 | `fatal` | boolean |  |  |  |
| 14 | `skipped_reason` | text |  |  |  |
| 15 | `error_message` | text |  |  |  |
| 16 | `duration_ms` | integer |  |  |  |
| 17 | `created_at` | timestamptz | NOT NULL | now() |  |


## Automação / Workflows


### `workflows`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `name` | text | NOT NULL |  |  |
| 3 | `description` | text |  |  |  |
| 4 | `status` | workflow_status | NOT NULL | 'draft'::workflow_status |  |
| 5 | `steps` | jsonb | NOT NULL | '[]'::jsonb |  |
| 6 | `config` | jsonb | NOT NULL | '{}'::jsonb |  |
| 7 | `leads_processed` | integer |  | 0 |  |
| 8 | `leads_qualified` | integer |  | 0 |  |
| 9 | `success_rate` | numeric |  | 0 |  |
| 10 | `last_run_at` | timestamptz |  |  |  |
| 11 | `created_at` | timestamptz | NOT NULL | now() |  |
| 12 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 13 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 14 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |
| 15 | `deleted_at` | timestamptz |  |  |  |


### `workflow_runs`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `workflow_id` | uuid | NOT NULL |  | → `workflows.id` (ON DELETE CASCADE) |
| 3 | `status` | text | NOT NULL | 'pending'::text |  |
| 4 | `current_step` | text |  |  |  |
| 5 | `results` | jsonb |  | '{}'::jsonb |  |
| 6 | `error_message` | text |  |  |  |
| 7 | `started_at` | timestamptz |  | now() |  |
| 8 | `completed_at` | timestamptz |  |  |  |
| 9 | `created_at` | timestamptz | NOT NULL | now() |  |
| 10 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 11 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `automation_steps`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `job_id` | uuid |  |  | → `scrape_jobs.id` (ON DELETE CASCADE) |
| 3 | `run_id` | uuid |  |  | → `workflow_runs.id` (ON DELETE CASCADE) |
| 4 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 5 | `name` | text | NOT NULL |  |  |
| 6 | `status` | automation_status |  | 'pending'::automation_status |  |
| 7 | `message` | text |  |  |  |
| 8 | `payload` | jsonb |  |  |  |
| 9 | `error_stack` | text |  |  |  |
| 10 | `started_at` | timestamptz |  | now() |  |
| 11 | `completed_at` | timestamptz |  |  |  |
| 12 | `created_at` | timestamptz |  | now() |  |
| 13 | `updated_at` | timestamptz |  | now() |  |


### `automation_execution_logs`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `user_id` | uuid |  |  |  |
| 4 | `workflow_id` | uuid |  |  |  |
| 5 | `run_id` | uuid |  |  |  |
| 6 | `scrape_job_id` | uuid |  |  |  |
| 7 | `queue_task_id` | uuid |  |  |  |
| 8 | `source` | text | NOT NULL | 'system'::text |  |
| 9 | `step_name` | text |  |  |  |
| 10 | `step_index` | integer |  |  |  |
| 11 | `phase` | text | NOT NULL | 'execute'::text |  |
| 12 | `status` | text | NOT NULL | 'started'::text |  |
| 13 | `level` | text | NOT NULL | 'info'::text |  |
| 14 | `message` | text |  |  |  |
| 15 | `failure_reason` | text |  |  |  |
| 16 | `error_detail` | text |  |  |  |
| 17 | `http_status` | integer |  |  |  |
| 18 | `transient` | boolean |  |  |  |
| 19 | `duration_ms` | integer |  |  |  |
| 20 | `attempt` | integer |  |  |  |
| 21 | `max_attempts` | integer |  |  |  |
| 22 | `correlation_id` | uuid |  |  |  |
| 23 | `worker_id` | text |  |  |  |
| 24 | `metadata` | jsonb | NOT NULL | '{}'::jsonb |  |
| 25 | `created_at` | timestamptz | NOT NULL | now() |  |


### `automation_alerts`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL |  | → `users.id` (ON DELETE CASCADE) |
| 3 | `organization_id` | uuid |  |  | → `organizations.id` (ON DELETE CASCADE) |
| 4 | `event_type` | text | NOT NULL |  |  |
| 5 | `delivery_method` | text | NOT NULL |  |  |
| 6 | `is_active` | boolean |  | true |  |
| 7 | `created_at` | timestamptz |  | now() |  |
| 8 | `updated_at` | timestamptz |  | now() |  |


## Integração / API


### `api_keys`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 3 | `name` | text | NOT NULL |  |  |
| 4 | `prefix` | text | NOT NULL |  |  |
| 5 | `key_hash` | text | NOT NULL |  |  |
| 6 | `scopes` | text[] | NOT NULL | ARRAY['read'::text] |  |
| 7 | `last_used_at` | timestamptz |  |  |  |
| 8 | `expires_at` | timestamptz |  |  |  |
| 9 | `active` | boolean | NOT NULL | true |  |
| 10 | `created_at` | timestamptz | NOT NULL | now() |  |
| 11 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |

**Índices únicos:**
- `(key_hash)`


### `webhooks`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL | auth.uid() |  |
| 3 | `name` | text | NOT NULL |  |  |
| 4 | `url` | text | NOT NULL |  |  |
| 5 | `secret` | text | NOT NULL | encode(extensions.gen_random_bytes(24), 'hex'::text) |  |
| 6 | `events` | text[] | NOT NULL | '{}'::text[] |  |
| 7 | `active` | boolean | NOT NULL | true |  |
| 8 | `total_sent` | integer | NOT NULL | 0 |  |
| 9 | `total_failed` | integer | NOT NULL | 0 |  |
| 10 | `last_triggered_at` | timestamptz |  |  |  |
| 11 | `created_at` | timestamptz | NOT NULL | now() |  |
| 12 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 13 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `webhook_deliveries`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL |  |  |
| 3 | `webhook_id` | uuid | NOT NULL |  | → `webhooks.id` (ON DELETE CASCADE) |
| 4 | `event` | text | NOT NULL |  |  |
| 5 | `payload` | jsonb | NOT NULL |  |  |
| 6 | `status` | text | NOT NULL | 'pending'::text |  |
| 7 | `status_code` | integer |  |  |  |
| 8 | `response_body` | text |  |  |  |
| 9 | `error_message` | text |  |  |  |
| 10 | `attempts` | integer | NOT NULL | 0 |  |
| 11 | `next_retry_at` | timestamptz |  |  |  |
| 12 | `delivered_at` | timestamptz |  |  |  |
| 13 | `created_at` | timestamptz | NOT NULL | now() |  |
| 14 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `api_request_logs`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `api_key_id` | uuid |  |  |  |
| 3 | `api_key_prefix` | text |  |  |  |
| 4 | `organization_id` | uuid |  |  |  |
| 5 | `user_id` | uuid |  |  |  |
| 6 | `method` | text | NOT NULL |  |  |
| 7 | `path` | text | NOT NULL |  |  |
| 8 | `resource` | text |  |  |  |
| 9 | `status_code` | integer | NOT NULL |  |  |
| 10 | `duration_ms` | integer | NOT NULL |  |  |
| 11 | `ip_address` | text |  |  |  |
| 12 | `user_agent` | text |  |  |  |
| 13 | `error_message` | text |  |  |  |
| 14 | `created_at` | timestamptz | NOT NULL | now() |  |
| 15 | `trace_id` | uuid |  |  |  |


### `idempotency_keys`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `user_id` | uuid | NOT NULL |  | → `users.id` (ON DELETE CASCADE) |
| 3 | `key` | text | NOT NULL |  |  |
| 4 | `response_body` | jsonb | NOT NULL |  |  |
| 5 | `status_code` | integer | NOT NULL |  |  |
| 6 | `created_at` | timestamptz | NOT NULL | now() |  |

**Índices únicos:**
- `(user_id, key)`


## Observabilidade


### `audit_logs`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `actor_id` | uuid |  |  |  |
| 3 | `table_name` | text | NOT NULL |  |  |
| 4 | `record_id` | uuid | NOT NULL |  |  |
| 5 | `action` | audit_action | NOT NULL |  |  |
| 6 | `old_data` | jsonb |  |  |  |
| 7 | `new_data` | jsonb |  |  |  |
| 8 | `created_at` | timestamptz | NOT NULL | now() |  |
| 9 | `organization_id` | uuid |  |  |  |
| 10 | `metadata` | jsonb |  | '{}'::jsonb |  |
| 11 | `trace_id` | uuid |  |  |  |


### `notifications`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `type` | text | NOT NULL | 'system'::text |  |
| 3 | `title` | text | NOT NULL |  |  |
| 4 | `message` | text | NOT NULL |  |  |
| 5 | `read` | boolean | NOT NULL | false |  |
| 6 | `metadata` | jsonb |  | '{}'::jsonb |  |
| 7 | `created_at` | timestamptz | NOT NULL | now() |  |
| 8 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 9 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `feature_flags`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 6 | `created_at` | timestamptz | NOT NULL | now() |  |
| 7 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 8 | `organization_id` | uuid |  |  |  |
| 9 | `flag_key` | text |  |  |  |
| 10 | `is_enabled` | boolean |  | false |  |
| 11 | `config` | jsonb |  | '{}'::jsonb |  |

**Índices únicos:**
- `(flag_key)`


### `ipc_config`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `name` | text | NOT NULL | 'default'::text |  |
| 3 | `criteria` | jsonb | NOT NULL | '{}'::jsonb |  |
| 4 | `is_active` | boolean |  | true |  |
| 5 | `created_at` | timestamptz | NOT NULL | now() |  |
| 6 | `updated_at` | timestamptz | NOT NULL | now() |  |
| 7 | `user_id` | uuid | NOT NULL | auth.uid() | → `users.id` (ON DELETE CASCADE) |
| 8 | `organization_id` | uuid | NOT NULL | default_org_for_current_user() |  |


### `health_checks`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `service_name` | text | NOT NULL |  |  |
| 3 | `status` | text | NOT NULL |  |  |
| 4 | `latency_ms` | integer |  |  |  |
| 5 | `last_check` | timestamptz | NOT NULL | now() |  |
| 6 | `metadata` | jsonb |  | '{}'::jsonb |  |


### `db_health_snapshots`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `captured_at` | timestamptz | NOT NULL | now() |  |
| 3 | `active_connections` | integer | NOT NULL |  |  |
| 4 | `max_connections` | integer | NOT NULL |  |  |
| 5 | `connection_pct` | numeric | NOT NULL |  |  |
| 6 | `db_size_bytes` | bigint | NOT NULL |  |  |
| 7 | `postmaster_start` | timestamptz | NOT NULL |  |  |
| 8 | `restart_detected` | boolean | NOT NULL | false |  |
| 9 | `commits` | bigint | NOT NULL | 0 |  |
| 10 | `rollbacks` | bigint | NOT NULL | 0 |  |
| 11 | `deadlocks` | bigint | NOT NULL | 0 |  |
| 12 | `cache_hit_ratio` | numeric | NOT NULL | 0 |  |
| 13 | `longest_query_secs` | numeric | NOT NULL | 0 |  |


### `api_latency_snapshots`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `path` | text | NOT NULL |  |  |
| 4 | `requests` | bigint | NOT NULL | 0 |  |
| 5 | `errors` | bigint | NOT NULL | 0 |  |
| 6 | `error_rate` | numeric | NOT NULL | 0 |  |
| 7 | `p50_ms` | numeric | NOT NULL | 0 |  |
| 8 | `p95_ms` | numeric | NOT NULL | 0 |  |
| 9 | `p99_ms` | numeric | NOT NULL | 0 |  |
| 10 | `captured_at` | timestamptz | NOT NULL | now() |  |


### `dlq_health_snapshots`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `organization_id` | uuid | NOT NULL |  | → `organizations.id` (ON DELETE CASCADE) |
| 3 | `captured_at` | timestamptz | NOT NULL | now() |  |
| 4 | `total_items` | bigint | NOT NULL | 0 |  |
| 5 | `pending_items` | bigint | NOT NULL | 0 |  |
| 6 | `replayed_items` | bigint | NOT NULL | 0 |  |
| 7 | `oldest_pending_age_secs` | numeric | NOT NULL | 0 |  |


### `vault_cookie_snapshots`
**PK:** `id`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `id` | uuid | NOT NULL | gen_random_uuid() |  |
| 2 | `servico` | text | NOT NULL |  |  |
| 3 | `is_healthy` | boolean |  |  |  |
| 4 | `health_status` | text |  |  |  |
| 5 | `expires_at` | timestamptz |  |  |  |
| 6 | `days_until_expiry` | integer |  |  |  |
| 7 | `vault_available` | boolean | NOT NULL | true |  |
| 8 | `error_message` | text |  |  |  |
| 9 | `checked_at` | timestamptz | NOT NULL | now() |  |


### `circuit_breakers`
**PK:** `service_name`  

| # | Coluna | Tipo | Null | Default | FK |
|---|--------|------|------|---------|----|
| 1 | `service_name` | text | NOT NULL |  |  |
| 2 | `state` | text | NOT NULL | 'closed'::text |  |
| 3 | `failure_count` | integer |  | 0 |  |
| 4 | `last_failure_at` | timestamptz |  |  |  |
| 5 | `opened_at` | timestamptz |  |  |  |
| 6 | `threshold` | integer |  | 5 |  |
| 7 | `reset_timeout_ms` | integer |  | 60000 |  |

**Índices únicos:**
- `(service_name)`

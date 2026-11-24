-- Baseline de drift: objetos aplicados direto em producao (advisors do Supabase + hotfixes)
-- que nunca foram versionados. Sem esta migration, um rebuild do banco perde 48 objetos
-- (38 indices de performance, 7 policies de RLS e 3 triggers de updated_at).
-- Extraido de pg_get_indexdef / pg_policies / pg_get_triggerdef em 2026-11-23.
-- Idempotente: IF NOT EXISTS nos indices, DROP ... IF EXISTS antes de policy/trigger.

-- ============ INDICES (38) ============
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_brin ON public.api_request_logs USING brin (created_at) WITH (pages_per_range='32');
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_occurred ON public.campaign_events USING btree (campaign_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_messages_recipient_step_unique ON public.campaign_messages USING btree (recipient_id, step_index);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status ON public.campaign_recipients USING btree (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign_received ON public.campaign_replies USING btree (campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_user_id_ipc_score ON public.companies USING btree (user_id, ipc_score DESC);
CREATE INDEX IF NOT EXISTS idx_company_reviews_organization_id ON public.company_reviews USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_organization_id ON public.dashboard_layouts USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_org_scope ON public.email_accounts USING btree (organization_id, scope_type);
CREATE INDEX IF NOT EXISTS idx_email_sync_log_created_brin ON public.email_sync_log USING brin (created_at) WITH (pages_per_range='32');
CREATE INDEX IF NOT EXISTS idx_ig_queue_sla_due ON public.instagram_scrape_queue USING btree (status, next_run_at, created_at, sla_seconds);
CREATE INDEX IF NOT EXISTS idx_instagram_scrape_queue_created_by ON public.instagram_scrape_queue USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_lc_linkedin_url_org ON public.lusha_contacts USING btree (organization_id, linkedin_url) WHERE (linkedin_url IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lss_bitrix ON public.lusha_search_sessions USING btree (bitrix_card_id) WHERE (bitrix_card_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lss_company ON public.lusha_search_sessions USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_lss_created ON public.lusha_search_sessions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lss_status ON public.lusha_search_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_bitrix_contact_id ON public.lusha_contacts USING btree (bitrix_contact_id) WHERE ((bitrix_contact_id IS NOT NULL) AND (bitrix_contact_id <> ''::text));
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_company_id ON public.lusha_contacts USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_dedup_hash ON public.lusha_contacts USING btree (dedup_hash) WHERE ((dedup_hash IS NOT NULL) AND (dedup_hash <> ''::text));
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_linkedin_cache ON public.lusha_contacts USING btree (lower(rtrim(btrim(linkedin_url), '/'::text)), last_enriched_at DESC) WHERE ((linkedin_url IS NOT NULL) AND (btrim(linkedin_url) <> ''::text) AND (last_enriched_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_org_status_queue ON public.lusha_contacts USING btree (organization_id, enrichment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_push_queue ON public.lusha_contacts USING btree (organization_id, enrichment_status) WHERE (enrichment_status = ANY (ARRAY['enriched'::text, 'pushing_bitrix'::text, 'error_bitrix'::text]));
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_session_id ON public.lusha_contacts USING btree (session_id, created_at DESC) WHERE (session_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_stakeholder_id ON public.lusha_contacts USING btree (stakeholder_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lusha_contacts_unique_per_org ON public.lusha_contacts USING btree (organization_id, lower(rtrim(btrim(linkedin_url), '/'::text))) WHERE ((linkedin_url IS NOT NULL) AND (btrim(linkedin_url) <> ''::text));
CREATE INDEX IF NOT EXISTS idx_lusha_contacts_user ON public.lusha_contacts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_lusha_sessions_user ON public.lusha_search_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_next_best_actions_stakeholder_id ON public.next_best_actions USING btree (stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_org_retry_policies_source_advisory_id ON public.org_retry_policies USING btree (source_advisory_id);
CREATE INDEX IF NOT EXISTS idx_org_retry_policies_updated_by ON public.org_retry_policies USING btree (updated_by);
CREATE INDEX IF NOT EXISTS idx_retry_policy_advisories_applied_by ON public.retry_policy_advisories USING btree (applied_by);
CREATE INDEX IF NOT EXISTS idx_retry_policy_advisories_rolled_back_by ON public.retry_policy_advisories USING btree (rolled_back_by);
CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_company_id ON public.satisfaction_responses USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_organization_id ON public.scheduled_reports USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_org_status ON public.scrape_jobs USING btree (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_scrape_queue_org_status ON public.scrape_queue USING btree (organization_id, status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scrape_results_org_created ON public.scrape_results USING btree (organization_id, created_at DESC);

-- ============ POLICIES DE RLS (7) ============
DROP POLICY IF EXISTS "Serviço interno apenas" ON public.auth_rate_limits;
CREATE POLICY "Serviço interno apenas" ON public.auth_rate_limits FOR ALL TO public USING (false);

DROP POLICY IF EXISTS "Users can delete automation steps for their organization" ON public.automation_steps;
CREATE POLICY "Users can delete automation steps for their organization" ON public.automation_steps FOR DELETE TO public USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can view their org feature flags" ON public.feature_flags;
CREATE POLICY "Users can view their org feature flags" ON public.feature_flags FOR SELECT TO public USING ((auth.uid() IN ( SELECT organization_members.user_id
   FROM organization_members
  WHERE (organization_members.organization_id = feature_flags.organization_id))));

DROP POLICY IF EXISTS "Public can view health status" ON public.health_checks;
CREATE POLICY "Public can view health status" ON public.health_checks FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can delete settings" ON public.org_violation_alert_settings;
CREATE POLICY "Admins can delete settings" ON public.org_violation_alert_settings FOR DELETE TO authenticated USING (has_org_role(organization_id, auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "queue_sla_defaults_admin_delete" ON public.queue_sla_defaults;
CREATE POLICY "queue_sla_defaults_admin_delete" ON public.queue_sla_defaults FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "sla_alert_settings_admin_delete" ON public.sla_alert_settings;
CREATE POLICY "sla_alert_settings_admin_delete" ON public.sla_alert_settings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ TRIGGERS (3) ============
DROP TRIGGER IF EXISTS trg_lc_updated_at ON public.lusha_contacts;
CREATE TRIGGER trg_lc_updated_at BEFORE UPDATE ON public.lusha_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_lss_updated_at ON public.lusha_search_sessions;
CREATE TRIGGER trg_lss_updated_at BEFORE UPDATE ON public.lusha_search_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_rate_limits_updated_at ON public.auth_rate_limits;
CREATE TRIGGER update_auth_rate_limits_updated_at BEFORE UPDATE ON public.auth_rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

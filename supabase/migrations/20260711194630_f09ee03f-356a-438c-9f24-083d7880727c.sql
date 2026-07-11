ALTER TABLE public.workflow_runs
  ADD CONSTRAINT workflow_runs_status_check
  CHECK (status IN ('pending','queued','running','completed','failed','cancelled'));

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('system','signal','scrape','enrichment','discovery'));

ALTER TABLE public.circuit_breakers
  ADD CONSTRAINT circuit_breakers_state_check
  CHECK (state IN ('closed','open','half-open'));

ALTER TABLE public.health_checks
  ADD CONSTRAINT health_checks_status_check
  CHECK (status IN ('healthy','degraded','unhealthy'));

ALTER TABLE public.intent_signals
  ADD CONSTRAINT intent_signals_type_check
  CHECK (type IN ('website_visit','hiring','funding','tech_adoption','content_engagement'));

ALTER TABLE public.job_exports
  ADD CONSTRAINT job_exports_status_check
  CHECK (status IN ('pending','processing','ready','failed'));
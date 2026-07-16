ALTER TABLE public.scrape_queue ALTER COLUMN max_attempts SET DEFAULT 6;
ALTER TABLE public.scrape_queue ALTER COLUMN base_delay_secs SET DEFAULT 5;
ALTER TABLE public.scrape_queue ALTER COLUMN max_delay_secs SET DEFAULT 300;

INSERT INTO public.feature_flags (flag_key, is_enabled, config)
VALUES (
  'use_places_api_new',
  false,
  jsonb_build_object(
    'description', 'Melhoria #3 — usa Places API (New) oficial em vez de scraping HTML. Requer conector Google Maps linkado.',
    'requires_connector', 'google_maps'
  )
)
ON CONFLICT (flag_key) DO NOTHING;

-- Bucket privado dos arquivos exportados de leads.
--
-- O cliente nao acessa o bucket: a edge function export-scrape-job grava e le o
-- objeto com a service role, depois de autorizar o dono pela RLS de job_exports.
-- Nao existe policy em storage.objects de proposito - sem policy, anon e
-- authenticated ficam negados por padrao (fail-closed) e o arquivo so sai pela
-- function, que checa o dono da linha em job_exports antes de entregar.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-exports', 'job-exports', false, 52428800, ARRAY['text/csv'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- job_exports.file_url passa a guardar o caminho do objeto no bucket (ex.:
-- <user_id>/<job_id>/<export_id>.csv) e nao uma URL assinada, que expira.
COMMENT ON COLUMN public.job_exports.file_url IS
  'Caminho do objeto no bucket privado job-exports. Nulo quando o upload falhou ou em exportacoes anteriores ao bucket.';

-- Grants explicitos: a exportacao le e grava o historico com o JWT do usuario
-- (a RLS ja limita a propria linha). Idempotente e nao depende dos default
-- privileges do projeto, que nao sao versionados.
GRANT SELECT, INSERT, UPDATE ON public.job_exports TO authenticated;
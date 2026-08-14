-- Audit trail for administrator-only Jarvis GitHub automation.

CREATE TABLE IF NOT EXISTS public.jarvis_github_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_text text NOT NULL CHECK (char_length(request_text) BETWEEN 12 AND 2000),
  repository text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'copilot_queued', 'issue_created', 'failed')),
  github_issue_number bigint,
  github_external_id text,
  github_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jarvis_github_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jarvis_github_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.jarvis_github_requests TO authenticated;
GRANT ALL ON public.jarvis_github_requests TO service_role;

DROP POLICY IF EXISTS "jarvis github: admin reads" ON public.jarvis_github_requests;
CREATE POLICY "jarvis github: admin reads"
ON public.jarvis_github_requests
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_jarvis_github_requests_created
  ON public.jarvis_github_requests (created_at DESC);

DROP TRIGGER IF EXISTS trg_jarvis_github_requests_updated_at ON public.jarvis_github_requests;
CREATE TRIGGER trg_jarvis_github_requests_updated_at
BEFORE UPDATE ON public.jarvis_github_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

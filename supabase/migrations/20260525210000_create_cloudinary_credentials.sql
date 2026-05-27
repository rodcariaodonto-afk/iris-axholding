-- Migration: Cloudinary credentials for product image uploads
-- Replaces n8n workflow "Subir Produtos Cloudinary"

CREATE TABLE IF NOT EXISTS public.cloudinary_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL UNIQUE,
  cloud_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  upload_tag TEXT DEFAULT 'loja_filhos_com_estilo',
  last_sync_at TIMESTAMPTZ,
  last_sync_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cloudinary_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on cloudinary_credentials"
  ON public.cloudinary_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Track per-product upload status (so we can resume / skip already-uploaded images)
ALTER TABLE public.produtos_catalogo
  ADD COLUMN IF NOT EXISTS cloudinary_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_cloudinary_uploaded
  ON public.produtos_catalogo (cloudinary_uploaded_at);

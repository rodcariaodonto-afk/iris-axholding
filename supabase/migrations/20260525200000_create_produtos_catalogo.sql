-- Migration: Create produtos_catalogo table for Bling product catalog sync
-- Replaces n8n workflow "Sincronizar Catalogo Bling -> Postgres"

CREATE TABLE IF NOT EXISTS public.produtos_catalogo (
  id BIGSERIAL PRIMARY KEY,
  bling_id BIGINT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  codigo TEXT,
  preco NUMERIC(12,2) DEFAULT 0,
  preco_promocional NUMERIC(12,2) DEFAULT 0,
  estoque NUMERIC(12,2) DEFAULT 0,
  disponivel BOOLEAN DEFAULT false,
  descricao_curta TEXT,
  imagem_bling TEXT,
  imagem_cloudinary TEXT,
  marca TEXT,
  categoria TEXT,
  situacao TEXT DEFAULT 'Ativo',
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_nome_normalizado
  ON public.produtos_catalogo USING gin (nome_normalizado gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_bling_id
  ON public.produtos_catalogo (bling_id);

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_disponivel
  ON public.produtos_catalogo (disponivel);

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_categoria
  ON public.produtos_catalogo (categoria);

-- Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RLS: allow service role full access, authenticated read
ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on produtos_catalogo"
  ON public.produtos_catalogo
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read produtos_catalogo"
  ON public.produtos_catalogo
  FOR SELECT
  TO authenticated
  USING (true);

-- Function for normalized product search with scoring
CREATE OR REPLACE FUNCTION public.buscar_produtos(p_consulta TEXT, p_limit INT DEFAULT 15)
RETURNS TABLE (
  id BIGINT,
  bling_id BIGINT,
  nome TEXT,
  codigo TEXT,
  preco NUMERIC,
  preco_promocional NUMERIC,
  estoque NUMERIC,
  disponivel BOOLEAN,
  descricao_curta TEXT,
  imagem_cloudinary TEXT,
  marca TEXT,
  categoria TEXT,
  score INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  consulta_normalizada TEXT;
  palavras TEXT[];
  palavra TEXT;
  sql_query TEXT;
  score_expr TEXT;
  where_clauses TEXT[];
BEGIN
  -- Normalize the search query (same logic as n8n workflow)
  consulta_normalizada := lower(unaccent(p_consulta));
  consulta_normalizada := regexp_replace(consulta_normalizada, '[^a-z0-9\s]', '', 'g');
  consulta_normalizada := regexp_replace(consulta_normalizada, '\s+', ' ', 'g');
  consulta_normalizada := trim(consulta_normalizada);

  -- Split into words
  palavras := string_to_array(consulta_normalizada, ' ');

  -- Build WHERE clauses (each word must match somewhere)
  where_clauses := ARRAY[]::TEXT[];
  FOREACH palavra IN ARRAY palavras
  LOOP
    IF length(palavra) > 1 THEN
      where_clauses := array_append(where_clauses,
        format('nome_normalizado ILIKE %L', '%' || palavra || '%'));
    END IF;
  END LOOP;

  IF array_length(where_clauses, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Build scoring expression
  score_expr := '0';
  FOREACH palavra IN ARRAY palavras
  LOOP
    IF length(palavra) > 1 THEN
      score_expr := score_expr || format(
        ' + CASE WHEN nome_normalizado = %1$L THEN 100 '
        'WHEN nome_normalizado ILIKE %2$L THEN 50 '
        'WHEN nome_normalizado ILIKE %3$L THEN 30 '
        'ELSE 0 END',
        palavra,
        palavra || '%',
        '%' || palavra || '%'
      );
    END IF;
  END LOOP;

  -- Add availability bonus
  score_expr := '(' || score_expr || ') + CASE WHEN disponivel THEN 40 ELSE 0 END';

  sql_query := format(
    'SELECT p.id, p.bling_id, p.nome, p.codigo, p.preco, p.preco_promocional, '
    'p.estoque, p.disponivel, p.descricao_curta, p.imagem_cloudinary, '
    'p.marca, p.categoria, (%s)::INT as score '
    'FROM public.produtos_catalogo p '
    'WHERE %s '
    'ORDER BY score DESC, p.nome ASC '
    'LIMIT %s',
    score_expr,
    array_to_string(where_clauses, ' AND '),
    p_limit
  );

  RETURN QUERY EXECUTE sql_query;
END;
$$;

-- Enable unaccent extension for text normalization
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Bling ERP credentials table (OAuth2 tokens)
CREATE TABLE IF NOT EXISTS public.bling_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bling_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bling_credentials"
  ON public.bling_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RPC to truncate produtos_catalogo (used by sync function)
CREATE OR REPLACE FUNCTION public.truncate_produtos_catalogo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE public.produtos_catalogo RESTART IDENTITY;
END;
$$;

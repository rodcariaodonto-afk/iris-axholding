
-- Create media_library table
CREATE TABLE public.media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'document',
  file_name TEXT,
  file_size BIGINT,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- Admins can manage, authenticated can read
CREATE POLICY "Admins can manage media_library"
ON public.media_library
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read media_library"
ON public.media_library
FOR SELECT
TO authenticated
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_media_library_updated_at
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

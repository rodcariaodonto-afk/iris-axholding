
-- Create media-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-files', 'media-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for media-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media-files');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload for media-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media-files');

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access for media-files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'media-files')
WITH CHECK (bucket_id = 'media-files');

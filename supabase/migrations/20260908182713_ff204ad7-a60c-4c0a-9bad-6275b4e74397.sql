CREATE POLICY "Authenticated read content research"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'content-research');

CREATE POLICY "Authenticated upload content research"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'content-research');

CREATE POLICY "Authenticated update content research"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'content-research');

CREATE POLICY "Authenticated delete content research"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'content-research');
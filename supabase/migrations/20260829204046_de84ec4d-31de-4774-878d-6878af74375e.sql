CREATE POLICY "instagram media read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'instagram-media');
CREATE POLICY "instagram media insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'instagram-media');
CREATE POLICY "instagram media update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'instagram-media') WITH CHECK (bucket_id = 'instagram-media');
CREATE POLICY "instagram media delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'instagram-media');
-- READ ONLY inventory; run after Cloud resumes. No ownership guess or data mutation.
SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage');
SELECT tc.table_name,kcu.column_name,ccu.table_name AS parent_table,ccu.column_name AS parent_column
FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public';
SELECT 'content_bank' AS table_name,id::text AS resource_id FROM public.content_bank
UNION ALL SELECT 'content_logs',id::text FROM public.content_logs
UNION ALL SELECT 'content_downloads',id::text FROM public.content_downloads;
SELECT bucket_id,name,owner_id FROM storage.objects WHERE bucket_id IN ('instagram-media','viral-sources','content-research');
-- Safe to inspect missing owners on all current owned tables.
DO $$ DECLARE tab record; total bigint; BEGIN
 FOR tab IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id' LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id IS NULL',tab.table_name) INTO total;
  RAISE NOTICE 'missing ownership: % = %',tab.table_name,total;
 END LOOP;
END $$;

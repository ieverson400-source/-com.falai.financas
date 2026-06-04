
-- 1. Lock down whatsapp_unmapped_numbers: only service_role (which bypasses RLS) should read/write
DROP POLICY IF EXISTS "Authenticated can view unmapped numbers" ON public.whatsapp_unmapped_numbers;

-- 2. Remove public listing of avatars bucket. Public URLs still work for direct file access.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- 3. Revoke execute on SECURITY DEFINER function from client roles (trigger usage is unaffected)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

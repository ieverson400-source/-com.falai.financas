CREATE OR REPLACE FUNCTION public.protect_advertiser_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can change advertiser status';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_advertiser_status BEFORE UPDATE ON public.advertisers
FOR EACH ROW EXECUTE FUNCTION public.protect_advertiser_status();

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE user_id = _user_id), true);
$$;
CREATE POLICY "Blocked accounts have no expense access" ON public.expenses
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_account_active(auth.uid()))
WITH CHECK (public.is_account_active(auth.uid()));
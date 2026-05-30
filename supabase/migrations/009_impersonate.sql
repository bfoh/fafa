-- Migration 009: Impersonate Tenant
ALTER TABLE public.platform_admins 
  ADD COLUMN IF NOT EXISTS impersonating_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Update public.tenant_id() to support platform admin impersonation
CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS UUID AS $$
DECLARE
    v_impersonated_id UUID;
BEGIN
    -- Check if user is a platform admin and is impersonating
    SELECT impersonating_tenant_id INTO v_impersonated_id
    FROM public.platform_admins
    WHERE user_id = auth.uid();
    
    IF v_impersonated_id IS NOT NULL THEN
        RETURN v_impersonated_id;
    END IF;

    RETURN COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::UUID,
      public.get_user_tenant_id()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

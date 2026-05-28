-- ============================================================
-- Migration 006: Fix RLS recursion on tenant_members
-- ============================================================

-- Create a helper function with SECURITY DEFINER to check if user is tenant owner
CREATE OR REPLACE FUNCTION public.is_tenant_owner(t_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = t_id
        AND user_id = auth.uid()
        AND role = 'owner'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the old policy that caused infinite recursion
DROP POLICY IF EXISTS "Owners can manage tenant members" ON tenant_members;

-- Re-create the policy using the security definer function to avoid recursion
CREATE POLICY "Owners can manage tenant members"
ON tenant_members FOR ALL
USING (
    tenant_id = public.tenant_id()
    AND public.is_tenant_owner(public.tenant_id())
);

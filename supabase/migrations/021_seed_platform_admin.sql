-- Grant platform super-admin to the founder account. Idempotent and safe to
-- re-run: it no-ops if the user doesn't exist yet or is already an admin.
-- Update the email below to grant additional admins.

INSERT INTO platform_admins (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'bfoh2g@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

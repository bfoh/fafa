import tseslint from 'typescript-eslint';

/**
 * GUARDRAIL config. Intentionally minimal (no next/* extends — those hit a
 * circular-structure bug under FlatCompat in ESLint 9). The point of this file
 * is one security rule: the mobile bundle must never pull server-only / secret
 * code across the cross-alias, so "no SUPABASE_SERVICE_ROLE_KEY in the binary"
 * is a static guarantee rather than a hope.
 */
export default tseslint.config(
  {
    ignores: ['out/**', '.next/**', 'node_modules/**', 'android/**', 'ios/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/lib/supabase/admin',
                '@/lib/supabase/server',
                '@/lib/supabase/middleware',
                '@/lib/paystack/client',
                '@/lib/orders/settle',
                '@/lib/notifications',
                '@/lib/notifications/*',
                '@/middleware',
              ],
              message:
                'Server-only/secret module — not allowed in the mobile bundle. Use an API route on apps/web instead.',
            },
          ],
        },
      ],
    },
  }
);

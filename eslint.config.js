import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'apps/web/**'] },
  ...tseslint.configs.recommended,
)

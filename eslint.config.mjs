import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dist-test/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The CLI is a thin, dynamic wrapper over the SDK's request bodies; `any`
      // at the API boundary is intentional (see the `--data` escape hatch).
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Empty catch blocks are used for best-effort operations (browser open,
      // keychain probe) and are documented with comments.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);

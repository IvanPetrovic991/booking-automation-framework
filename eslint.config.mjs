import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Mirrors .gitignore: flat config does not read it, and a local
    // `npm run report:merge` writes playwright-report/ next to reports/.
    ignores: [
      'node_modules/',
      'reports/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      '.healing/',
      'dist/',
    ],
  },
  ...tseslint.configs.recommended,
  {
    // Type-aware rules for the promise-safety bug class: a dropped `await`
    // on a locator action or async matcher silently passes the test.
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Playwright-specific lint for spec files (missing-playwright-await etc.).
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Conditional skips are deliberate here (bot-challenge and missing-
      // artifact guards) — only unconditional skips are a smell.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
    },
  },
  {
    // The docs screenshot suite drives pages to capture images — "no
    // assertions" is its normal shape, not a smell.
    files: ['scripts/**/*.ts'],
    rules: {
      'playwright/expect-expect': 'off',
    },
  },
);

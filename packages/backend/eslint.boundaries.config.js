/**
 * Boundary-only ESLint config (WO-034).
 * Used by `npm run lint:boundaries` so architectural rules are checked
 * without also failing on unrelated typed lint debt.
 */
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'eslint.config.js',
      'eslint.boundaries.config.js',
      'vitest.config.ts',
      '**/*.test.ts',
      '**/fixtures/**',
      '**/testHelpers/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    linterOptions: {
      // Main eslint.config.js owns typed rules / disable-directives.
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      boundaries,
      '@typescript-eslint': tseslint.plugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
      'boundaries/elements': [
        { type: 'controller', pattern: 'src/routes/**' },
        { type: 'service', pattern: 'src/services/**' },
        { type: 'model', pattern: 'src/models/**' },
        { type: 'repository', pattern: 'src/database/**' },
        { type: 'middleware', pattern: 'src/middleware/**' },
        { type: 'util', pattern: ['src/utils/**', 'src/lib/**'] },
        { type: 'config', pattern: 'src/config/**' },
      ],
      'boundaries/include': ['src/**/*.{ts,tsx,js,jsx}'],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { types: 'service' } },
              disallow: { to: { element: { types: 'controller' } } },
            },
            {
              from: { element: { types: 'model' } },
              disallow: {
                to: { element: { types: { anyOf: ['service', 'controller'] } } },
              },
            },
            {
              from: { element: { types: 'repository' } },
              disallow: { to: { element: { types: 'controller' } } },
            },
            {
              from: { element: { types: 'util' } },
              disallow: {
                to: { element: { types: { anyOf: ['service', 'controller'] } } },
              },
            },
          ],
        },
      ],
    },
  },
);

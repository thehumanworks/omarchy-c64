// Strict by design: the limits below are what keep every file small enough for
// an agent to hold in context. Do not raise them; split the file instead.
import js from '@eslint/js';
import { flatConfigs as importX } from 'eslint-plugin-import-x';
import globals from 'globals';

const SIZE_LIMITS = {
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
  complexity: ['error', 15],
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
  'max-nested-callbacks': ['error', 3],
};

const CORRECTNESS = {
  eqeqeq: ['error', 'always'],
  curly: ['error', 'multi-line'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-shadow': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-implicit-globals': 'error',
  'no-param-reassign': ['error', { props: false }],
  'no-return-assign': 'error',
  'no-sequences': 'error',
  'no-throw-literal': 'error',
  'prefer-template': 'error',
  'object-shorthand': 'error',
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'import-x/no-cycle': 'error',
  'import-x/no-unresolved': 'off',
  'import-x/no-duplicates': 'error',
  'import-x/first': 'error',
  'import-x/newline-after-import': 'error',
};

export default [
  {
    ignores: ['dist/**', 'vendor/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  importX.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: { ...SIZE_LIMITS, ...CORRECTNESS },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['build/**/*.{js,mjs}', 'test/**/*.{js,mjs}', '*.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off', 'max-lines-per-function': 'off', 'max-nested-callbacks': 'off' },
  },
];

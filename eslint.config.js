// Enforce dependency boundaries and complexity; split by responsibility, not
// line count. docs/ARCHITECTURE.md explains these layers and their contracts.
import js from '@eslint/js';
import { flatConfigs as importX } from 'eslint-plugin-import-x';
import globals from 'globals';

const COMPLEXITY_LIMITS = {
  complexity: ['error', 15],
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
  'max-nested-callbacks': ['error', 3],
};

const LAYERS = ['content', 'text', 'audio', 'screen', 'machine', 'scene', 'input', 'runtime'];
const CORE = [
  'src/content',
  'src/text',
  'src/machine',
  'src/screen/text-buffer.js',
  'src/scene/case.js',
];
const ZONES = [
  ...LAYERS.map((layer, i) => ({
    target: `./src/${layer}`,
    from: './src',
    except: LAYERS.slice(0, i + 1).map((name) => `./${name}`),
    message: 'Import down the layers; inject callbacks through src/main.js.',
  })),
  { target: CORE, from: './vendor', message: 'Keep the core independent of WebGL.' },
  {
    target: CORE,
    from: ['./src/screen/painter.js', './src/screen/logo.js'],
    message: 'Pass rendered assets into the core; do not import browser drawing code.',
  },
  {
    target: LAYERS.filter((name) => name !== 'content').map((name) => `./src/${name}`),
    from: './content',
    message: 'Receive normalized content through main.js instead of reading JSON directly.',
  },
  {
    target: ['./src/screen/text-buffer.js', './src/scene/case.js'],
    from: './src',
    except: ['./text'],
    message: 'Pure buffer and case maths must not depend on browser siblings.',
  },
];

const CORRECTNESS = {
  eqeqeq: ['error', 'always'],
  // No `curly`: its 'multi-line' mode ping-pongs with prettier (prettier wraps a
  // long one-line `if`, curly then demands braces) and 'all' is pure style.
  // Prettier owns layout; eslint owns meaning.
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
    ignores: [
      'dist/**',
      'vendor/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  importX.recommended,
  {
    files: ['**/*.{js,mjs}'],
    /* `latest`, not a pinned year: the content layer uses import attributes
       (`with { type: 'json' }`), which Node requires for JSON modules. */
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    linterOptions: { noInlineConfig: true },
    rules: { ...COMPLEXITY_LIMITS, ...CORRECTNESS },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    rules: { 'import-x/no-restricted-paths': ['error', { zones: ZONES }] },
  },
  {
    files: CORE.map((entry) => (entry.endsWith('.js') ? entry : `${entry}/**/*.js`)),
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'location'],
    },
  },
  {
    files: ['build/**/*.{js,mjs}', 'test/**/*.{js,mjs}', '*.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off', 'max-nested-callbacks': 'off' },
  },
  {
    /* e2e helpers run code inside the page through `page.evaluate`. */
    files: ['test/e2e/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];

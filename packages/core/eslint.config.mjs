import js from '@eslint/js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Apply the recommended rule set to every JS file we own.
  js.configs.recommended,

  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // The Playwright config file lives at the package root and runs on Node.
  {
    files: ['playwright.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Defaults for all files: latest ECMAScript modules.
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-implicit-coercion': ['error', { allow: ['!!'] }],
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },

  // Source code runs in browsers — DOM globals.
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Build / bundle scripts run on Node.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Vitest unit tests run under jsdom (browser globals + Vitest's own).
  {
    files: ['test/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
  },

  // Playwright specs — Node-side, but page.evaluate(() => {…}) callbacks
  // execute in the browser context, so also allow DOM globals.
  {
    files: ['test-browser/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  // Inline scripts in HTML fixtures don't go through ESLint.
];

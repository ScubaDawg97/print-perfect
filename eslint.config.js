const parser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'build/**',
      'dist/**',
      '.git/**',
      '.env*',
      'out/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Console logging is used intentionally for debugging throughout the codebase
      'no-console': 'off',
    },
  },
];

module.exports = config;

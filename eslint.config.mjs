import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: ['node_modules/', 'out/', 'dist/', 'release/', 'data/', 'test-results/', 'playwright-report/']
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    rules: {
      // `_name` marks an intentionally unused parameter/binding (e.g. IPC handlers that ignore the event)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },

  // Renderer: React in the browser
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser
    },
    settings: { react: { version: 'detect' } }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...react.configs.flat['jsx-runtime']
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // TypeScript already checks props
      'react/prop-types': 'off'
    }
  },

  // Main process, database, tests and tooling run in Node; preload and shared code see both worlds
  {
    files: ['src/main/**', 'src/database/**', 'tests/**', 'scripts/**', '*.config.{js,ts,mjs,cjs}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/preload/**', 'src/shared/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },

  // Formatting is Prettier's job: turn off every stylistic rule that could disagree with it
  prettier
)

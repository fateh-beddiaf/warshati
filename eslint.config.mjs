import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import eslintReact from '@eslint-react/eslint-plugin'
import prettier from 'eslint-config-prettier'
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
      // `_name` marks an intentionally unused parameter/binding (e.g. IPC handlers that ignore the event);
      // `const { omitted, ...rest } = obj` is the idiom for dropping fields
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true }
      ]
    }
  },

  // Renderer: React in the browser
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-typescript'],
    languageOptions: { globals: globals.browser },
    rules: {
      ...eslintReact.configs['recommended-typescript'].rules,
      // React 19 API migrations (forwardRef -> ref prop, useContext -> use, <Context.Provider> -> <Context>):
      // the old APIs still work; migrating ~40 components is a refactor of its own, not a lint fix
      '@eslint-react/no-forward-ref': 'off',
      '@eslint-react/no-use-context': 'off',
      '@eslint-react/no-context-provider': 'off',
      // Naming style only (e.g. `[language, setLanguageState]`)
      '@eslint-react/use-state': 'off',
      '@eslint-react/naming-convention-ref-name': 'off',
      // Same check as react-hooks/exhaustive-deps below; one rule keeps the disable comments in one place
      '@eslint-react/exhaustive-deps': 'off',
      // 29 existing effects sync state from props/IPC results. Moving that logic out of effects changes when
      // components re-render, so it needs its own change with UI testing, not a lint pass.
      '@eslint-react/set-state-in-effect': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
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
    // CommonJS: scripts, and the Tailwind/PostCSS configs (package.json has no "type": "module")
    files: ['**/*.cjs', 'tailwind.config.js', 'postcss.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },

  // Formatting is Prettier's job: turn off every stylistic rule that could disagree with it
  prettier
)

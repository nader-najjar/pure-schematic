import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['build/**', 'node_modules/**'] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    commaDangle: 'never',
    braceStyle: '1tbs',
    arrowParens: true
  }),
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@stylistic/max-len': ['error', { code: 120 }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error'
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [unicorn.configs.recommended, sonarjs.configs.recommended, reactHooks.configs.flat.recommended],
    rules: {
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/name-replacements': 'off',
      // Browser and React APIs use null as a meaningful value.
      'unicorn/no-null': 'off'
    }
  },
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  }
);

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'release'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);

import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import globals from 'globals';

export default defineConfig([
  expoConfig,
  {
    ignores: ['.expo/**', 'dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['__tests__/**/*.{ts,tsx}', 'jest.setup.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
]);

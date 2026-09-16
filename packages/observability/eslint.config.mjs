import base from '@nexora/config/eslint/base';

export default [
  ...base,
  {
    // This package IS the console wrapper; it is the one place allowed to use it.
    files: ['src/logger.ts'],
    rules: { 'no-console': 'off' },
  },
];

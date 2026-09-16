import base from '@nexora/config/eslint/base';

export default [
  ...base,
  {
    // The seed and its verification script are CLI tools: writing to stdout is
    // their entire purpose. The `no-console` rule stays in force everywhere
    // else in this package, including the runtime client.
    files: ['prisma/seed.ts', 'prisma/verify-seed.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Prisma's generated client is not ours to lint.
    ignores: ['src/generated/**'],
  },
];

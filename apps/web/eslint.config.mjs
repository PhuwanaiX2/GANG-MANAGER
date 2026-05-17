import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
});

const eslintConfig = [
    {
        ignores: ['node_modules/**', '.next/**', '.git/**', 'out/**', 'build/**', 'next-env.d.ts'],
    },
    ...compat.config({
        extends: ['next/core-web-vitals'],
        rules: {
            '@next/next/no-img-element': 'off',
            'react/no-unescaped-entities': 'off',
        },
    }),
];

export default eslintConfig;

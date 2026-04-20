import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./src/tests/setup.ts'],
        include: ['./src/tests/**/*.{test,spec}.ts'],
        exclude: ['./tests/e2e/**'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});

const { spawn } = require('node:child_process');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');

const projectDir = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(projectDir, '..', '..');
const nextCliPath = path.join(projectDir, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const hostname = process.env.PLAYWRIGHT_WEB_HOST || '127.0.0.1';
const port = process.env.PLAYWRIGHT_WEB_PORT || '3000';

loadEnvConfig(workspaceRoot);
loadEnvConfig(projectDir);

function applyProjectRuntimeEnv(keys) {
    for (const envFile of ['.env', '.env.local']) {
        const envPath = path.join(projectDir, envFile);
        if (!require('node:fs').existsSync(envPath)) {
            continue;
        }

        const text = require('node:fs').readFileSync(envPath, 'utf-8');
        for (const line of text.split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
            if (!match) {
                continue;
            }

            const [, key, rawValue] = match;
            if (keys.includes(key)) {
                process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
            }
        }
    }
}

applyProjectRuntimeEnv(['NEXTAUTH_SECRET', 'NEXTAUTH_URL']);

const noisePatterns = [
    'npm error code ENOWORKSPACES',
    'npm error This command does not support workspaces.',
    'npm error A complete log of this run can be found in:',
];

function shouldSuppress(line) {
    return noisePatterns.some((pattern) => line.includes(pattern));
}

function relayStream(stream, target) {
    let buffer = '';

    stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!shouldSuppress(line)) {
                target.write(`${line}\n`);
            }
        }
    });

    stream.on('end', () => {
        if (buffer && !shouldSuppress(buffer)) {
            target.write(buffer);
        }
    });
}

const child = spawn(process.execPath, [nextCliPath, 'dev', '-H', hostname, '-p', port], {
    cwd: projectDir,
    env: {
        ...process.env,
        NEXT_TEST_MODE: '1',
        NEXT_IGNORE_INCORRECT_LOCKFILE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
});

relayStream(child.stdout, process.stdout);
relayStream(child.stderr, process.stderr);

const shutdown = (signal) => {
    if (!child.killed) {
        child.kill(signal);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 0);
});

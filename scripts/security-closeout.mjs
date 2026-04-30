import { spawnSync } from 'node:child_process';
import process from 'node:process';

function parseArgs(argv) {
    const options = {
        help: false,
        webUrl: '',
        botUrl: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg.startsWith('--web-url=')) {
            options.webUrl = arg.slice('--web-url='.length).trim();
            continue;
        }

        if (arg === '--web-url') {
            options.webUrl = (argv[index + 1] ?? '').trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--bot-url=')) {
            options.botUrl = arg.slice('--bot-url='.length).trim();
            continue;
        }

        if (arg === '--bot-url') {
            options.botUrl = (argv[index + 1] ?? '').trim();
            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

function printHelp() {
    console.log('Usage: npm run security:verify -- [--web-url https://your-web] [--bot-url https://your-bot]');
    console.log('');
    console.log('Runs security closeout checks after secret rotation and environment rollout.');
    console.log('');
    console.log('What it checks:');
    console.log('  - production env contract');
    console.log('  - optional deployed web /api/health probe');
    console.log('  - optional deployed bot /health and /ready probes');
}

function runCommand(label, command) {
    console.log(`\n==> ${label}`);
    console.log(`$ ${command}`);

    const result = spawnSync(command, {
        cwd: process.cwd(),
        shell: true,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
    }
}

function joinUrl(baseUrl, path) {
    const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(path.replace(/^\//, ''), normalized).toString();
}

async function probeJson(label, url, validator) {
    console.log(`\n==> ${label}`);
    console.log(`GET ${url}`);

    const response = await fetch(url, {
        headers: {
            accept: 'application/json',
        },
    });

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error(`${label} did not return valid JSON`);
    }

    validator(response, payload);
    console.log(`✔ ${label} passed`);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    console.log('Security closeout verification started');

    runCommand('Validate production environment contract', 'npm run validate:env:prod');

    let webDatabaseFingerprint = null;
    let botDatabaseFingerprint = null;

    if (options.webUrl) {
        await probeJson('Web health probe', joinUrl(options.webUrl, '/api/health'), (response, payload) => {
            if (!response.ok) {
                throw new Error(`Web health probe returned ${response.status}`);
            }
            if (payload.status !== 'ok' || payload.app !== 'web' || payload.database !== 'up') {
                throw new Error(`Unexpected web health payload: ${JSON.stringify(payload)}`);
            }
            webDatabaseFingerprint = payload.diagnostics?.databaseFingerprint || null;
        });
    }

    if (options.botUrl) {
        await probeJson('Bot health probe', joinUrl(options.botUrl, '/health'), (response, payload) => {
            if (!response.ok) {
                throw new Error(`Bot health probe returned ${response.status}`);
            }
            if (payload.app !== 'bot') {
                throw new Error(`Unexpected bot health payload: ${JSON.stringify(payload)}`);
            }
            botDatabaseFingerprint = payload.diagnostics?.databaseFingerprint || null;
        });

        await probeJson('Bot readiness probe', joinUrl(options.botUrl, '/ready'), (response, payload) => {
            if (!response.ok) {
                throw new Error(`Bot readiness probe returned ${response.status}`);
            }
            if (payload.status !== 'ready' || payload.app !== 'bot') {
                throw new Error(`Unexpected bot readiness payload: ${JSON.stringify(payload)}`);
            }
        });
    }

    if (!options.webUrl && !options.botUrl) {
        console.log('\nNo remote URLs supplied. Only local env contract validation was executed.');
    }

    if (options.webUrl && options.botUrl) {
        if (webDatabaseFingerprint && botDatabaseFingerprint) {
            if (webDatabaseFingerprint !== botDatabaseFingerprint) {
                throw new Error(`Web/Bot database fingerprint mismatch: web=${webDatabaseFingerprint} bot=${botDatabaseFingerprint}`);
            }
            console.log(`\nWeb/Bot database fingerprint matches: ${webDatabaseFingerprint}`);
        } else {
            console.log('\nDatabase fingerprint comparison skipped. Set EXPOSE_HEALTH_DIAGNOSTICS=true on both Web and Bot to compare deployed DB targets without exposing secrets.');
        }
    }

    console.log('\nSecurity closeout verification passed');
}

main().catch((error) => {
    console.error('\nSecurity closeout verification failed');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});

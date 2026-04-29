import { spawnSync } from 'node:child_process';
import process from 'node:process';

function parseArgs(argv) {
    const options = {
        help: false,
        skipLocal: false,
        docker: false,
        webUrl: '',
        botUrl: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--skip-local') {
            options.skipLocal = true;
            continue;
        }

        if (arg === '--docker') {
            options.docker = true;
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
    console.log('Usage: npm run release:verify -- [--skip-local] [--docker] [--web-url https://your-web] [--bot-url https://your-bot]');
    console.log('');
    console.log('Runs pre-launch local checks and optional post-deploy health probes.');
    console.log('');
    console.log('Options:');
    console.log('  --skip-local            Skip local env/test/build checks and only run remote probes');
    console.log('  --docker                Build, start, and probe local Docker web/bot services');
    console.log('  --web-url <url>         Probe <url>/api/health after deployment');
    console.log('  --bot-url <url>         Probe <url>/health and <url>/ready after deployment');
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
    console.log(`OK ${label} passed`);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    console.log('Release readiness verification started');

    if (!options.skipLocal) {
        runCommand('Validate production environment contract', 'npm run validate:env:prod');
        runCommand('Audit runtime dependencies', 'npm run audit:runtime');
        runCommand('Audit gang role mapping uniqueness', 'npm run db:audit:role-mappings');
        runCommand('Preview subscription tier normalization', 'npm run db:normalize:tiers');
        runCommand('Run workspace test suites', 'npm run test');
        runCommand('Build workspaces', 'npm run build');
    }

    if (options.docker) {
        runCommand('Run Docker readiness verification', 'npm run docker:verify');
    }

    if (options.webUrl) {
        await probeJson('Web health probe', joinUrl(options.webUrl, '/api/health'), (response, payload) => {
            if (!response.ok) {
                throw new Error(`Web health probe returned ${response.status}`);
            }
            if (payload.status !== 'ok' || payload.app !== 'web' || payload.database !== 'up') {
                throw new Error(`Unexpected web health payload: ${JSON.stringify(payload)}`);
            }
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
        console.log('\nNo remote URLs supplied. Skipped post-deploy probes.');
    }

    console.log('\nRelease readiness verification passed');
}

main().catch((error) => {
    console.error('\nRelease readiness verification failed');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});

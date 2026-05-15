#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 10_000;

function parseArgs(argv) {
    const options = {
        webUrl: process.env.MONITOR_WEB_URL || process.env.WEB_URL || '',
        botUrl: process.env.MONITOR_BOT_URL || process.env.BOT_URL || '',
        alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
        alertWebhookToken: process.env.ALERT_WEBHOOK_TOKEN || '',
        timeoutMs: Number(process.env.MONITOR_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
        dryRun: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (arg === '--web-url') {
            options.webUrl = next || '';
            i += 1;
            continue;
        }
        if (arg === '--bot-url') {
            options.botUrl = next || '';
            i += 1;
            continue;
        }
        if (arg === '--alert-webhook-url') {
            options.alertWebhookUrl = next || '';
            i += 1;
            continue;
        }
        if (arg === '--timeout-ms') {
            options.timeoutMs = Number(next || DEFAULT_TIMEOUT_MS);
            i += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
        throw new Error('--timeout-ms must be a positive number');
    }

    return options;
}

function printHelp() {
    console.log('Usage: node scripts/monitor-production.mjs --web-url <url> --bot-url <url> [--alert-webhook-url <url>]');
    console.log('');
    console.log('Checks:');
    console.log('  web: <web-url>/api/health must return { status: "ok", app: "web" }');
    console.log('  bot: <bot-url>/health must return { status: "ok"|"ready", app: "bot" }');
    console.log('  bot: <bot-url>/ready must return { status: "ready", app: "bot" }');
}

function joinUrl(baseUrl, path) {
    return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function buildChecks(options) {
    const checks = [];

    if (options.webUrl) {
        checks.push({
            name: 'web health',
            url: joinUrl(options.webUrl, '/api/health'),
            validate: (payload) => payload?.status === 'ok' && payload?.app === 'web',
        });
    }

    if (options.botUrl) {
        checks.push({
            name: 'bot health',
            url: joinUrl(options.botUrl, '/health'),
            validate: (payload) => ['ok', 'ready'].includes(payload?.status) && payload?.app === 'bot',
        });
        checks.push({
            name: 'bot readiness',
            url: joinUrl(options.botUrl, '/ready'),
            validate: (payload) => payload?.status === 'ready' && payload?.app === 'bot',
        });
    }

    return checks;
}

async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        return { response, payload };
    } finally {
        clearTimeout(timeout);
    }
}

async function sendAlert(options, failures) {
    if (!options.alertWebhookUrl || failures.length === 0) {
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
    };
    if (options.alertWebhookToken) {
        headers.Authorization = `Bearer ${options.alertWebhookToken}`;
    }

    await fetch(options.alertWebhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'monitor',
            event: 'production.health_check_failed',
            failures,
        }),
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const checks = buildChecks(options);
    if (checks.length === 0) {
        throw new Error('No checks configured. Provide --web-url, --bot-url, or MONITOR_WEB_URL/MONITOR_BOT_URL.');
    }

    if (options.dryRun) {
        console.log(JSON.stringify({
            status: 'configured',
            checks: checks.map((check) => ({ name: check.name, url: check.url })),
            alerting: Boolean(options.alertWebhookUrl),
        }, null, 2));
        return;
    }

    const failures = [];
    for (const check of checks) {
        try {
            const { response, payload } = await fetchJsonWithTimeout(check.url, options.timeoutMs);
            if (!response.ok || !check.validate(payload)) {
                failures.push({
                    name: check.name,
                    url: check.url,
                    status: response.status,
                    payload,
                });
            }
        } catch (error) {
            failures.push({
                name: check.name,
                url: check.url,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    if (failures.length > 0) {
        await sendAlert(options, failures);
        console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
        process.exitCode = 2;
        return;
    }

    console.log(JSON.stringify({ status: 'ok', checked: checks.map((check) => check.name) }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

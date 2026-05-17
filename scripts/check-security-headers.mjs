#!/usr/bin/env node

function parseArgs(argv) {
    const options = {
        url: '',
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--url') {
            options.url = next || '';
            index += 1;
            continue;
        }
        if (!arg.startsWith('--') && !options.url) {
            options.url = arg;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

function printHelp() {
    console.log('Usage: node scripts/check-security-headers.mjs --url https://your-web-host');
    console.log('');
    console.log('Checks browser-visible production security headers without printing secrets.');
}

function normalizeUrl(value) {
    if (!value) {
        throw new Error('Missing --url');
    }

    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
        throw new Error('--url must be HTTPS unless checking localhost');
    }
    return parsed.toString();
}

function getHeader(headers, key) {
    return headers.get(key)?.trim() || '';
}

function checkExact(headers, key, expected) {
    const actual = getHeader(headers, key);
    return {
        key,
        pass: actual.toLowerCase() === expected.toLowerCase(),
        expected,
        actual: actual || null,
    };
}

function checkPresent(headers, key) {
    const actual = getHeader(headers, key);
    return {
        key,
        pass: Boolean(actual),
        expected: 'present',
        actual: actual || null,
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const url = normalizeUrl(options.url);
    const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'text/html,application/xhtml+xml' },
    });

    const headers = response.headers;
    const csp = getHeader(headers, 'content-security-policy');
    const cspReportOnly = getHeader(headers, 'content-security-policy-report-only');
    const checks = [
        checkExact(headers, 'x-frame-options', 'DENY'),
        checkExact(headers, 'x-content-type-options', 'nosniff'),
        checkPresent(headers, 'referrer-policy'),
        checkPresent(headers, 'permissions-policy'),
        checkPresent(headers, 'cross-origin-opener-policy'),
        {
            key: 'content-security-policy',
            pass: Boolean(csp || cspReportOnly),
            expected: 'present or report-only',
            actual: csp ? 'enforced' : cspReportOnly ? 'report-only' : null,
        },
    ];

    const failures = checks.filter((check) => !check.pass);
    const result = {
        status: failures.length === 0 ? 'ok' : 'failed',
        url,
        httpStatus: response.status,
        cspMode: csp ? 'enforced' : cspReportOnly ? 'report-only' : 'missing',
        checks,
    };

    console.log(JSON.stringify(result, null, 2));
    if (failures.length > 0) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

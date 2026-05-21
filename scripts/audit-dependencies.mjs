import { execSync } from 'node:child_process';

let stdout = '';
try {
    stdout = execSync('npm audit --json --audit-level=moderate', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
} catch (error) {
    stdout = String(error.stdout || '');
    if (!stdout.trim()) {
        console.error(error.stderr || error.message);
        process.exit(1);
    }
}

const report = JSON.parse(stdout);
const vulnerabilities = Object.values(report.vulnerabilities || {});

const allowedNextAuthUuidNames = new Set(['next-auth', 'uuid']);
const allowedNextAuthUuidNodes = new Set([
    'node_modules/next-auth',
    'node_modules/next-auth/node_modules/uuid',
]);
const allowedAdvisoryUrl = 'https://github.com/advisories/GHSA-w5hq-g745-h8pq';

function isAllowedNextAuthUuidFinding(vulnerability) {
    if (!allowedNextAuthUuidNames.has(vulnerability.name)) {
        return false;
    }

    const nodes = Array.isArray(vulnerability.nodes) ? vulnerability.nodes : [];
    if (nodes.some((node) => !allowedNextAuthUuidNodes.has(node))) {
        return false;
    }

    const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
    if (vulnerability.name === 'next-auth') {
        return via.length === 1 && via[0] === 'uuid';
    }

    return via.some((entry) => typeof entry === 'object' && entry?.url === allowedAdvisoryUrl);
}

const blocked = vulnerabilities.filter((vulnerability) => !isAllowedNextAuthUuidFinding(vulnerability));

if (blocked.length > 0) {
    console.error('Dependency audit failed. Unapproved vulnerabilities:');
    for (const vulnerability of blocked) {
        console.error(`- ${vulnerability.name} [${vulnerability.severity}] ${vulnerability.range || ''}`.trim());
    }
    process.exit(1);
}

if (vulnerabilities.length > 0) {
    console.warn(
        [
            'Dependency audit passed with a documented exception:',
            '- next-auth@4.24.14 depends on uuid@8.3.2.',
            '- Advisory GHSA-w5hq-g745-h8pq affects uuid v3/v5/v6 when caller provides a buffer.',
            '- NextAuth uses uuid.v4() for JWT JTI here; npm currently suggests a breaking downgrade to next-auth@3.',
            '- Revisit when a compatible next-auth/Auth.js patch is available.',
        ].join('\n')
    );
} else {
    console.log('Dependency audit passed with no vulnerabilities.');
}

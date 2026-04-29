import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync('npm audit --omit=dev --json', {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
});

let report;
try {
    report = JSON.parse(result.stdout || '{}');
} catch (error) {
    console.error('Failed to parse npm audit JSON output');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}

const vulnerabilities = Object.values(report.vulnerabilities ?? {});
const blocking = vulnerabilities.filter((item) => item.severity === 'critical' || item.severity === 'high');
const moderate = vulnerabilities.filter((item) => item.severity === 'moderate');
const low = vulnerabilities.filter((item) => item.severity === 'low');

if (blocking.length > 0) {
    console.error('Runtime dependency audit failed. Blocking vulnerabilities found:');
    for (const item of blocking) {
        console.error(`- [${item.severity}] ${item.name}`);
    }
    process.exit(1);
}

console.log('Runtime dependency audit passed: no high or critical vulnerabilities.');

if (moderate.length > 0) {
    console.warn(`Runtime dependency audit warning: ${moderate.length} moderate vulnerabilities remain.`);
    for (const item of moderate) {
        const via = Array.isArray(item.via)
            ? item.via.map((entry) => typeof entry === 'string' ? entry : entry.name).filter(Boolean).join(', ')
            : '';
        console.warn(`- [moderate] ${item.name}${via ? ` via ${via}` : ''}`);
    }
}

if (low.length > 0) {
    console.warn(`Runtime dependency audit notice: ${low.length} low vulnerabilities remain.`);
}

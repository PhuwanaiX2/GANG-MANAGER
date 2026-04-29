import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SCAN_ROOTS = [
    'apps',
    'packages',
    'scripts',
    'docs',
    'Obsidian Data SAASCenter',
].filter((entry) => fs.existsSync(path.join(ROOT, entry)));

const TEXT_EXTENSIONS = new Set([
    '.cjs',
    '.css',
    '.env',
    '.example',
    '.html',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.mjs',
    '.tsx',
    '.ts',
    '.txt',
    '.yml',
    '.yaml',
]);

const SKIP_SEGMENTS = new Set([
    '.git',
    '.next',
    '.playwright',
    '.turbo',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'test-results',
]);

const MOJIBAKE_PATTERNS = [
    { name: 'thai-mojibake', pattern: /\u00E0[\u00B8\u00B9]/u },
    { name: 'double-encoded-thai', pattern: /\u00C3\u00A0\u00C2[\u00B8\u00B9]/u },
    { name: 'cp1252-emoji-or-symbol', pattern: /[\u00E2\u00F0][\u0080-\u00BF\u0152\u0178\u2018-\u201D\u2020-\u2022]/u },
    { name: 'unexpected-replacement-char', pattern: /\uFFFD/u },
];

function isSkipped(filePath) {
    return filePath.split(path.sep).some((segment) => SKIP_SEGMENTS.has(segment));
}

function isTextFile(filePath) {
    const basename = path.basename(filePath);
    const extension = path.extname(basename);

    return TEXT_EXTENSIONS.has(extension) || basename.startsWith('.env');
}

function collectFiles(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (isSkipped(fullPath)) {
            continue;
        }

        if (entry.isDirectory()) {
            collectFiles(fullPath, files);
            continue;
        }

        if (entry.isFile() && isTextFile(fullPath)) {
            files.push(fullPath);
        }
    }

    return files;
}

const findings = [];

for (const scanRoot of SCAN_ROOTS) {
    const rootPath = path.join(ROOT, scanRoot);
    for (const filePath of collectFiles(rootPath)) {
        const relativePath = path.relative(ROOT, filePath);
        let content;

        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            continue;
        }

        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
            const matched = MOJIBAKE_PATTERNS.find(({ pattern }) => pattern.test(line));
            if (!matched) {
                return;
            }

            findings.push({
                file: relativePath,
                line: index + 1,
                type: matched.name,
                preview: line.trim().slice(0, 180),
            });
        });
    }
}

if (findings.length > 0) {
    console.error('Mojibake/encoding guard failed. Fix these UTF-8 text issues before release:');
    for (const finding of findings) {
        console.error(`- ${finding.file}:${finding.line} [${finding.type}] ${finding.preview}`);
    }
    process.exit(1);
}

console.log('Encoding guard passed: no mojibake markers found.');

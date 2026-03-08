const fs = require('fs');
const path = require('path');

function processDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.next') && !fullPath.includes('.git')) {
                processDir(fullPath);
            }
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // 1. replace toLocaleDateString('th-TH') without options
            content = content.replace(/\.toLocale(Date|Time)String\(\s*['"]th-TH['"]\s*\)/g, `.toLocale$1String('th-TH', { timeZone: 'Asia/Bangkok' })`);

            // 2. replace toLocaleDateString('th-TH', { ... }) 
            // Match the start of the object and inject timeZone IF it's not already there.
            // A simpler way: just inject it, then use a regex to clean up duplicates.

            content = content.replace(/\.toLocale(Date|Time)String\(\s*['"]th-TH['"]\s*,\s*\{/g, (match) => {
                return match + ` timeZone: 'Asia/Bangkok', `;
            });

            // 3. cleanup any double timeZone in the same object literal block.
            let lines = content.split('\n');
            let finalContent = "";

            for (let i = 0; i < lines.length; i++) {
                let text = lines[i];
                // If the line has our injected timeZone AND another timeZone, remove the injected one.
                if (text.includes("timeZone: 'Asia/Bangkok',") && (text.match(/timeZone/g) || []).length > 1) {
                    text = text.replace(/timeZone:\s*['"]Asia\/Bangkok['"],\s*/, '');
                }

                // Edge case: if the line has our injected one, but later in the same statement (next few lines) there's another timeZone? 
                // Let's rely on a simpler regex to remove the FIRST timeZone if there are two in a block up to the closing brace.
                finalContent += text + (i === lines.length - 1 ? '' : '\n');
            }

            // Actually, a simpler way is just regex replace over multiple lines.
            // Look for `timeZone: 'Asia/Bangkok',` followed by anything that has `timeZone:` before `}`.
            finalContent = finalContent.replace(/timeZone:\s*['"]Asia\/Bangkok['"],\s*([^}]*?timeZone:)/g, '$1');

            if (finalContent !== original) {
                fs.writeFileSync(fullPath, finalContent);
                console.log('Updated', fullPath);
            }
        }
    });
}

processDir('./apps/web/src');
processDir('./apps/bot/src');

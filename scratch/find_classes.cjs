const fs = require('fs');
const content = fs.readFileSync('src/features/app/AuthenticatedWorkspace.tsx', 'utf8');

const regex = /className="([^"]*rounded[^"]*border[^"]*)"/g;

let match;
const matches = new Set();
while ((match = regex.exec(content)) !== null) {
    if (match[1].includes('shadow') || match[1].includes('p-')) {
        matches.add(match[1]);
    }
}

fs.writeFileSync('scratch/classes.txt', Array.from(matches).join('\n'));

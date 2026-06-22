const fs = require('fs');
const content = fs.readFileSync('src/features/app/AuthenticatedWorkspace.tsx', 'utf8');
const regex = /className=\"([^\"]*rounded-2xl[^\"]*bg-app-surface[^\"]*)\"/g;
let match;
const matches = new Set();
while ((match = regex.exec(content)) !== null) {
  matches.add(match[1]);
}
console.log(Array.from(matches).join('\n'));

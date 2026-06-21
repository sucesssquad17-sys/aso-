const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  // Backgrounds
  { regex: /\bbg-slate-950\b/g, replacement: 'app-surface' },
  { regex: /\bbg-slate-900\b/g, replacement: 'app-surface-muted' },
  { regex: /\bbg-slate-800\b/g, replacement: 'app-surface-strong' },
  { regex: /\bbg-slate-700\b/g, replacement: 'app-surface-strong' },
  
  // Borders
  { regex: /\bborder-slate-800\b/g, replacement: 'app-border' },
  { regex: /\bborder-slate-700\b/g, replacement: 'app-border' },
  { regex: /\bborder-slate-600\b/g, replacement: 'app-border' },

  // Text colors
  { regex: /\btext-slate-100\b/g, replacement: 'app-text' },
  { regex: /\btext-slate-200\b/g, replacement: 'app-text' },
  { regex: /\btext-slate-300\b/g, replacement: 'app-text-muted' },
  { regex: /\btext-slate-400\b/g, replacement: 'app-text-muted' },
  { regex: /\btext-slate-500\b/g, replacement: 'app-text-muted' },
  
  { regex: /className="([^"]*?)(?<!bg-[\w]+-\d+\s+[^"]*)text-white([^"]*?)"/g, replacement: (match, p1, p2) => {
      if (p1.includes('bg-cyan-') || p1.includes('bg-blue-') || p1.includes('bg-emerald-') || p1.includes('bg-red-')) {
          return match;
      }
      return `className="${p1}app-text${p2}"`;
  }},
];

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (['.tsx', '.ts'].includes(ext)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const rule of replacements) {
      content = content.replace(rule.regex, rule.replacement);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

traverse(srcDir);

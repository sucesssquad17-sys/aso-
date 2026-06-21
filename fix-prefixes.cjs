const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const fixes = [
  // Fix background prefixes
  { regex: /\bapp-surface\b/g, replacement: 'bg-app-surface' },
  { regex: /\bapp-surface-muted\b/g, replacement: 'bg-app-surface-muted' },
  { regex: /\bapp-surface-strong\b/g, replacement: 'bg-app-surface-strong' },

  // Fix border prefixes
  { regex: /\bapp-border\b/g, replacement: 'border-app-border' },

  // Fix text prefixes
  { regex: /\bapp-text\b/g, replacement: 'text-app-text' },
  { regex: /\bapp-text-muted\b/g, replacement: 'text-app-text-muted' },
];

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (['.tsx', '.ts'].includes(ext)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const rule of fixes) {
      content = content.replace(rule.regex, rule.replacement);
    }

    // Fix double replacements if I accidentally run it twice
    content = content.replace(/bg-bg-app-surface/g, 'bg-app-surface');
    content = content.replace(/border-border-app-border/g, 'border-app-border');
    content = content.replace(/text-text-app-text/g, 'text-app-text');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed', filePath);
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

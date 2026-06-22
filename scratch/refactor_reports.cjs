const fs = require('fs');
let content = fs.readFileSync('src/features/reports/ReportsWorkspace.tsx', 'utf8');

const replacements = [
  [
    'className="flex flex-col gap-5 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm dark:border-app-border dark:bg-app-surface-muted/60"',
    'className="workspace-panel"'
  ],
  [
    'className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm dark:border-app-border dark:bg-app-surface-muted/60"',
    'className="workspace-panel"'
  ],
  [
    'className="flex flex-col gap-6 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm dark:border-app-border dark:bg-app-surface-muted/60"',
    'className="workspace-panel"'
  ],
  [
    'className="flex min-w-0 flex-col gap-6 rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm dark:border-app-border dark:bg-app-surface-muted/60"',
    'className="workspace-panel"'
  ],
  [
    'className="rounded-[20px] border border-slate-200 bg-white shadow-sm dark:border-app-border dark:bg-app-surface-muted/60"',
    'className="workspace-panel !p-0"'
  ],
  [
    'className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-app-border dark:bg-app-surface-strong/50"',
    'className="workspace-metric-card"'
  ],
  [
    'className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-app-border dark:bg-app-surface-muted/60"',
    'className="workspace-metric-card"'
  ],
  [
    'className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-app-border dark:bg-app-surface/50"',
    'className="workspace-metric-card"'
  ]
];

for (const [oldStr, newStr] of replacements) {
  content = content.split(oldStr).join(newStr);
}

fs.writeFileSync('src/features/reports/ReportsWorkspace.tsx', content);
console.log('Done');

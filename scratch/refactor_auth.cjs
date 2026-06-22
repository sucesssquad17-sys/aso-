const fs = require('fs');

let content = fs.readFileSync('src/features/app/AuthenticatedWorkspace.tsx', 'utf8');

const replacements = {
  'bg-app-surface-muted/60 p-5 rounded-2xl shadow-lg border border-app-border/50 relative transition-all hover:shadow-cyan-500/10 hover:border-app-border backdrop-blur-sm': 'workspace-panel relative transition-all hover:shadow-cyan-500/10 hover:border-app-border',
  'rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-3 text-sm text-app-text-muted flex flex-col gap-2 md:flex-row md:items-center md:justify-between': 'workspace-panel !px-4 !py-3 !flex-col md:!flex-row md:!items-center md:!justify-between gap-2 text-sm text-app-text-muted',
  'mt-4 overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/40': 'workspace-panel overflow-hidden mt-4 !p-0',
  'mt-5 rounded-2xl border border-app-border/60 bg-app-surface/45 p-4': 'workspace-panel mt-5',
  'mt-4 rounded-2xl border border-app-border/60 bg-app-surface/45 p-4': 'workspace-panel mt-4',
  'rounded-2xl border border-app-border/60 bg-app-surface-muted/50 p-4': 'workspace-panel',
  'rounded-xl border border-app-border/60 bg-app-surface/50 p-4': 'workspace-panel',
  'rounded-xl border border-app-border/50 bg-app-surface-muted/50 px-4 py-4 text-sm text-app-text-muted': 'workspace-metric-card text-sm text-app-text-muted',
  'flex items-center gap-2 rounded-xl border border-app-border/50 bg-app-surface/50 px-4 py-4 text-sm text-app-text-muted': 'workspace-metric-card !flex-row items-center gap-2 text-sm text-app-text-muted',
  'rounded-xl border border-app-border/50 bg-app-surface/50 px-4 py-4 text-sm text-app-text-muted': 'workspace-metric-card text-sm text-app-text-muted',
  'rounded-xl border border-app-border/50 bg-app-surface/50 px-3 py-6 text-center text-sm text-app-text-muted': 'workspace-empty-block !p-6',
  'mt-4 rounded-xl border border-app-border/50 bg-app-surface/60 px-3 py-3 text-sm text-app-text-muted': 'workspace-metric-card mt-4 !p-3 text-sm text-app-text-muted',
  'mt-4 rounded-2xl border border-app-border/60 bg-app-surface/45 px-4 py-6 text-sm text-app-text-muted': 'workspace-panel mt-4 !py-6 text-sm text-app-text-muted',
  'rounded-xl border border-app-border/50 bg-app-surface-muted/50 px-3 py-3': 'workspace-metric-card !p-3',
  'rounded-2xl border border-app-border/60 bg-app-surface/45 px-4 py-3': 'workspace-panel !px-4 !py-3',
  'rounded-xl border border-app-border/50 bg-app-surface-muted/50 px-4 py-10 text-center text-sm text-app-text-muted': 'workspace-empty-block !py-10',
  'flex flex-col gap-3 rounded-xl border border-app-border/60 bg-app-surface-muted/40 p-4 md:flex-row md:items-center md:justify-between': 'workspace-panel !flex-col md:!flex-row md:!items-center md:!justify-between gap-3',
  'flex items-center gap-3 rounded-xl border border-app-border/50 bg-app-surface-muted/60 px-3 py-2.5': 'workspace-metric-card !flex-row items-center gap-3 !px-3 !py-2.5',
  'rounded-xl border border-app-border/60 bg-app-surface/45 px-4 py-3': 'workspace-panel !px-4 !py-3'
};

for (const [oldClass, newClass] of Object.entries(replacements)) {
  content = content.replaceAll(oldClass, newClass);
}

fs.writeFileSync('src/features/app/AuthenticatedWorkspace.tsx', content);
console.log('done');

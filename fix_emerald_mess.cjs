/**
 * fix_emerald_mess.cjs
 * 
 * Precisely reverts the "emerald/black theme" changes Gemini made to the workspace components.
 * These are the specific things that were changed AFTER the paywall design was done.
 */
const fs = require('fs');

// ── Fix AuthenticatedWorkspace.tsx ────────────────────────────────────────────
{
  const file = 'src/features/app/AuthenticatedWorkspace.tsx';
  let src = fs.readFileSync(file, 'utf8');

  // Revert accent values from "emerald" to "cyan"
  // The workspace metric cards should use cyan, not emerald
  src = src.replace(/accent: "emerald" as const,/g, 'accent: "cyan" as const,');
  src = src.replace(/accent="emerald"/g, 'accent="cyan"');

  // Revert the auth-orb class names
  src = src.replace(/auth-orb-emerald/g, 'auth-orb-cyan');

  // Revert btn-emerald to btn-cyan
  src = src.replace(/btn-emerald/g, 'btn-cyan');

  // Fix the shadow-zinc-200/20 aberration (this was a mistake — should be shadow-slate-900/20 or none)
  src = src.replace(/shadow-zinc-200\/20/g, 'shadow-slate-900/20');

  fs.writeFileSync(file, src);
  console.log(`✓ Fixed ${file}`);
}

// ── Fix ReportsWorkspace.tsx ──────────────────────────────────────────────────
{
  const file = 'src/features/reports/ReportsWorkspace.tsx';
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/accent="emerald"/g, 'accent="cyan"');
  fs.writeFileSync(file, src);
  console.log(`✓ Fixed ${file}`);
}

// ── Fix index.css: restore bg-card-hover to original navy (not pitch black) ──
{
  const file = 'src/index.css';
  let css = fs.readFileSync(file, 'utf8');

  // The original --bg-card-hover was rgba(30, 41, 59, 0.98) — the slate-800 navy
  // Gemini changed it to rgba(30, 30, 30, 0.98) or rgba(14,14,14,0.98)
  // Restore to the original value
  css = css.replace(
    /--bg-card-hover: rgba\((?:14|30),\s*(?:14|30),\s*(?:14|30),\s*0\.98\);/,
    '--bg-card-hover: rgba(30, 41, 59, 0.98);'
  );

  // Also check if workspace-metric-cyan appears twice (a bug from earlier scripts) — deduplicate
  const metricCyanDupe = /\.workspace-metric-cyan \{ box-shadow: inset 0 1px 0 rgba\(96, 165, 250, 0\.08\); \}\n\.workspace-metric-cyan \{ box-shadow: inset 0 1px 0 rgba\(96, 165, 250, 0\.08\); \}/;
  css = css.replace(metricCyanDupe, '.workspace-metric-cyan { box-shadow: inset 0 1px 0 rgba(34, 211, 238, 0.08); }');

  fs.writeFileSync(file, css);
  console.log(`✓ Fixed ${file}`);
}

console.log('\n✅ Done! All emerald/black mess reverted back to cyan theme.');

/**
 * restore_paywall_state.cjs
 * 
 * Restores the project to the state it was in right after the paywall design was completed
 * (before any color scheme changes were made). The "canonical" state uses:
 *  - CSS: --cyan-* variables, .workspace-metric-cyan, .badge-cyan, .btn-cyan, etc.
 *  - TSX: accent="cyan", type "cyan" | "emerald" | "amber" | "violet" | "slate"
 *  - Tailwind classes: cyan-* (these were ALWAYS cyan in the paywall files and should stay that way)
 * 
 * The color mess created an inconsistency: CSS has .workspace-metric-cyan but TSX emits
 * workspace-metric-blue. This script fixes that mismatch.
 */
const fs = require('fs');

// Files that had their CSS variable names broken (--cyan -> --blue)
// and class names broken (badge-cyan -> badge-blue, etc.)
const cssFile = 'src/index.css';

// TSX files where accent="cyan" was changed to accent="blue"
const tsxFiles = [
  'src/features/app/workspacePrimitives.tsx',
  'src/features/app/AuthenticatedWorkspace.tsx',
  'src/features/reports/ReportsWorkspace.tsx',
];

// App-level files that may have gotten badge-blue or other class changes
const appFiles = [
  'src/App.tsx',
  'src/components/LandingPage.tsx',
  'src/components/SplashScreen.tsx',
];

// ── Fix index.css ─────────────────────────────────────────────────────────────
{
  let css = fs.readFileSync(cssFile, 'utf8');

  // Restore CSS custom property names
  css = css.replace(/--blue-primary:/g, '--cyan-primary:');
  css = css.replace(/--blue-glow:/g, '--cyan-glow:');
  css = css.replace(/--blue-bright:/g, '--cyan-bright:');

  // Restore var() references to those properties
  css = css.replace(/var\(--blue-primary\)/g, 'var(--cyan-primary)');
  css = css.replace(/var\(--blue-glow\)/g, 'var(--cyan-glow)');
  css = css.replace(/var\(--blue-bright\)/g, 'var(--cyan-bright)');

  // Restore named CSS classes that got renamed
  css = css.replace(/shadow-glow-blue/g, 'shadow-glow-cyan');
  css = css.replace(/gradient-blue(?!-)/g, 'gradient-cyan');
  css = css.replace(/text-glow-blue/g, 'text-glow-cyan');
  css = css.replace(/text-gradient-blue/g, 'text-gradient-cyan');
  css = css.replace(/auth-orb-blue/g, 'auth-orb-cyan');
  css = css.replace(/badge-blue/g, 'badge-cyan');
  css = css.replace(/btn-blue/g, 'btn-cyan');
  css = css.replace(/workspace-metric-blue/g, 'workspace-metric-cyan');

  // Restore the correct hex values for the brand tokens
  // The canonical cyan values are: #06b6d4 (primary) and #22d3ee (bright)
  // The blue values (#3b82f6, #60a5fa) came from the incorrect "blue theme"
  // BUT: we need to be careful — some uses of #3b82f6/#60a5fa were in the ORIGINAL
  // design (buttons, tab indicator, rank number, etc.) as a deliberate blue accent.
  // Only the brand token properties should revert.
  // Line 25-27 should be:
  //   --cyan-primary: #06b6d4;
  //   --cyan-glow: rgba(34, 211, 238, 0.15);
  //   --cyan-bright: #22d3ee;
  css = css.replace(/--cyan-primary: #3b82f6;/, '--cyan-primary: #06b6d4;');
  css = css.replace(/--cyan-glow: rgba\(96, 165, 250, 0\.15\);/, '--cyan-glow: rgba(34, 211, 238, 0.15);');
  css = css.replace(/--cyan-bright: #60a5fa;/, '--cyan-bright: #22d3ee;');

  // Restore gradient values that use the brand tokens
  css = css.replace(
    /--gradient-brand: linear-gradient\(135deg, #60a5fa 0%, #3b82f6 100%\);/,
    '--gradient-brand: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);'
  );
  css = css.replace(
    /--gradient-cyan: linear-gradient\(135deg, #3b82f6 0%, #60a5fa 100%\);/,
    '--gradient-cyan: linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%);'
  );

  // Restore shadow-glow-cyan value
  css = css.replace(
    /--shadow-glow-cyan: 0 0 30px rgba\(96, 165, 250, 0\.2\), 0 0 60px rgba\(96, 165, 250, 0\.08\);/,
    '--shadow-glow-cyan: 0 0 30px rgba(34, 211, 238, 0.2), 0 0 60px rgba(34, 211, 238, 0.08);'
  );

  // Restore keyframe animation colors (pulse-glow used the brand colors)
  css = css.replace(
    /box-shadow: 0 0 18px rgba\(96, 165, 250, 0\.18\);/g,
    'box-shadow: 0 0 18px rgba(34, 211, 238, 0.18);'
  );
  css = css.replace(
    /box-shadow: 0 0 30px rgba\(96, 165, 250, 0\.28\), 0 0 56px rgba\(96, 165, 250, 0\.12\);/g,
    'box-shadow: 0 0 30px rgba(34, 211, 238, 0.28), 0 0 56px rgba(34, 211, 238, 0.12);'
  );

  // Restore card-glow border (used brand cyan)
  css = css.replace(
    /border: 1px solid rgba\(96, 165, 250, 0\.15\);\n  border-radius: var\(--radius-card\)/,
    'border: 1px solid rgba(34, 211, 238, 0.15);\n  border-radius: var(--radius-card)'
  );
  css = css.replace(
    /border-color: rgba\(96, 165, 250, 0\.28\);\n  box-shadow: var\(--shadow-glow-cyan\)/,
    'border-color: rgba(34, 211, 238, 0.28);\n  box-shadow: var(--shadow-glow-cyan)'
  );

  // Restore selection color
  css = css.replace(
    /background-color: rgba\(96, 165, 250, 0\.25\);\n  color: #a5f3fc;/,
    'background-color: rgba(34, 211, 238, 0.25);\n  color: #a5f3fc;'
  );

  // Restore light-mode border-glow 
  css = css.replace(
    /--border-glow: rgba\(96, 165, 250, 0\.18\);/,
    '--border-glow: rgba(34, 211, 238, 0.18);'
  );

  // Restore light-body background gradients
  css = css.replace(
    /rgba\(96, 165, 250, 0\.09\) 0, transparent 60%\),\n    radial-gradient\(ellipse 55% 35% at 90% 0%, rgba\(99, 102, 241, 0\.08\)/,
    'rgba(6, 182, 212, 0.09) 0, transparent 60%),\n    radial-gradient(ellipse 55% 35% at 90% 0%, rgba(99, 102, 241, 0.08)'
  );
  css = css.replace(
    /rgba\(96, 165, 250, 0\.07\) 0, transparent 50%\);/,
    'rgba(34, 211, 238, 0.07) 0, transparent 50%);'
  );

  fs.writeFileSync(cssFile, css);
  console.log(`✓ Restored ${cssFile}`);
}

// ── Fix TSX files: accent="blue" → accent="cyan" and type defs ────────────────
for (const file of tsxFiles) {
  if (!fs.existsSync(file)) { console.warn(`⚠ Skipping missing: ${file}`); continue; }
  let src = fs.readFileSync(file, 'utf8');

  // Restore accent prop default and type union
  src = src.replace(/accent = "blue"/g, 'accent = "cyan"');
  src = src.replace(/accent\?: "blue"/g, 'accent?: "cyan"');
  src = src.replace(/"blue" \| "emerald" \| "amber" \| "violet" \| "slate"/g,
                    '"cyan" | "emerald" | "amber" | "violet" | "slate"');
  src = src.replace(/accent="blue"/g, 'accent="cyan"');

  fs.writeFileSync(file, src);
  console.log(`✓ Restored ${file}`);
}

// ── Fix app-level files: restore any badge-blue → badge-cyan that landed there ─
for (const file of appFiles) {
  if (!fs.existsSync(file)) { console.warn(`⚠ Skipping missing: ${file}`); continue; }
  let src = fs.readFileSync(file, 'utf8');

  // Only fix CSS class names in JSX strings, not the ACCENT_STYLES object 
  // (which correctly references named colors like "blue", "emerald", etc.)
  src = src.replace(/className="badge-blue"/g, 'className="badge-cyan"');
  src = src.replace(/className="text-glow-blue"/g, 'className="text-glow-cyan"');
  src = src.replace(/className="btn-blue"/g, 'className="btn-cyan"');

  // Fix class string concatenations
  src = src.replace(/"badge-blue /g, '"badge-cyan ');
  src = src.replace(/ badge-blue"/g, ' badge-cyan"');
  src = src.replace(/`badge-blue/g, '`badge-cyan');

  fs.writeFileSync(file, src);
  console.log(`✓ Restored ${file}`);
}

console.log('\n✅ Done! Project restored to paywall-era state (cyan theme, consistent naming).');

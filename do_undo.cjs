const fs = require('fs');

const cssFile = 'src/index.css';
const tsxFiles = [
  'src/features/app/workspacePrimitives.tsx',
  'src/features/app/AuthenticatedWorkspace.tsx',
  'src/features/reports/ReportsWorkspace.tsx',
];
const appFiles = [
  'src/App.tsx',
  'src/components/LandingPage.tsx',
  'src/components/SplashScreen.tsx',
];

if (fs.existsSync(cssFile)) {
  let css = fs.readFileSync(cssFile, 'utf8');
  css = css.replace(/--cyan-primary:/g, '--blue-primary:');
  css = css.replace(/--cyan-glow:/g, '--blue-glow:');
  css = css.replace(/--cyan-bright:/g, '--blue-bright:');
  css = css.replace(/var\(--cyan-primary\)/g, 'var(--blue-primary)');
  css = css.replace(/var\(--cyan-glow\)/g, 'var(--blue-glow)');
  css = css.replace(/var\(--cyan-bright\)/g, 'var(--blue-bright)');
  css = css.replace(/shadow-glow-cyan/g, 'shadow-glow-blue');
  css = css.replace(/gradient-cyan/g, 'gradient-blue');
  css = css.replace(/text-glow-cyan/g, 'text-glow-blue');
  css = css.replace(/text-gradient-cyan/g, 'text-gradient-blue');
  css = css.replace(/auth-orb-cyan/g, 'auth-orb-blue');
  css = css.replace(/badge-cyan/g, 'badge-blue');
  css = css.replace(/btn-cyan/g, 'btn-blue');
  css = css.replace(/workspace-metric-cyan/g, 'workspace-metric-blue');

  css = css.replace(/--cyan-primary: #06b6d4;/g, '--cyan-primary: #3b82f6;');
  css = css.replace(/--cyan-glow: rgba\(34, 211, 238, 0\.15\);/g, '--cyan-glow: rgba(96, 165, 250, 0.15);');
  css = css.replace(/--cyan-bright: #22d3ee;/g, '--cyan-bright: #60a5fa;');

  css = css.replace(/--gradient-brand: linear-gradient\(135deg, #22d3ee 0%, #06b6d4 100%\);/g, '--gradient-brand: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);');
  css = css.replace(/--gradient-cyan: linear-gradient\(135deg, #06b6d4 0%, #22d3ee 100%\);/g, '--gradient-cyan: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);');

  css = css.replace(/--shadow-glow-cyan: 0 0 30px rgba\(34, 211, 238, 0\.2\), 0 0 60px rgba\(34, 211, 238, 0\.08\);/g, '--shadow-glow-cyan: 0 0 30px rgba(96, 165, 250, 0.2), 0 0 60px rgba(96, 165, 250, 0.08);');

  css = css.replace(/box-shadow: 0 0 18px rgba\(34, 211, 238, 0\.18\);/g, 'box-shadow: 0 0 18px rgba(96, 165, 250, 0.18);');
  css = css.replace(/box-shadow: 0 0 30px rgba\(34, 211, 238, 0\.28\), 0 0 56px rgba\(34, 211, 238, 0\.12\);/g, 'box-shadow: 0 0 30px rgba(96, 165, 250, 0.28), 0 0 56px rgba(96, 165, 250, 0.12);');
  
  css = css.replace(/border: 1px solid rgba\(34, 211, 238, 0\.15\);\\n  border-radius: var\(--radius-card\)/g, 'border: 1px solid rgba(96, 165, 250, 0.15);\\n  border-radius: var(--radius-card)');
  css = css.replace(/border-color: rgba\(34, 211, 238, 0\.28\);\\n  box-shadow: var\(--shadow-glow-cyan\)/g, 'border-color: rgba(96, 165, 250, 0.28);\\n  box-shadow: var(--shadow-glow-cyan)');
  
  css = css.replace(/background-color: rgba\(34, 211, 238, 0\.25\);\\n  color: #a5f3fc;/g, 'background-color: rgba(96, 165, 250, 0.25);\\n  color: #a5f3fc;');
  
  css = css.replace(/--border-glow: rgba\(34, 211, 238, 0\.18\);/g, '--border-glow: rgba(96, 165, 250, 0.18);');
  
  css = css.replace(/rgba\(6, 182, 212, 0\.09\) 0, transparent 60%\),\\n    radial-gradient\(ellipse 55% 35% at 90% 0%, rgba\(99, 102, 241, 0\.08\)/g, 'rgba(96, 165, 250, 0.09) 0, transparent 60%),\\n    radial-gradient(ellipse 55% 35% at 90% 0%, rgba(99, 102, 241, 0.08)');
  css = css.replace(/rgba\(34, 211, 238, 0\.07\) 0, transparent 50%\);/g, 'rgba(96, 165, 250, 0.07) 0, transparent 50%);');

  fs.writeFileSync(cssFile, css);
}

for (const file of tsxFiles) {
  if (fs.existsSync(file)) {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/accent = "cyan"/g, 'accent = "blue"');
    src = src.replace(/accent\?: "cyan"/g, 'accent?: "blue"');
    src = src.replace(/"cyan" \| "emerald" \| "amber" \| "violet" \| "slate"/g, '"blue" | "emerald" | "amber" | "violet" | "slate"');
    src = src.replace(/accent="cyan"/g, 'accent="blue"');
    fs.writeFileSync(file, src);
  }
}

for (const file of appFiles) {
  if (fs.existsSync(file)) {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/className="badge-cyan"/g, 'className="badge-blue"');
    src = src.replace(/className="text-glow-cyan"/g, 'className="text-glow-blue"');
    src = src.replace(/className="btn-cyan"/g, 'className="btn-blue"');
    src = src.replace(/"badge-cyan /g, '"badge-blue ');
    src = src.replace(/ badge-cyan"/g, ' badge-blue"');
    src = src.replace(/adge-cyan/g, 'adge-blue');
    fs.writeFileSync(file, src);
  }
}
console.log('Undone paywall state restore.');

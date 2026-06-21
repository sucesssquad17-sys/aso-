const fs = require('fs');
const files = [
  'src/index.css',
  'src/features/app/workspacePrimitives.tsx',
  'src/features/app/AuthenticatedWorkspace.tsx',
  'src/features/reports/ReportsWorkspace.tsx',
  'src/components/LandingPage.tsx',
  'src/components/SplashScreen.tsx',
  'src/App.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  if (file === 'src/index.css') {
    content = content.replace(/#06b6d4/g, '#3b82f6');
    content = content.replace(/#22d3ee/g, '#60a5fa');
    content = content.replace(/34,\s*211,\s*238/g, '96, 165, 250');
    
    content = content.replace(/--cyan-/g, '--blue-');
    content = content.replace(/var\(--cyan-/g, 'var(--blue-');
    content = content.replace(/shadow-glow-cyan/g, 'shadow-glow-blue');
    content = content.replace(/gradient-cyan/g, 'gradient-blue');
    content = content.replace(/text-glow-cyan/g, 'text-glow-blue');
    content = content.replace(/text-gradient-cyan/g, 'text-gradient-blue');
    content = content.replace(/auth-orb-cyan/g, 'auth-orb-blue');
    content = content.replace(/badge-cyan/g, 'badge-blue');
    content = content.replace(/btn-cyan/g, 'btn-blue');
  } else {
    // Replace accent prop
    content = content.replace(/accent="cyan"/g, 'accent="blue"');
    content = content.replace(/accent='cyan'/g, "accent='blue'");
    content = content.replace(/accent\?: "cyan"/g, 'accent?: "blue"');
    content = content.replace(/accent = "cyan"/g, 'accent = "blue"');
    
    // In LandingPage or other files, we might have class names
    content = content.replace(/cyan-500/g, 'blue-500');
    content = content.replace(/cyan-400/g, 'blue-400');
    content = content.replace(/cyan-900\/20/g, 'blue-900/20');
    content = content.replace(/cyan-glow/g, 'blue-glow');
    content = content.replace(/text-glow-cyan/g, 'text-glow-blue');
    content = content.replace(/gradient-cyan/g, 'gradient-blue');
    content = content.replace(/badge-cyan/g, 'badge-blue');
  }

  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});

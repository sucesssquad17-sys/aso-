const fs = require('fs');
const cssPath = 'src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

// Ensure root variables for spacing/density
if (!css.includes('--workspace-gap-mobile')) {
  const rootVars = `
  --workspace-gap-mobile: 1rem;
  --workspace-gap-desktop: 1.5rem;
  --workspace-padding-mobile: 1rem;
  --workspace-padding-desktop: 1.5rem;
  --workspace-radius-mobile: 1rem;
  --workspace-radius-desktop: 1.5rem;`;
  
  css = css.replace(':root {', ':root {' + rootVars);
}

// Remove the old .workspace-panel since we are rewriting it.
// It's a bit complex with regex, so we'll just append our standardized blocks and they will override.
// Actually, it's safer to just remove the old .workspace-panel definition.
css = css.replace(/\.workspace-panel\s*\{[\s\S]*?\}/, '');
css = css.replace(/@media \(min-width: 640px\) \{\s*\.workspace-panel\s*\{[\s\S]*?\}\s*\}/, '');

const standardizationCss = `
/* =========================================
   STANDARDIZED WORKSPACE PRIMITIVES
   ========================================= */

.workspace-panel, .workspace-panel-muted, .workspace-panel-strong {
  border-radius: var(--workspace-radius-mobile);
  padding: var(--workspace-padding-mobile);
  display: flex;
  flex-direction: column;
  gap: var(--workspace-gap-mobile);
}

@media (min-width: 640px) {
  .workspace-panel, .workspace-panel-muted, .workspace-panel-strong {
    border-radius: var(--workspace-radius-desktop);
    padding: var(--workspace-padding-desktop);
    gap: var(--workspace-gap-desktop);
  }
}

.workspace-metric-card {
  border-radius: var(--workspace-radius-mobile);
  padding: var(--workspace-padding-mobile);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

@media (min-width: 640px) {
  .workspace-metric-card {
    border-radius: var(--workspace-radius-desktop);
    padding: var(--workspace-padding-desktop);
  }
}

.workspace-empty-block {
  padding: calc(var(--workspace-padding-mobile) * 2) var(--workspace-padding-mobile) !important;
  border-radius: var(--workspace-radius-mobile) !important;
  gap: var(--workspace-gap-mobile) !important;
}

@media (min-width: 640px) {
  .workspace-empty-block {
    padding: calc(var(--workspace-padding-desktop) * 2) var(--workspace-padding-desktop) !important;
    border-radius: var(--workspace-radius-desktop) !important;
    gap: var(--workspace-gap-desktop) !important;
  }
}

.workspace-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
}

@media (min-width: 640px) {
  .workspace-badge {
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
  }
}

.workspace-btn-primary, .workspace-btn-secondary, .workspace-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all var(--transition-base);
}

@media (min-width: 640px) {
  .workspace-btn-primary, .workspace-btn-secondary, .workspace-btn-ghost {
    padding: 0.75rem 1.25rem;
    font-size: 0.9375rem;
  }
}

.workspace-btn-primary {
  background: var(--gradient-brand);
  color: #000;
}

.workspace-btn-secondary {
  background: rgba(13, 20, 34, 0.9);
  border: 1px solid rgba(77, 96, 124, 0.42);
  color: #e2e8f0;
}

.workspace-btn-ghost {
  background: transparent;
  color: #94a3b8;
}

.workspace-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}

html[data-theme="light"] .workspace-btn-secondary {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(242, 248, 253, 0.78));
  border-color: rgba(132, 160, 190, 0.42);
  color: #4e6279;
}
`;

if (!css.includes('STANDARDIZED WORKSPACE PRIMITIVES')) {
  css += standardizationCss;
}

fs.writeFileSync(cssPath, css);
console.log('CSS updated successfully');

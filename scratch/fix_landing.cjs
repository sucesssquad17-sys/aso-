const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/LandingPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import PRICING_INCLUDED_CAPABILITIES
const importBillingStr = 'import { BILLING_PLANS } from "../lib/billing";';
const newImportBillingStr = 'import { BILLING_PLANS, PRICING_INCLUDED_CAPABILITIES } from "../lib/billing";';
content = content.replace(importBillingStr, newImportBillingStr);

// 2. Remove heroHighlights and demoSteps arrays
content = content.replace(/const heroHighlights = \[[\s\S]*?\n\];\n/, '');
content = content.replace(/const demoSteps = \[[\s\S]*?\n\];\n/, '');

// 3. Remove the aside and the heroHighlights grid from the hero section
const heroGridStart = '<div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">';
const newHeroContainerStart = '<div className="flex flex-col items-center text-center">';
content = content.replace(heroGridStart, newHeroContainerStart);

// We need to replace the hero text content to be centered
content = content.replace('className="max-w-4xl"', 'className="max-w-4xl flex flex-col items-center"');
content = content.replace('className="mt-5 max-w-4xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-5xl md:mt-6 md:text-7xl"', 'className="mt-5 max-w-4xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-5xl md:mt-6 md:text-7xl text-center"');
content = content.replace('className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-400 md:mt-6 md:text-lg md:leading-8"', 'className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-400 md:mt-6 md:text-lg md:leading-8 text-center"');

// Fix the flex items for the CTA button in the hero
content = content.replace('className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"', 'className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center justify-center"');

// Fix the badges flex container
content = content.replace('className="mt-8 flex flex-wrap gap-3"', 'className="mt-8 flex flex-wrap justify-center gap-3"');

// Remove the aside entirely
const asideStart = '<aside';
const asideEnd = '</aside>';
const asideStartIndex = content.indexOf(asideStart);
const asideEndIndex = content.indexOf(asideEnd) + asideEnd.length;
content = content.substring(0, asideStartIndex) + content.substring(asideEndIndex);

// Remove the heroHighlights grid entirely
const highlightsStart = '<div className="mt-8 grid gap-3 sm:grid-cols-3">';
const highlightsEndStr = '              );\n            })}\n          </div>';
const highlightsStartIndex = content.indexOf(highlightsStart);
const highlightsEndIndex = content.indexOf(highlightsEndStr) + highlightsEndStr.length;
if(highlightsStartIndex !== -1) {
    content = content.substring(0, highlightsStartIndex) + content.substring(highlightsEndIndex);
}

// 4. Update the pricing grid container
content = content.replace('className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5"', 'className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 max-w-7xl mx-auto"');

// 5. Add the Shared Features section below the pricing cards
const pricingSectionEnd = '          </div>\n        </section>';
const sharedFeaturesSection = `          </div>

          <div className="mt-12 md:mt-16 rounded-[2rem] border border-cyan-500/10 bg-cyan-950/10 p-8 sm:p-10">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-xl font-bold text-white mb-2">Everything included in all plans</h3>
              <p className="text-sm text-slate-400 max-w-2xl">
                All workflow features are available on every plan. Only tracked apps, competitor groups, and tracked keyword capacity scale by tier.
              </p>
            </div>
            
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
              {PRICING_INCLUDED_CAPABILITIES.map((cap) => (
                <div key={cap.label} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-200">{cap.label}</span>
                  </div>
                  <span className="text-xs text-slate-500 ml-6 mt-1">{cap.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>`;
        
content = content.replace(pricingSectionEnd, sharedFeaturesSection);

// Ensure the first grid replace didn't miss closing tags
// Wait, replacing 'className="max-w-4xl"' also catches <div className="max-w-4xl">
// I should make sure it doesn't break other things.
// In LandingPage, there are a few `max-w-4xl`:
// 1. <div className="max-w-4xl"> (The one wrapping eyebrow, h1, p)
// Let me verify if there are others.

fs.writeFileSync(filePath, content, 'utf8');
console.log("Landing page updated.");

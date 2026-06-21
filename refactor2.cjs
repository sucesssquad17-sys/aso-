const fs = require('fs');
let c = fs.readFileSync('src/features/app/AuthenticatedWorkspace.tsx', 'utf8');

// The replacement of import happened correctly (hopefully). Let's verify.
if (!c.includes('import { UpgradePage } from "./UpgradePage";')) {
  // If it didn't, let's just do a blanket replace for the old import
  c = c.replace(/import\s*\{\s*UpgradeModal\s*,\s*\}\s*from\s*"([^"]+)UpgradeModal";/, 'import { UpgradePage } from "./UpgradePage";');
}

// Next, let's find the UpgradeModal usage and replace it with `{viewMode === "upgrade" && <UpgradePage ... />}`
// But we want to place it somewhere inside the main content area.
// The easiest is to just find the existing UpgradeModal block and modify it.
const oldModalStr = `<UpgradeModal
          isOpen={isBillingModalOpen}
          onClose={() => setIsBillingModalOpen(false)}
          billingStatus={billingStatusForUi}
          billingError={billingError}
          isLoading={isLoadingBillingStatus}
          isStartingCheckout={isStartingBillingCheckout}
          isOpeningPortal={isOpeningBillingPortal}
          onStartCheckout={(planId, interval) => void startBillingCheckout(planId, interval)}
          onOpenPortal={() => void openBillingPortal()}
        />`;

// I didn't replace `isBillingModalOpen` references inside the old `<UpgradeModal` block in the previous step. Wait, did I remove `isBillingModalOpen` state? Yes. So the code might currently be syntax-invalid.
// Let's replace the whole block by finding something similar with regex because whitespace might differ.
const modalRegex = /<UpgradeModal[\s\S]*?onOpenPortal=\{\(\) => void openBillingPortal\(\)\}\s*\/>/;

const newPageStr = `{viewMode === "upgrade" && (
          <UpgradePage
            billingStatus={billingStatusForUi}
            billingError={billingError}
            isLoading={isLoadingBillingStatus}
            isStartingCheckout={isStartingBillingCheckout}
            isOpeningPortal={isOpeningBillingPortal}
            onStartCheckout={(planId, interval) => void startBillingCheckout(planId, interval)}
            onOpenPortal={() => void openBillingPortal()}
            onReturn={() => setViewMode("single")}
          />
        )}`;

c = c.replace(modalRegex, newPageStr);

fs.writeFileSync('src/features/app/AuthenticatedWorkspace.tsx', c);

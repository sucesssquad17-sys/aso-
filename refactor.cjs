const fs = require('fs');
let c = fs.readFileSync('src/features/app/AuthenticatedWorkspace.tsx', 'utf8');

// Replace state setter usages
c = c.replace(/setIsBillingModalOpen\(true\)/g, 'setViewMode("upgrade")');

// Remove state initialization
c = c.replace(/const \[isBillingModalOpen, setIsBillingModalOpen\] = useState\(false\);\n?\s*/g, '');

// Replace import
c = c.replace(/import \{\s*UpgradeModal,\s*\} from "\.\.\/\.\.\/components\/UpgradeModal";/g, 'import { UpgradePage } from "./UpgradePage";');

// Now to replace the actual UpgradeModal render with `{viewMode === "upgrade" && <UpgradePage ... />}` near tracked.
// We also need to remove the `<UpgradeModal ... />` usage near line 15230.

fs.writeFileSync('src/features/app/AuthenticatedWorkspace.tsx', c);

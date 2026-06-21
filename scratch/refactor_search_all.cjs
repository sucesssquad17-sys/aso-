const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/features/app/AuthenticatedWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update Search Section condition
const oldSearchCond = `          {/* Search Section */}{" "}
          {visibleWorkspaceMode !== "bookmarks" &&
            visibleWorkspaceMode !== "tracked" &&
            visibleWorkspaceMode !== "reports" &&
            !(visibleWorkspaceMode === "single" && selectedApp) &&
            renderSearchSection(false)
          }`;

const newSearchCond = `          {/* Search Section */}{" "}
          {visibleWorkspaceMode !== "bookmarks" &&
            visibleWorkspaceMode !== "tracked" &&
            visibleWorkspaceMode !== "reports" &&
            !(visibleWorkspaceMode === "single" && selectedApp) &&
            !(visibleWorkspaceMode === "compare" && compareApps.length > 0) &&
            !(visibleWorkspaceMode === "competitors" && (competitorDraftOwnApp || competitorDraftApps.length > 0)) &&
            renderSearchSection(false)
          }`;

content = content.replace(oldSearchCond, newSearchCond);

// Add to competitors
const compStr = '          {/* Competitors Dashboard */}{" "}\n          {viewMode === "competitors" && (\n            <div className="space-y-6">\n              {competitorDraftStarted ? (';

const newCompStr = '          {/* Competitors Dashboard */}{" "}\n          {viewMode === "competitors" && (\n            <div className="space-y-6">\n              {/* Compact Search Section for Competitors */}\n              {(competitorDraftOwnApp || competitorDraftApps.length > 0) && renderSearchSection(true)}\n              {competitorDraftStarted ? (';

content = content.replace(compStr, newCompStr);

// Add to compare
const compareStr = '          {/* Compare Dashboard */}{" "}\n          {viewMode === "compare" && (\n            <div className="space-y-6">\n              {compareApps.length > 0 ? (';

const newCompareStr = '          {/* Compare Dashboard */}{" "}\n          {viewMode === "compare" && (\n            <div className="space-y-6">\n              {/* Compact Search Section for Compare */}\n              {compareApps.length > 0 && renderSearchSection(true)}\n              {compareApps.length > 0 ? (';

content = content.replace(compareStr, newCompareStr);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Refactor complete.");

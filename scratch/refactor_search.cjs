const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/features/app/AuthenticatedWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Find the search section
const searchSectionStartStr = '          {/* Search Section */}{" "}\n          {visibleWorkspaceMode !== "bookmarks" &&\n            visibleWorkspaceMode !== "tracked" &&\n            visibleWorkspaceMode !== "reports" && (\n            <WorkspacePanel className="mb-8 workspace-search-panel" tone="strong">';
const searchSectionEndStr = '            </WorkspacePanel>\n          )}{" "}\n          {/* Competitors Dashboard */}';

const startIndex = content.indexOf(searchSectionStartStr);
const endIndex = content.indexOf(searchSectionEndStr);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find search section bounds");
  process.exit(1);
}

// Extract the inner JSX of WorkspacePanel
const panelInnerStart = content.indexOf('<div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">', startIndex);
const panelInnerEnd = content.indexOf('            </WorkspacePanel>', panelInnerStart);

let innerJSX = content.substring(panelInnerStart, panelInnerEnd);

// Wrap the intro div with {!isCompact && ( ... )}
const formStart = innerJSX.indexOf('<form');
let introDiv = innerJSX.substring(0, formStart);
introDiv = '              {!isCompact && (\n' + introDiv.replace(/\s*$/, '\n              )}\n              ');
innerJSX = introDiv + innerJSX.substring(formStart);

// Create the renderSearchSection function
const renderFunction = `
  const renderSearchSection = (isCompact = false) => (
    <WorkspacePanel className={\`workspace-search-panel \${isCompact ? "p-3 mb-6" : "mb-8"}\`} tone={isCompact ? "muted" : "strong"}>
${innerJSX}    </WorkspacePanel>
  );
`;

// Find return ( to insert the function before it
const returnMatch = content.match(/  return \(\n    <ErrorBoundary>\n      <div className="workspace-shell/);
if (!returnMatch) {
  console.error("Could not find return statement");
  process.exit(1);
}

// Insert the function
content = content.substring(0, returnMatch.index) + renderFunction + content.substring(returnMatch.index);

// Replace the original search section
const replacementOriginal = `          {/* Search Section */}{" "}
          {visibleWorkspaceMode !== "bookmarks" &&
            visibleWorkspaceMode !== "tracked" &&
            visibleWorkspaceMode !== "reports" &&
            !(visibleWorkspaceMode === "single" && selectedApp) &&
            renderSearchSection(false)
          }`;

const origStart = content.indexOf(searchSectionStartStr);
const origEnd = content.indexOf(searchSectionEndStr) + searchSectionEndStr.length;
content = content.substring(0, origStart) + replacementOriginal + content.substring(origEnd - '          {/* Competitors Dashboard */}'.length);

// Insert the compact search section above Keyword Ranking Checker
const keywordCheckerStr = '              <div className="space-y-6">\n                {" "}\n                {/* Keyword Ranking Checker */}';
const keywordIndex = content.indexOf(keywordCheckerStr);
if (keywordIndex === -1) {
  console.error("Could not find Keyword Ranking Checker");
  process.exit(1);
}

const replacementKeyword = `              <div className="space-y-6">
                {" "}
                {/* Compact Search Section for Single Analysis */}
                {viewMode === "single" && selectedApp && renderSearchSection(true)}
                {" "}
                {/* Keyword Ranking Checker */}`;

content = content.replace(keywordCheckerStr, replacementKeyword);

// Replace flex grid with 3 column layout for discovered keywords
const discoveryGridOldStr = '<div className="flex flex-wrap gap-3">';
const discoveryGridNewStr = '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">';
content = content.replaceAll(discoveryGridOldStr, discoveryGridNewStr);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Refactor complete.");

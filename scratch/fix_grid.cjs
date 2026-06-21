const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/features/app/AuthenticatedWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldGridStr = '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">';
const newGridStr = '<div className="grid grid-cols-3 gap-2 sm:gap-3">';

content = content.replaceAll(oldGridStr, newGridStr);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Grid updated to exactly 3 cols");

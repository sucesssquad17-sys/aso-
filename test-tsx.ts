const val = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if(!val) {
  console.log('No FIREBASE_SERVICE_ACCOUNT_JSON');
  process.exit(1);
}
let cleanJsonStr = val.trim();
if (
  (cleanJsonStr.startsWith("'") && cleanJsonStr.endsWith("'")) ||
  (cleanJsonStr.startsWith('"') && cleanJsonStr.endsWith('"'))
) {
  cleanJsonStr = cleanJsonStr.slice(1, -1);
}
try {
  const parsed = JSON.parse(cleanJsonStr);
  console.log('Parse successful, keys:', Object.keys(parsed));
} catch(e) {
  console.error('Parse error:', e.message);
  console.log('Raw string start:', val.substring(0, 50));
  console.log('Clean string start:', cleanJsonStr.substring(0, 50));
}

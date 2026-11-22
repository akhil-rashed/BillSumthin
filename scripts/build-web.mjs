import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const wwwDir = path.join(rootDir, 'www');

const requiredPages = [
  'index.html',
  'auth.html',
  'pre-loader.html',
  'scan.html',
  'bill-details.html',
  'history.html',
  'spending.html',
  'categories.html',
  'settings.html',
  'features.html',
  'ocr.html'
];

const requiredDirs = ['css', 'js', 'locales', 'assets'];

console.log('Validating BillSumthin web assets...');

for (const dir of requiredDirs) {
  const target = path.join(wwwDir, dir);
  if (!fs.existsSync(target)) {
    console.error(`Missing required directory: www/${dir}`);
    process.exit(1);
  }
}

for (const page of requiredPages) {
  const target = path.join(wwwDir, page);
  if (!fs.existsSync(target)) {
    console.error(`Missing required page: www/${page}`);
    process.exit(1);
  }
}

// Validate JSON locale files
const localesDir = path.join(wwwDir, 'locales');
const localeFiles = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'));
for (const file of localeFiles) {
  const fullPath = path.join(localesDir, file);
  try {
    JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (err) {
    console.error(`Invalid JSON in www/locales/${file}:`, err.message);
    process.exit(1);
  }
}

console.log(`Validated ${requiredPages.length} HTML pages and ${localeFiles.length} locale files in www/.`);

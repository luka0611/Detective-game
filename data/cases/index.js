const fs = require('fs');
const path = require('path');

const casesDir = __dirname;

function loadCases() {
  return fs
    .readdirSync(casesDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const fullPath = path.join(casesDir, file);
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    });
}

module.exports = loadCases();

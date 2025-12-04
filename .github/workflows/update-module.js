const fs = require('fs');
const path = require('path');

console.log('Full process.argv:', process.argv);

const version = process.argv[2];

console.log('Extracted version (raw):', version);
console.log('Extracted version (trimmed):', version ? version.trim() : version);

if (!version || version.trim() === '') {
  console.error('No version specified');
  console.error('Process details:', {
    cwd: process.cwd(),
    argv: process.argv,
    env: process.env
  });
  process.exit(1);
}

const moduleJsonPath = path.join(__dirname, '../../module.json');

console.log('Module JSON path:', moduleJsonPath);

fs.readFile(moduleJsonPath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading module.json: ${err}`);
    return;
  }

  let moduleJson;
  try {
    moduleJson = JSON.parse(data);
  } catch (err) {
    console.error(`Error parsing module.json: ${err}`);
    return;
  }

  moduleJson.version = version;
  moduleJson.download = `${moduleJson.url}/releases/download/${version}/module.zip`;

  fs.writeFile(moduleJsonPath, JSON.stringify(moduleJson, null, 2), 'utf8', (err) => {
    if (err) {
      console.error(`Error writing module.json: ${err}`);
      return;
    }

    console.log(`module.json successfully updated to version ${version}`);
  });
});

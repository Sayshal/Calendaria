import { existsSync, lstatSync, readlinkSync, symlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) =>
    rl.question(question, (a) => {
      rl.close();
      r(a.trim());
    })
  );
}
async function resolvePath(envVar, name) {
  const envValue = process.env[envVar];
  if (envValue && existsSync(envValue)) {
    console.log(`  Found ${name} via ${envVar}: ${envValue}`);
    return resolve(envValue);
  }
  const userPath = await ask(`  Enter path to ${name}: `);
  if (!userPath || !existsSync(userPath)) {
    console.error(`  Path does not exist: ${userPath || '(empty)'}`);
    process.exit(1);
  }
  return resolve(userPath);
}
function createLink(target, linkPath, name) {
  if (existsSync(linkPath)) {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const existing = resolve(readlinkSync(linkPath));
      if (existing === target) {
        console.log(`  ${name} symlink already correct.`);
        return;
      }
    }
    console.error(`  ${linkPath} already exists and is not the expected symlink. Remove it manually and retry.`);
    process.exit(1);
  }
  symlinkSync(target, linkPath, 'junction');
  console.log(`  Created ${name} symlink: ${linkPath} -> ${target}`);
}
console.log('Calendaria — Intellisense Setup\n');
console.log('Resolving Foundry VTT...');
const foundryPath = await resolvePath('FOUNDRY_PATH', 'Foundry VTT');
console.log('\nCreating symlinks...');
createLink(foundryPath, join(ROOT, 'foundry'), 'foundry');
createLink(resolve(ROOT, '..', 'dnd5e'), join(ROOT, 'dnd5e'), 'dnd5e');
console.log('\nDone! IDE intellisense for @client/* and @common/* should now work.');

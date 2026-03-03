/**
 * Setup script to create a symlink for the Foundry VTT source folder.
 * Provides @client/* and @common/* path alias resolution for IDE intellisense.
 *
 * Usage:
 *   npm run setup
 *   FOUNDRY_PATH="C:/path/to/foundry" npm run setup
 */

import { existsSync, symlinkSync, lstatSync, readlinkSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

/**
 * Prompt user for input via readline.
 * @param {string} question The prompt text
 * @returns {Promise<string>} User's response
 */
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) =>
    rl.question(question, (a) => {
      rl.close();
      r(a.trim());
    })
  );
}

/**
 * Resolve a path from env var or user prompt.
 * @param {string} envVar Environment variable name to check
 * @param {string} name Human-readable name for prompts
 * @returns {Promise<string>} Resolved path
 */
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

/**
 * Create a directory symlink, skipping if already correct.
 * @param {string} target The source path to link to
 * @param {string} linkPath The symlink destination path
 * @param {string} name Human-readable name for logging
 */
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

// ---

console.log('Calendaria — Intellisense Setup\n');

console.log('Resolving Foundry VTT...');
const foundryPath = await resolvePath('FOUNDRY_PATH', 'Foundry VTT');

console.log('\nCreating symlinks...');
createLink(foundryPath, join(ROOT, 'foundry'), 'foundry');
createLink(resolve(ROOT, '..', 'dnd5e'), join(ROOT, 'dnd5e'), 'dnd5e');

console.log('\nDone! IDE intellisense for @client/* and @common/* should now work.');

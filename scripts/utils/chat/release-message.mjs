/**
 * Release announcement chat message for new module versions.
 * @module ReleaseMessage
 */

import { MODULE } from '../../constants.mjs';

/**
 * Check if a release message should be shown, and post it if so.
 */
export async function checkReleaseMessage() {
  if (!game.user.isGM) return;
  const version = game.modules.get(MODULE.ID)?.version;
  if (!version) return;
  const lastSeen = game.user.getFlag(MODULE.ID, 'lastSeenVersion');
  if (lastSeen === version) return;
  const repoUrl = `https://github.com/Timemaster-Games/calendaria/releases/tag/release-${version}`;
  const content = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE.ID}/templates/chat/release-message.hbs`, { version, repoUrl });
  await ChatMessage.create({ content, whisper: [game.user.id], speaker: { alias: MODULE.TITLE } });
  await game.user.setFlag(MODULE.ID, 'lastSeenVersion', version);
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODULE, SETTINGS } from '../../scripts/constants.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';
import { countCalendarNotes, onUpdateModuleConfiguration, promptNoteCleanupBeforeDisable, removeAllCalendarNotes } from '../../scripts/utils/deactivation.mjs';

vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getAllNotes: vi.fn(() => []),
    deleteAllNotes: vi.fn(async () => 0)
  }
}));

const MODULE_CONFIG_SETTING = { key: 'core.moduleConfiguration' };
const disabling = { value: JSON.stringify({ [MODULE.ID]: false, 'other-module': true }) };
const stillEnabled = { value: JSON.stringify({ [MODULE.ID]: true, 'other-module': false }) };

describe('deactivation', () => {
  let confirm;
  let reloadPrompt;
  let reloadConfirm;

  beforeEach(() => {
    NoteManager.getAllNotes.mockImplementation(() => [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    NoteManager.deleteAllNotes.mockImplementation(async () => 3);
    game.user.id = 'test-user';
    game.user.isGM = true;
    game.modules.get.mockImplementation((id) => (id === MODULE.ID ? { active: true } : null));
    game.settings.set.mockImplementation(async () => true);
    game.settings.get.mockImplementation(() => ({ [MODULE.ID]: false }));
    confirm = vi.fn(async () => false);
    reloadPrompt = { close: vi.fn(async () => {}) };
    reloadConfirm = vi.fn();
    foundry.applications.api.DialogV2.confirm = confirm;
    foundry.applications.instances.get.mockImplementation((id) => (id === 'reload-world-confirm' ? reloadPrompt : null));
    foundry.applications.settings = { ...(foundry.applications.settings ?? {}), SettingsConfig: { reloadConfirm } };
  });

  describe('countCalendarNotes', () => {
    it('reports the number of tracked notes', () => {
      expect(countCalendarNotes()).toBe(3);
    });
  });

  describe('removeAllCalendarNotes', () => {
    it('deletes every note and clears the festival seed record', async () => {
      const removed = await removeAllCalendarNotes();
      expect(removed).toBe(3);
      expect(NoteManager.deleteAllNotes).toHaveBeenCalledTimes(1);
      expect(game.settings.set).toHaveBeenCalledWith(MODULE.ID, SETTINGS.SEEDED_CALENDARS, expect.any(Set));
      expect(game.settings.set.mock.calls[0][2].size).toBe(0);
    });
  });

  describe('onUpdateModuleConfiguration', () => {
    it('ignores settings other than the module configuration', () => {
      expect(onUpdateModuleConfiguration({ key: 'core.time' }, disabling, {}, 'test-user')).toBeUndefined();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('ignores changes saved by another user', () => {
      expect(onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, disabling, {}, 'someone-else')).toBeUndefined();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('ignores changes when the current user is not a GM', () => {
      game.user.isGM = false;
      expect(onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, disabling, {}, 'test-user')).toBeUndefined();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('ignores saves that leave Calendaria enabled', () => {
      expect(onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, stillEnabled, {}, 'test-user')).toBeUndefined();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('ignores saves when the module is not active', () => {
      game.modules.get.mockImplementation(() => ({ active: false }));
      expect(onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, disabling, {}, 'test-user')).toBeUndefined();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('prompts when Calendaria is switched off', async () => {
      const result = onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, disabling, {}, 'test-user');
      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('falls back to the stored setting when the change payload is unreadable', async () => {
      await onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, { value: '{not json' }, {}, 'test-user');
      expect(game.settings.get).toHaveBeenCalledWith('core', 'moduleConfiguration');
      expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('accepts an already-parsed change payload', async () => {
      await onUpdateModuleConfiguration(MODULE_CONFIG_SETTING, { value: { [MODULE.ID]: false } }, {}, 'test-user');
      expect(confirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('promptNoteCleanupBeforeDisable', () => {
    it('removes the notes when the GM confirms', async () => {
      confirm.mockImplementation(async () => true);
      const removed = await promptNoteCleanupBeforeDisable();
      expect(removed).toBe(true);
      expect(NoteManager.deleteAllNotes).toHaveBeenCalledTimes(1);
      expect(game.settings.set).toHaveBeenCalledWith(MODULE.ID, SETTINGS.SEEDED_CALENDARS, expect.any(Set));
      expect(ui.notifications.info).toHaveBeenCalledTimes(1);
    });

    it('keeps the notes when the GM declines', async () => {
      const removed = await promptNoteCleanupBeforeDisable();
      expect(removed).toBe(false);
      expect(NoteManager.deleteAllNotes).not.toHaveBeenCalled();
      expect(game.settings.set).not.toHaveBeenCalled();
    });

    it('keeps the notes when the dialog is dismissed', async () => {
      confirm.mockImplementation(async () => null);
      expect(await promptNoteCleanupBeforeDisable()).toBe(false);
      expect(NoteManager.deleteAllNotes).not.toHaveBeenCalled();
    });

    it('closes the reload prompt before asking and re-opens it afterwards', async () => {
      await promptNoteCleanupBeforeDisable();
      expect(reloadPrompt.close).toHaveBeenCalledTimes(1);
      expect(reloadPrompt.close.mock.invocationCallOrder[0]).toBeLessThan(confirm.mock.invocationCallOrder[0]);
      expect(reloadConfirm).toHaveBeenCalledWith({ world: true });
      expect(confirm.mock.invocationCallOrder[0]).toBeLessThan(reloadConfirm.mock.invocationCallOrder[0]);
    });

    it('does not re-open a reload prompt that was never shown', async () => {
      foundry.applications.instances.get.mockImplementation(() => null);
      await promptNoteCleanupBeforeDisable();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(reloadConfirm).not.toHaveBeenCalled();
    });

    it('skips the prompt entirely when there are no notes', async () => {
      NoteManager.getAllNotes.mockImplementation(() => []);
      expect(await promptNoteCleanupBeforeDisable()).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
      expect(reloadPrompt.close).not.toHaveBeenCalled();
      expect(reloadConfirm).not.toHaveBeenCalled();
    });
  });
});

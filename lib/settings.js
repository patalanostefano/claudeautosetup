import fs from 'fs';
import path from 'path';

export function readSettings(projectPath) {
  const settingsPath = path.join(projectPath, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

export function writeSettings(projectPath, obj) {
  const settingsDir = path.join(projectPath, '.claude');
  const settingsPath = path.join(settingsDir, 'settings.json');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(obj, null, 2));
}

export function mergeHooks(settings, newHooks) {
  const result = { ...settings };
  if (!result.hooks) result.hooks = {};

  for (const [event, entries] of Object.entries(newHooks)) {
    if (!result.hooks[event]) {
      result.hooks[event] = [];
    }
    for (const entry of entries) {
      const alreadyExists = result.hooks[event].some(
        existing => JSON.stringify(existing) === JSON.stringify(entry)
      );
      if (!alreadyExists) {
        result.hooks[event].push(entry);
      }
    }
  }
  return result;
}

export function removeHooks(settings, hookEntries) {
  const result = { ...settings };
  if (!result.hooks) return result;

  for (const [event, entries] of Object.entries(hookEntries)) {
    if (!result.hooks[event]) continue;
    result.hooks[event] = result.hooks[event].filter(existing => {
      return !entries.some(
        entry => JSON.stringify(entry) === JSON.stringify(existing)
      );
    });
    if (result.hooks[event].length === 0) {
      delete result.hooks[event];
    }
  }
  if (Object.keys(result.hooks).length === 0) {
    delete result.hooks;
  }
  return result;
}

export function mergePermissions(settings, allow = [], deny = []) {
  const result = { ...settings };
  if (!result.permissions) result.permissions = {};

  if (allow.length > 0) {
    result.permissions.allow = [
      ...new Set([...(result.permissions.allow || []), ...allow]),
    ];
  }
  if (deny.length > 0) {
    result.permissions.deny = [
      ...new Set([...(result.permissions.deny || []), ...deny]),
    ];
  }
  return result;
}

export function removePermissions(settings, allow = [], deny = []) {
  const result = { ...settings };
  if (!result.permissions) return result;

  if (allow.length > 0 && result.permissions.allow) {
    result.permissions.allow = result.permissions.allow.filter(
      p => !allow.includes(p)
    );
  }
  if (deny.length > 0 && result.permissions.deny) {
    result.permissions.deny = result.permissions.deny.filter(
      p => !deny.includes(p)
    );
  }
  return result;
}

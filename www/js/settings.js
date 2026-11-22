import { getAllSettings, setSetting } from './storage.js';

export function applyTheme(themePref = 'system') {
  let resolved = themePref;
  if (themePref === 'system') {
    resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);
}

export async function loadAndApplySettings() {
  const settings = await getAllSettings();
  applyTheme(settings.theme);
  return settings;
}

export async function updateSetting(key, value) {
  await setSetting(key, value);
  if (key === 'theme') applyTheme(value);
}

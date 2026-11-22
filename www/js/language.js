const RTL_CODES = new Set(['ar', 'ur', 'fa', 'he', 'ps', 'ku']);

let languagesManifest = null;
let baseDict = {};
let activeDict = {};
let currentLang = 'en';

export async function loadLanguageManifest() {
  if (languagesManifest) return languagesManifest;
  try {
    const res = await fetch('./locales/languages.json');
    languagesManifest = await res.json();
  } catch {
    languagesManifest = { languages: [{ code: 'en', name: 'English', nativeName: 'English', rtl: false, hasFile: true }], inlineTranslations: {} };
  }
  return languagesManifest;
}

export async function initLanguage(langCode = 'en') {
  await loadLanguageManifest();
  if (!Object.keys(baseDict).length) {
    try {
      const enRes = await fetch('./locales/en.json');
      baseDict = await enRes.json();
    } catch {
      baseDict = {};
    }
  }

  currentLang = langCode || 'en';
  const langMeta = languagesManifest.languages.find((l) => l.code === currentLang);
  let loaded = {};

  if (currentLang !== 'en') {
    if (langMeta?.hasFile) {
      try {
        const res = await fetch(`./locales/${currentLang}.json`);
        if (res.ok) loaded = await res.json();
      } catch {
        loaded = {};
      }
    } else if (languagesManifest.inlineTranslations?.[currentLang]) {
      loaded = languagesManifest.inlineTranslations[currentLang];
    }
  }

  activeDict = { ...baseDict, ...loaded };
  const isRtl = Boolean(langMeta?.rtl || RTL_CODES.has(currentLang));
  document.documentElement.lang = currentLang;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  applyTranslations();
  return currentLang;
}

export function t(key, fallback = '') {
  return activeDict[key] || baseDict[key] || fallback || key;
}

export function getCurrentLanguage() {
  return currentLang;
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key, el.textContent);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key, el.getAttribute('placeholder') || ''));
  });
}

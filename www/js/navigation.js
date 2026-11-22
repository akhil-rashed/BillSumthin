import { Icons, isCapacitorNative } from './utils.js';
import { t } from './language.js';

const NAV_TABS = [
  { id: 'scan', href: 'scan.html', labelKey: 'nav.scan', icon: Icons.scan },
  { id: 'history', href: 'history.html', labelKey: 'nav.history', icon: Icons.history },
  { id: 'spending', href: 'spending.html', labelKey: 'nav.spending', icon: Icons.spending },
  { id: 'categories', href: 'categories.html', labelKey: 'nav.categories', icon: Icons.categories },
  { id: 'settings', href: 'settings.html', labelKey: 'nav.settings', icon: Icons.settings }
];

export function renderBottomNav(activeTab) {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Primary Navigation');
  nav.innerHTML = `
    <div class="bottom-nav-inner">
      ${NAV_TABS.map((tab) => `
        <a href="${tab.href}" class="nav-item ${tab.id === activeTab ? 'active' : ''}" aria-current="${tab.id === activeTab ? 'page' : 'false'}">
          <span class="nav-item-icon">${tab.icon}</span>
          <span class="nav-item-label" data-i18n="${tab.labelKey}">${t(tab.labelKey)}</span>
        </a>
      `).join('')}
    </div>
  `;
}

export function initBackButtonHandler(rootPages = ['scan.html', 'index.html', 'auth.html', '']) {
  if (!isCapacitorNative()) return;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;

  appPlugin.addListener('backButton', ({ canGoBack }) => {
    // 1. Close open sheet or dialog or camera overlay first
    const openSheet = document.querySelector('.sheet-backdrop.open');
    if (openSheet) {
      openSheet.classList.remove('open');
      return;
    }
    const openDialog = document.querySelector('.dialog-backdrop.open');
    if (openDialog) {
      openDialog.classList.remove('open');
      return;
    }
    const openCam = document.querySelector('.camera-sheet.open');
    if (openCam) {
      openCam.classList.remove('open');
      return;
    }

    const pathName = window.location.pathname.split('/').pop() || '';
    if (rootPages.includes(pathName)) {
      appPlugin.exitApp();
    } else if (pathName === 'bill-details.html' || pathName === 'history.html' || pathName === 'spending.html' || pathName === 'categories.html' || pathName === 'settings.html') {
      if (pathName === 'bill-details.html' && canGoBack) {
        window.history.back();
      } else {
        window.location.href = 'scan.html';
      }
    } else if (canGoBack) {
      window.history.back();
    } else {
      window.location.href = 'scan.html';
    }
  });
}

import { Icons, escapeHtml } from './utils.js';
import { initLanguage, t } from './language.js';
import { loadAndApplySettings } from './settings.js';
import { initBackButtonHandler, renderBottomNav } from './navigation.js';

export async function bootstrapPage({ activeTab = null } = {}) {
  const settings = await loadAndApplySettings();
  await initLanguage(settings.language || 'en');

  if (activeTab) {
    renderBottomNav(activeTab);
  }
  initBackButtonHandler();
  initOfflineIndicator();
  ensureGlobalOverlays();

  // Listen to system theme changes
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const latest = await loadAndApplySettings();
    if (latest.theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
  });

  return settings;
}

function initOfflineIndicator() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  const syncState = () => {
    banner.classList.toggle('visible', !navigator.onLine);
  };
  window.addEventListener('online', syncState);
  window.addEventListener('offline', syncState);
  syncState();
}

function ensureGlobalOverlays() {
  if (!document.getElementById('toastContainer')) {
    const tc = document.createElement('div');
    tc.id = 'toastContainer';
    tc.className = 'toast-container';
    document.body.appendChild(tc);
  }
}

export function showToast(message, iconHtml = Icons.check) {
  ensureGlobalOverlays();
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span style="width:18px;height:18px;display:inline-flex;flex-shrink:0;">${iconHtml}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 200ms ease';
    setTimeout(() => el.remove(), 220);
  }, 2600);
}

export function openSheet({ title, bodyHtml, onMount }) {
  let backdrop = document.getElementById('globalSheetBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'globalSheetBackdrop';
    backdrop.className = 'sheet-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSheet();
    });
    document.body.appendChild(backdrop);
  }
  backdrop.innerHTML = `
    <div class="sheet-panel" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h2 class="sheet-title">${escapeHtml(title)}</h2>
        <button type="button" class="icon-btn" id="sheetCloseBtn" aria-label="${escapeHtml(t('common.close', 'Close'))}">
          <span style="width:18px;height:18px;">${Icons.x}</span>
        </button>
      </div>
      <div id="globalSheetBody">${bodyHtml}</div>
    </div>
  `;
  backdrop.classList.add('open');
  document.getElementById('sheetCloseBtn')?.addEventListener('click', closeSheet);
  if (typeof onMount === 'function') onMount(document.getElementById('globalSheetBody'));
}

export function closeSheet() {
  document.getElementById('globalSheetBackdrop')?.classList.remove('open');
}

export function showDialog({ title, message, confirmLabel = 'Confirm', danger = false, cancelLabel = 'Cancel', onConfirm }) {
  let backdrop = document.getElementById('globalDialogBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'globalDialogBackdrop';
    backdrop.className = 'dialog-backdrop';
    document.body.appendChild(backdrop);
  }
  backdrop.innerHTML = `
    <div class="dialog-panel" role="alertdialog" aria-modal="true">
      <h2 style="font-size:17px;font-weight:700;">${escapeHtml(title)}</h2>
      <p class="text-small text-muted">${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="dialogCancelBtn">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" id="dialogConfirmBtn">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;
  backdrop.classList.add('open');
  document.getElementById('dialogCancelBtn')?.addEventListener('click', () => backdrop.classList.remove('open'));
  document.getElementById('dialogConfirmBtn')?.addEventListener('click', async () => {
    backdrop.classList.remove('open');
    if (typeof onConfirm === 'function') await onConfirm();
  });
}

let analysisInterval = null;

export function showAnalysisLoading() {
  let overlay = document.getElementById('analysisOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'analysisOverlay';
    overlay.className = 'analysis-overlay';
    overlay.innerHTML = `
      <div class="analysis-spinner-ring"><div class="spinner"></div></div>
      <div class="analysis-status-text" id="analysisStatusText"></div>
      <div class="analysis-sub-text">BillSumthin</div>
    `;
    document.body.appendChild(overlay);
  }
  const steps = [
    t('analysis.step1', 'Reading your bill'),
    t('analysis.step2', 'Finding important details'),
    t('analysis.step3', 'Checking totals'),
    t('analysis.step4', 'Looking for unusual changes'),
    t('analysis.step5', 'Preparing your summary')
  ];
  let idx = 0;
  const label = document.getElementById('analysisStatusText');
  if (label) label.textContent = steps[0];
  clearInterval(analysisInterval);
  analysisInterval = setInterval(() => {
    idx = (idx + 1) % steps.length;
    if (label) label.textContent = steps[idx];
  }, 1100);
  overlay.classList.add('open');
}

export function hideAnalysisLoading() {
  clearInterval(analysisInterval);
  document.getElementById('analysisOverlay')?.classList.remove('open');
}

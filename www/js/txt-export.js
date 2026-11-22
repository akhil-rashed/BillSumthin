import { formatMoney } from './currency.js';
import { formatBillTypeLabel } from './bill-analyzer.js';
import { getCategoryMeta } from './categories.js';
import { getPlugin, isCapacitorNative } from './utils.js';

export function formatBillsAsTxt(bills) {
  const header = ['BILLSUMTHIN', 'Understand Any Bill', '========================================', ''];
  const blocks = bills.map((b) => {
    const cur = b.currencyCode || 'BDT';
    const sym = b.currencySymbol || '';
    const cat = getCategoryMeta(b.category);
    const lines = [
      `Bill Type: ${formatBillTypeLabel(b.documentType)}`,
      `Provider: ${b.provider || 'Not detected'}`,
      `Date: ${b.issueDate || b.createdAt?.slice(0, 10) || 'Not detected'}`,
      `Total: ${formatMoney(b.total, cur, sym)}`,
      `Category: ${cat.name}`
    ];
    if (b.suspiciousChange) {
      lines.push(`Previous: ${formatMoney(b.suspiciousChange.previousTotal, cur, sym)}`);
      const sign = b.suspiciousChange.direction === 'increase' ? '+' : '-';
      lines.push(`Change: ${sign}${b.suspiciousChange.roundedPercent}%`);
    }
    if (b.recurring) {
      lines.push(`Recurring: Yes (~${formatMoney(b.recurringEstimate || b.total, cur, sym)}/month)`);
    }
    lines.push('----------------------------------------');
    return lines.join('\n');
  });
  return [...header, ...blocks].join('\n');
}

export async function exportBillsAsTxt(bills, fileName = 'BillSumthin.txt') {
  const txt = formatBillsAsTxt(Array.isArray(bills) ? bills : [bills]);

  if (isCapacitorNative()) {
    const exporter = getPlugin('NativeFileExport');
    if (exporter?.saveAndShare) {
      try {
        const base64Data = btoa(unescape(encodeURIComponent(txt)));
        return await exporter.saveAndShare({
          fileName,
          mimeType: 'text/plain',
          base64Data
        });
      } catch {
        return { ok: false, error: 'Could not export TXT file.' };
      }
    }
  }

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { ok: true, fileName };
}

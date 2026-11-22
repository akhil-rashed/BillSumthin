import { addPriceHistoryEntries, getAllBills, getPriceHistoryForItem } from './storage.js';
import { uid } from './utils.js';

export function normalizeItemForPriceHistory(rawName, amount) {
  const src = String(rawName || '').trim();
  if (!src || typeof amount !== 'number' || amount <= 0) return null;

  // Match patterns like "Rice 5kg", "5 KG Rice", "Rice - 5 kg"
  const weightMatch = src.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ltr|liter|litre|ml|pcs|pc|unit)\b/i);
  let quantity = 1;
  let unit = 'unit';
  let cleanName = src;

  if (weightMatch) {
    quantity = Number.parseFloat(weightMatch[1]) || 1;
    unit = weightMatch[2].toLowerCase();
    if (unit === 'g') {
      quantity = quantity / 1000;
      unit = 'kg';
    } else if (unit === 'ml') {
      quantity = quantity / 1000;
      unit = 'l';
    } else if (unit === 'ltr' || unit === 'liter' || unit === 'litre') {
      unit = 'l';
    }
    cleanName = src.replace(weightMatch[0], ' ');
  }

  cleanName = cleanName
    .replace(/[—–\-:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleanName || cleanName.length < 2) return null;

  const unitPrice = Number((amount / Math.max(0.001, quantity)).toFixed(2));
  return {
    normalizedName: cleanName,
    displayName: cleanName.replace(/\b\w/g, (c) => c.toUpperCase()),
    unit,
    unitPrice
  };
}

export async function analyzeBillAgainstHistory(bill, suspiciousThresholdPct = 25) {
  const existingBills = await getAllBills();
  const matches = existingBills.filter((prev) => {
    if (prev.id === bill.id) return false;
    const sameType = prev.documentType === bill.documentType && bill.documentType !== 'unknown_bill';
    const sameProvider =
      prev.provider &&
      bill.provider &&
      prev.provider !== 'Not detected' &&
      prev.provider.toLowerCase() === bill.provider.toLowerCase();
    return sameProvider || sameType;
  });

  const enriched = { ...bill };

  // 1. Suspicious Change Detection
  if (matches.length && typeof bill.total === 'number' && bill.total > 0) {
    const prev = matches[0];
    if (typeof prev.total === 'number' && prev.total > 0 && prev.currencyCode === bill.currencyCode) {
      enriched.previousBillId = prev.id;
      const diff = bill.total - prev.total;
      const pct = ((diff / prev.total) * 100);
      const absPct = Math.abs(pct);
      const roundedPct = Math.round(absPct);

      if (absPct >= suspiciousThresholdPct && Math.abs(diff) >= 20) {
        enriched.suspiciousChange = {
          previousTotal: prev.total,
          currentTotal: bill.total,
          difference: Number(diff.toFixed(2)),
          percentChange: Number(pct.toFixed(2)),
          roundedPercent: roundedPct,
          direction: diff > 0 ? 'increase' : 'decrease',
          previousDate: prev.issueDate || prev.createdAt
        };
      }
    }
  }

  // 2. Recurring Charge Detection (needs >= 2 prior similar bills or 1 prior with similar amount)
  if (matches.length >= 1 && typeof bill.total === 'number' && bill.total > 0) {
    const similarAmounts = matches.filter((m) => {
      if (typeof m.total !== 'number' || m.total <= 0) return false;
      const ratio = Math.abs(m.total - bill.total) / m.total;
      return ratio <= 0.15;
    });
    if (similarAmounts.length >= 1) {
      const avg = Math.round(
        [bill.total, ...similarAmounts.map((m) => m.total)].reduce((a, b) => a + b, 0) /
          (similarAmounts.length + 1)
      );
      enriched.recurring = true;
      enriched.recurringConfidence = similarAmounts.length >= 2 ? 0.9 : 0.72;
      enriched.recurringEstimate = avg;
    }
  }

  // 3. Price History Tracking
  const dateStr = bill.issueDate || bill.createdAt || new Date().toISOString();
  const newEntries = [];
  const priceSummaries = [];

  for (const item of bill.items || []) {
    const norm = normalizeItemForPriceHistory(item.name, item.amount);
    if (!norm) continue;
    const entry = {
      id: uid('ph'),
      billId: bill.id,
      normalizedName: norm.normalizedName,
      displayName: norm.displayName,
      unit: norm.unit,
      unitPrice: norm.unitPrice,
      currencyCode: bill.currencyCode,
      currencySymbol: bill.currencySymbol,
      date: dateStr
    };
    newEntries.push(entry);

    const prior = await getPriceHistoryForItem(norm.normalizedName);
    const allPoints = [...prior, entry];
    if (allPoints.length >= 2) {
      const prices = allPoints.map((p) => p.unitPrice);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
      const first = allPoints[0].unitPrice;
      const changePct = first > 0 ? Math.round(((norm.unitPrice - first) / first) * 100) : 0;
      priceSummaries.push({
        itemName: norm.displayName,
        unit: norm.unit,
        latestPrice: norm.unitPrice,
        lowestPrice: min,
        highestPrice: max,
        averagePrice: avg,
        changePercent: changePct,
        points: allPoints.slice(-12)
      });
    }
  }

  if (newEntries.length) {
    await addPriceHistoryEntries(newEntries);
  }
  enriched.priceHistory = priceSummaries;

  return enriched;
}

export function filterBills(bills, { query = '', category = 'all', range = 'all', customStart = null, customEnd = null } = {}) {
  const q = query.trim().toLowerCase();
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return bills.filter((b) => {
    if (category !== 'all' && b.category !== category) return false;

    const d = new Date(b.issueDate || b.createdAt);
    if (range === 'this_month' && d < startOfThisMonth) return false;
    if (range === 'last_month' && (d < startOfLastMonth || d > endOfLastMonth)) return false;
    if (range === 'this_year' && d < startOfYear) return false;
    if (range === 'custom') {
      if (customStart && d < new Date(customStart)) return false;
      if (customEnd && d > new Date(`${customEnd}T23:59:59`)) return false;
    }

    if (q) {
      const hay = [
        b.provider,
        b.documentType,
        b.category,
        ...(b.items || []).map((i) => i.name)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

import { Icons } from './utils.js';
import { getCategoryPreference, saveCategoryPreference } from './storage.js';

export const CATEGORIES = [
  { id: 'utilities', name: 'Utilities', color: '#2563EB', soft: 'rgba(37,99,235,0.12)', icon: Icons.zap },
  { id: 'internet_comm', name: 'Internet & Communication', color: '#0891B2', soft: 'rgba(8,145,178,0.12)', icon: Icons.wifi },
  { id: 'housing', name: 'Housing', color: '#7C3AED', soft: 'rgba(124,58,237,0.12)', icon: Icons.home },
  { id: 'food', name: 'Food', color: '#16A34A', soft: 'rgba(22,163,74,0.12)', icon: Icons.cart },
  { id: 'transportation', name: 'Transportation', color: '#EA580C', soft: 'rgba(234,88,12,0.12)', icon: Icons.car },
  { id: 'education', name: 'Education', color: '#4F46E5', soft: 'rgba(79,70,229,0.12)', icon: Icons.book },
  { id: 'healthcare', name: 'Healthcare', color: '#E11D48', soft: 'rgba(225,29,72,0.12)', icon: Icons.heart },
  { id: 'insurance', name: 'Insurance', color: '#0D9488', soft: 'rgba(13,148,136,0.12)', icon: Icons.shield },
  { id: 'loans', name: 'Loans & Credit', color: '#D97706', soft: 'rgba(217,119,6,0.12)', icon: Icons.fileText },
  { id: 'government', name: 'Government Fees', color: '#475569', soft: 'rgba(71,85,105,0.12)', icon: Icons.landmark },
  { id: 'entertainment', name: 'Entertainment', color: '#DB2777', soft: 'rgba(219,39,119,0.12)', icon: Icons.tag },
  { id: 'other', name: 'Other', color: '#6B7280', soft: 'rgba(107,114,128,0.12)', icon: Icons.categories }
];

export function getCategoryMeta(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
}

export async function resolveBillCategory(bill) {
  if (bill.provider && bill.provider !== 'Not detected') {
    const learned = await getCategoryPreference(bill.provider);
    if (learned) return learned;
  }
  return bill.category || 'other';
}

export async function learnCategoryOverride(bill, newCategoryId) {
  if (bill.provider && bill.provider !== 'Not detected') {
    await saveCategoryPreference(bill.provider, newCategoryId);
  }
}

export function aggregateCategories(bills) {
  const map = new Map();
  for (const cat of CATEGORIES) {
    map.set(cat.id, { ...cat, total: 0, count: 0, bills: [] });
  }
  for (const b of bills) {
    const id = map.has(b.category) ? b.category : 'other';
    const entry = map.get(id);
    entry.count += 1;
    if (typeof b.total === 'number' && Number.isFinite(b.total)) {
      entry.total += b.total;
    }
    entry.bills.push(b);
  }
  return Array.from(map.values());
}

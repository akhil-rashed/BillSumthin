import { detectCurrencyFromText } from './currency.js';
import { callSecureAiAnalyzer } from './firebase.js';
import { maskSensitiveNumber, parseLocaleNumber, uid } from './utils.js';

export const BILL_TYPES = [
  'electricity_bill',
  'gas_bill',
  'water_bill',
  'internet_bill',
  'mobile_postpaid_bill',
  'mobile_recharge',
  'tv_cable_bill',
  'landline_bill',
  'rent_bill',
  'building_maintenance',
  'garbage_municipal_bill',
  'credit_card_bill',
  'loan_emi_bill',
  'insurance_premium',
  'school_college_fee',
  'grocery_receipt',
  'government_fee',
  'unknown_bill'
];

const TYPE_TO_CATEGORY = {
  electricity_bill: 'utilities',
  gas_bill: 'utilities',
  water_bill: 'utilities',
  garbage_municipal_bill: 'utilities',
  internet_bill: 'internet_comm',
  mobile_postpaid_bill: 'internet_comm',
  mobile_recharge: 'internet_comm',
  tv_cable_bill: 'internet_comm',
  landline_bill: 'internet_comm',
  rent_bill: 'housing',
  building_maintenance: 'housing',
  grocery_receipt: 'food',
  school_college_fee: 'education',
  insurance_premium: 'insurance',
  credit_card_bill: 'loans',
  loan_emi_bill: 'loans',
  government_fee: 'government',
  unknown_bill: 'other'
};

const BD_PROVIDERS = [
  { pattern: /\b(DESCO|Dhaka Electric Supply)\b/i, name: 'DESCO', type: 'electricity_bill' },
  { pattern: /\b(DPDC|Dhaka Power Distribution)\b/i, name: 'DPDC', type: 'electricity_bill' },
  { pattern: /\b(NESCO|Northern Electricity)\b/i, name: 'NESCO', type: 'electricity_bill' },
  { pattern: /\b(BREB|Palli Bidyut|REB|পল্লী বিদ্যুৎ)\b/i, name: 'Bangladesh Rural Electrification Board (BREB)', type: 'electricity_bill' },
  { pattern: /\b(BPDB|PDB)\b/i, name: 'Bangladesh Power Development Board (BPDB)', type: 'electricity_bill' },
  { pattern: /\b(Titas Gas|তিতাস গ্যাস)\b/i, name: 'Titas Gas', type: 'gas_bill' },
  { pattern: /\b(Bakhrabad|Karnaphuli Gas|Jalalabad Gas|Pashchimanchal)\b/i, name: 'Gas Distribution Utility', type: 'gas_bill' },
  { pattern: /\b(Dhaka WASA|DWASA|CWASA|WASA|ওয়াসা)\b/i, name: 'WASA', type: 'water_bill' },
  { pattern: /\b(Link3|Amber IT|Carnival|Dot Internet|ADN Telecom|Triangle|BDCOM|Mimosa)\b/i, name: 'ISP Provider', type: 'internet_bill' },
  { pattern: /\b(Grameenphone|GP|Skitto|গ্রামীণফোন)\b/i, name: 'Grameenphone', type: 'mobile_postpaid_bill' },
  { pattern: /\b(Robi|Airtel|রবি)\b/i, name: 'Robi Axiata', type: 'mobile_postpaid_bill' },
  { pattern: /\b(Banglalink|বাংলালিংক)\b/i, name: 'Banglalink', type: 'mobile_postpaid_bill' },
  { pattern: /\b(Teletalk|টেলিটক)\b/i, name: 'Teletalk', type: 'mobile_postpaid_bill' },
  { pattern: /\b(Akash DTH|Bengal Digital)\b/i, name: 'TV / DTH Provider', type: 'tv_cable_bill' }
];

export function detectBillTypeAndProvider(text) {
  const src = String(text || '');
  for (const p of BD_PROVIDERS) {
    const m = src.match(p.pattern);
    if (m) {
      return { documentType: p.type, provider: p.name === 'ISP Provider' ? m[0] : p.name };
    }
  }

  let documentType = 'unknown_bill';
  if (/electricity|kwh|meter|বিদ্যুৎ|बिजली|electricidad/i.test(src)) documentType = 'electricity_bill';
  else if (/gas|lpg|cylinder|গ্যাস|गैस/i.test(src)) documentType = 'gas_bill';
  else if (/water|sewer|পানি|पानी/i.test(src)) documentType = 'water_bill';
  else if (/internet|wi-?fi|broadband|mbps|isp|ব্রডব্যান্ড|ইন্টারনেট/i.test(src)) documentType = 'internet_bill';
  else if (/recharge|top-?up|data pack|রিচার্জ/i.test(src)) documentType = 'mobile_recharge';
  else if (/postpaid|mobile bill|roaming/i.test(src)) documentType = 'mobile_postpaid_bill';
  else if (/cable\s*tv|dth|dish/i.test(src)) documentType = 'tv_cable_bill';
  else if (/landline|telephone|btcl/i.test(src)) documentType = 'landline_bill';
  else if (/house\s*rent|rent\s*receipt|ভাড়া/i.test(src)) documentType = 'rent_bill';
  else if (/service\s*charge|maintenance|ips|generator|গারবেজ|দারোয়ান/i.test(src)) documentType = 'building_maintenance';
  else if (/garbage|municipal|city\s*corp|পৌরসভা/i.test(src)) documentType = 'garbage_municipal_bill';
  else if (/credit\s*card|statement\s*balance|minimum\s*due/i.test(src)) documentType = 'credit_card_bill';
  else if (/emi|loan|installment|কিস্তি/i.test(src)) documentType = 'loan_emi_bill';
  else if (/insurance|premium|policy|বীমা/i.test(src)) documentType = 'insurance_premium';
  else if (/tuition|school|college|university|semester|ভর্তি|টিউশন/i.test(src)) documentType = 'school_college_fee';
  else if (/govt|government|challan|vat\s*tax|tin|চালান|কর/i.test(src)) documentType = 'government_fee';
  else if (/rice|kg|qty|grocery|super\s*shop|চাল|বাজার/i.test(src)) documentType = 'grocery_receipt';

  // Extract first clean non-empty header line as provider fallback
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 55);
  const provider = lines.find((l) => !/^(bill|invoice|receipt|date|tax|total)/i.test(l)) || null;
  return { documentType, provider };
}

function findLabeledAmount(lines, patterns) {
  for (const line of lines) {
    for (const pat of patterns) {
      if (pat.test(line)) {
        const nums = line.match(/[0-9০-৯]{1,3}(?:,[0-9০-৯]{2,3})*(?:\.[0-9০-৯]{1,2})?/g);
        if (nums && nums.length) {
          const val = parseLocaleNumber(nums[nums.length - 1]);
          if (val !== null && val >= 0) return val;
        }
      }
    }
  }
  return null;
}

function findLabeledString(lines, patterns) {
  for (const line of lines) {
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m && m[1]) return m[1].trim();
    }
  }
  return null;
}

function extractLineItems(lines) {
  const items = [];
  const skipRegex = /^(sub\s*total|subtotal|grand\s*total|total|amount\s*due|net\s*payable|vat|tax|service\s*charge|late\s*fee|discount|previous\s*balance|amount\s*paid)/i;
  for (const line of lines) {
    if (skipRegex.test(line.trim())) continue;
    const m = line.match(/^(.{2,48}?)\s+(?:৳|BDT|\$|€|£|₹|AED|SAR)?\s*([0-9০-৯]{1,3}(?:,[0-9০-৯]{2,3})*(?:\.[0-9০-৯]{1,2})?)\s*$/);
    if (m) {
      const name = m[1].replace(/[:\-–]+$/, '').trim();
      const amount = parseLocaleNumber(m[2]);
      if (name && amount !== null && amount > 0) {
        items.push({ name, quantity: 1, unitPrice: amount, amount, unit: null });
      }
    }
  }
  return items.slice(0, 40);
}

export function parseBillLocally(ocrText, preferredCurrency = 'BDT', ocrLanguage = 'und') {
  const text = String(ocrText || '').trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const { documentType, provider } = detectBillTypeAndProvider(text);
  const currency = detectCurrencyFromText(text, preferredCurrency);

  const total = findLabeledAmount(lines, [/grand\s*total/i, /net\s*payable/i, /total\s*payable/i, /^total\b/i, /সর্বমোট/i, /মোট/i]);
  const amountDue = findLabeledAmount(lines, [/amount\s*due/i, /payable\s*amount/i, /minimum\s*due/i, /বকেয়া/i]);
  const subtotal = findLabeledAmount(lines, [/sub\s*total/i, /subtotal/i, /energy\s*charge/i]);
  const tax = findLabeledAmount(lines, [/\bvat\b/i, /\btax\b/i, /\bgst\b/i, /ভ্যাট/i]);
  const fees = findLabeledAmount(lines, [/service\s*charge/i, /late\s*fee/i, /surcharge/i, /সার্ভিস/i]);
  const discounts = findLabeledAmount(lines, [/discount/i, /rebate/i, /ছাড়/i]);
  const previousBalance = findLabeledAmount(lines, [/previous\s*balance/i, /arrears/i]);
  const amountPaid = findLabeledAmount(lines, [/amount\s*paid/i, /paid\s*amount/i]);

  const issueDate = findLabeledString(lines, [/(?:issue\s*date|bill\s*date|date)\s*[:\-]\s*(.+)$/i]);
  const dueDate = findLabeledString(lines, [/(?:due\s*date|last\s*date|pay\s*by)\s*[:\-]\s*(.+)$/i]);
  const accountRaw = findLabeledString(lines, [/(?:account\s*(?:no|number)|a\/c|card\s*no|meter\s*no)\s*[:\-#]?\s*([A-Z0-9\-\*\s]{4,24})/i]);
  const invoiceNumber = findLabeledString(lines, [/(?:invoice|bill|receipt)\s*(?:no|number|#)\s*[:\-#]?\s*([A-Z0-9\-]{3,24})/i]);

  const items = extractLineItems(lines);
  const computedTotal = total ?? amountDue ?? (items.length ? items.reduce((s, it) => s + it.amount, 0) + (tax || 0) + (fees || 0) - (discounts || 0) : null);

  const isSensitiveType = documentType === 'credit_card_bill' || documentType === 'loan_emi_bill';
  const accountNumber = accountRaw ? (isSensitiveType ? maskSensitiveNumber(accountRaw) : accountRaw) : null;

  let confidence = 0.45;
  if (computedTotal !== null) confidence += 0.25;
  if (provider) confidence += 0.12;
  if (documentType !== 'unknown_bill') confidence += 0.1;
  if (dueDate || issueDate) confidence += 0.08;
  confidence = Math.min(0.96, Number(confidence.toFixed(2)));

  return {
    id: uid('bill'),
    documentType,
    provider: provider || 'Not detected',
    customerName: null,
    accountNumber,
    invoiceNumber,
    billingPeriod: { start: null, end: null },
    issueDate,
    dueDate,
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
    items,
    subtotal,
    tax,
    fees,
    discounts,
    previousBalance,
    currentCharges: computedTotal,
    total: computedTotal,
    amountPaid,
    amountDue: amountDue ?? computedTotal,
    category: TYPE_TO_CATEGORY[documentType] || 'other',
    recurring: false,
    recurringConfidence: 0,
    previousBillId: null,
    priceHistory: [],
    suspiciousChange: null,
    ocrLanguage,
    ocrConfidence: 0.85,
    analysisConfidence: confidence,
    confidence,
    warnings: computedTotal === null ? ['Total amount could not be confidently detected.'] : [],
    userCorrectedFields: [],
    rawOcrText: text
  };
}

export function validateAiBillSchema(aiData, fallback) {
  if (!aiData || typeof aiData !== 'object') return fallback;
  const docType = BILL_TYPES.includes(aiData.documentType) ? aiData.documentType : fallback.documentType;
  const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const items = Array.isArray(aiData.items)
    ? aiData.items
        .filter((it) => it && typeof it.name === 'string')
        .map((it) => ({
          name: it.name.trim(),
          quantity: numOrNull(it.quantity) ?? 1,
          unitPrice: numOrNull(it.unitPrice) ?? numOrNull(it.amount) ?? 0,
          amount: numOrNull(it.amount) ?? 0,
          unit: typeof it.unit === 'string' ? it.unit : null
        }))
    : fallback.items;

  return {
    ...fallback,
    documentType: docType,
    provider: typeof aiData.provider === 'string' && aiData.provider.trim() ? aiData.provider.trim() : fallback.provider,
    currencyCode: typeof aiData.currency === 'string' && aiData.currency.length === 3 ? aiData.currency.toUpperCase() : fallback.currencyCode,
    billingPeriod: aiData.billingPeriod && typeof aiData.billingPeriod === 'object' ? aiData.billingPeriod : fallback.billingPeriod,
    issueDate: aiData.issueDate || fallback.issueDate,
    dueDate: aiData.dueDate || fallback.dueDate,
    items,
    subtotal: numOrNull(aiData.subtotal) ?? fallback.subtotal,
    tax: numOrNull(aiData.tax) ?? fallback.tax,
    fees: numOrNull(aiData.fees) ?? fallback.fees,
    discounts: numOrNull(aiData.discount) ?? fallback.discounts,
    total: numOrNull(aiData.total) ?? fallback.total,
    amountDue: numOrNull(aiData.amountDue) ?? numOrNull(aiData.total) ?? fallback.amountDue,
    category: TYPE_TO_CATEGORY[docType] || fallback.category,
    confidence: typeof aiData.confidence === 'number' ? Math.min(1, Math.max(0, aiData.confidence)) : fallback.confidence,
    analysisConfidence: typeof aiData.confidence === 'number' ? Math.min(1, Math.max(0, aiData.confidence)) : fallback.analysisConfidence,
    warnings: Array.isArray(aiData.warnings) ? aiData.warnings.filter((w) => typeof w === 'string') : fallback.warnings
  };
}

export async function analyzeBillText(ocrText, { preferredCurrency = 'BDT', ocrLanguage = 'und', geminiApiKey = '' } = {}) {
  const localParsed = parseBillLocally(ocrText, preferredCurrency, ocrLanguage);
  const remoteAi = await callSecureAiAnalyzer(ocrText, ocrLanguage, preferredCurrency, geminiApiKey);
  if (remoteAi) {
    return validateAiBillSchema(remoteAi, localParsed);
  }
  return localParsed;
}

export function formatBillTypeLabel(docType) {
  return String(docType || 'unknown_bill')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

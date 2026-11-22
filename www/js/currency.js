export const CURRENCIES = [
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' },
  { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar' },
  { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'ARS', symbol: 'ARS$', name: 'Argentine Peso' },
  { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat' },
  { code: 'KHR', symbol: '៛', name: 'Cambodian Riel' }
];

export function getCurrencyByCode(code) {
  const upper = String(code || 'BDT').toUpperCase();
  return CURRENCIES.find((c) => c.code === upper) || CURRENCIES[0];
}

export function detectCurrencyFromText(text, fallbackCode = 'BDT') {
  const src = String(text || '');
  // Strict BDT / Taka detection (never confuse ৳ with $, €, £, ₹)
  if (/৳|BDT|Taka|টাকা/i.test(src)) return getCurrencyByCode('BDT');
  if (/₹|INR|Rs\.?\s?\d/i.test(src)) return getCurrencyByCode('INR');
  if (/€|EUR/i.test(src)) return getCurrencyByCode('EUR');
  if (/£|GBP/i.test(src)) return getCurrencyByCode('GBP');
  if (/AED|د\.إ/i.test(src)) return getCurrencyByCode('AED');
  if (/SAR|﷼/i.test(src)) return getCurrencyByCode('SAR');
  if (/QAR|ر\.ق/i.test(src)) return getCurrencyByCode('QAR');
  if (/KWD|د\.ك/i.test(src)) return getCurrencyByCode('KWD');
  if (/RM\s?\d|MYR/i.test(src)) return getCurrencyByCode('MYR');
  if (/SGD|S\$\s?\d/i.test(src)) return getCurrencyByCode('SGD');
  if (/USD|\$\s?\d/i.test(src)) return getCurrencyByCode('USD');
  if (/JPY|¥\s?\d/i.test(src)) return getCurrencyByCode('JPY');
  if (/CNY|RMB|元/i.test(src)) return getCurrencyByCode('CNY');
  if (/PKR|₨/i.test(src)) return getCurrencyByCode('PKR');
  if (/THB|฿/i.test(src)) return getCurrencyByCode('THB');
  if (/IDR|Rp\s?\d/i.test(src)) return getCurrencyByCode('IDR');
  return getCurrencyByCode(fallbackCode);
}

export function formatMoney(amount, currencyCode = 'BDT', currencySymbol = null) {
  if (amount == null || Number.isNaN(Number(amount))) return 'Not detected';
  const cur = getCurrencyByCode(currencyCode);
  const sym = currencySymbol || cur.symbol;
  const num = Number(amount);
  const hasDecimals = Math.abs(num % 1) > 0.001;
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
  return `${sym}${formatted}`;
}

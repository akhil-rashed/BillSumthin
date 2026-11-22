const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const ALLOWED_DOC_TYPES = [
  'electricity_bill', 'gas_bill', 'water_bill', 'internet_bill',
  'mobile_postpaid_bill', 'mobile_recharge', 'tv_cable_bill', 'landline_bill',
  'rent_bill', 'building_maintenance', 'garbage_municipal_bill',
  'credit_card_bill', 'loan_emi_bill', 'insurance_premium',
  'school_college_fee', 'grocery_receipt', 'government_fee', 'unknown_bill'
];

exports.analyzeBill = onRequest({ secrets: [geminiApiKey], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { ocrText, ocrLanguage = 'und', preferredCurrency = 'BDT' } = req.body || {};
  if (!ocrText || typeof ocrText !== 'string' || ocrText.trim().length < 5) {
    res.status(400).json({ error: 'Valid OCR text is required' });
    return;
  }

  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    res.status(503).json({ error: 'AI service not configured' });
    return;
  }

  const prompt = [
    'Extract structured bill data from the OCR text below.',
    'Rules:',
    '- NEVER invent or guess missing totals, dates, providers, or account numbers.',
    '- Use null for any field not clearly present in the text.',
    '- Distinguish subtotal, tax/VAT, fees, discount, amountDue, and total carefully.',
    '- Treat ৳ and BDT as currency "BDT". Never confuse ৳ with $, €, £, or ₹.',
    `- Fallback currency if none visible: ${preferredCurrency}.`,
    `- OCR language hint: ${ocrLanguage}.`,
    `- documentType must be one of: ${ALLOWED_DOC_TYPES.join(', ')}.`,
    'Return ONLY valid JSON matching this schema:',
    '{"documentType":"...","provider":"...","currency":"BDT","billingPeriod":{"start":null,"end":null},"issueDate":null,"dueDate":null,"items":[{"name":"...","quantity":1,"unitPrice":0,"amount":0}],"subtotal":null,"tax":null,"fees":null,"discount":null,"total":null,"amountDue":null,"confidence":0.85,"warnings":[]}',
    '',
    'OCR TEXT:',
    ocrText.slice(0, 12000)
  ].join('\n');

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!aiRes.ok) {
      res.status(502).json({ error: 'Upstream AI request failed' });
      return;
    }

    const payload = await aiRes.json();
    const rawJson = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      res.status(502).json({ error: 'Empty AI response' });
      return;
    }

    const parsed = JSON.parse(rawJson);
    if (!ALLOWED_DOC_TYPES.includes(parsed.documentType)) {
      parsed.documentType = 'unknown_bill';
    }
    res.status(200).json(parsed);
  } catch {
    res.status(500).json({ error: 'Bill analysis failed' });
  }
});

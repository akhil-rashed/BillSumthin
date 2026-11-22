import { aggregateCategories } from './categories.js';

export function computeSpendingMetrics(bills) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const thisMonthBills = [];
  const prevMonthBills = [];

  for (const b of bills) {
    const d = new Date(b.issueDate || b.createdAt);
    if (d >= thisMonthStart) thisMonthBills.push(b);
    else if (d >= prevMonthStart && d <= prevMonthEnd) prevMonthBills.push(b);
  }

  const sumTotals = (list) => list.reduce((s, b) => s + (typeof b.total === 'number' ? b.total : 0), 0);
  const thisMonthTotal = sumTotals(thisMonthBills);
  const prevMonthTotal = sumTotals(prevMonthBills);
  const changePct = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null;

  const categoryBreakdown = aggregateCategories(thisMonthBills.length ? thisMonthBills : bills)
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const recurringBills = bills.filter((b) => b.recurring);
  const largestBills = [...bills]
    .filter((b) => typeof b.total === 'number')
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Build 6-month trend
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = new Date(dt.getFullYear(), dt.getMonth(), 1);
    const mEnd = new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59);
    const total = sumTotals(
      bills.filter((b) => {
        const bd = new Date(b.issueDate || b.createdAt);
        return bd >= mStart && bd <= mEnd;
      })
    );
    months.push({
      label: dt.toLocaleDateString(undefined, { month: 'short' }),
      total
    });
  }

  return {
    thisMonthTotal,
    prevMonthTotal,
    changePct,
    categoryBreakdown,
    recurringBills,
    largestBills,
    months
  };
}

export function drawCleanBarChart(canvas, labels, values, primaryColor = '#2563EB') {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(260, rect.width || 320);
  const h = Math.max(140, rect.height || 170);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#9CA3AF' : '#6B7280';
  const gridColor = isDark ? '#232832' : '#E5E7EB';

  const padTop = 14;
  const padBottom = 26;
  const padSide = 10;
  const chartH = h - padTop - padBottom;
  const maxVal = Math.max(1, ...values);

  // Subtle baseline
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padSide, padTop + chartH);
  ctx.lineTo(w - padSide, padTop + chartH);
  ctx.stroke();

  const count = labels.length || 1;
  const slotW = (w - padSide * 2) / count;
  const barW = Math.min(28, slotW * 0.52);

  values.forEach((val, idx) => {
    const barH = Math.max(val > 0 ? 4 : 0, (val / maxVal) * (chartH - 6));
    const x = padSide + idx * slotW + (slotW - barW) / 2;
    const y = padTop + chartH - barH;

    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    const r = Math.min(6, barW / 2, barH / 2);
    ctx.roundRect(x, y, barW, barH, [r, r, 0, 0]);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[idx], x + barW / 2, h - 8);
  });
}

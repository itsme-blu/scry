'use strict';
/* Scry — personal money, budget and bills tracker.
   Modes: "demo" (sample data kept in this browser only) and "supa" (Supabase, signed in). */

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const nf2 = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SYM = { PHP: '₱', USD: 'US$', SGD: 'S$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
const money = (n, cur = 'PHP') => window.__hideAmt ? (SYM[cur] || cur + ' ') + '••••' : (n < 0 ? '−' : '') + (SYM[cur] || cur + ' ') + nf2.format(Math.abs(n || 0));
const signed = (n, cur) => (n > 0 ? '+' : '') + money(n, cur);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseD = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n) => {
  const d = parseD(s), day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return iso(t);
};
const thisMonth = () => today().slice(0, 7);
const shiftMonth = (mk, n) => addMonths(mk + '-01', n).slice(0, 7);
const monthName = mk => parseD(mk + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
const shortDate = s => parseD(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const longDay = s => parseD(s).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' });
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const timeOf = ts => new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now());
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
}

// ---------- reference data ----------
const ACCOUNT_TYPES = {
  bank: ['Bank', '🏦'], ewallet: ['E-wallet', '📱'], cash: ['Cash', '💵'], credit: ['Credit card', '💳'],
  loan: ['Loan', '📉'], savings: ['Savings', '🐷'], investment: ['Investment', '📈'],
};
const ACCOUNT_GROUPS = [
  ['Banks & cash', ['bank', 'cash']], ['E-wallets', ['ewallet']],
  ['Savings & investments', ['savings', 'investment']], ['Credit cards & loans', ['credit', 'loan']],
];
const BANKS = {
  wise: { name: 'Wise', re: /wise|transferwise/i, color: '#9FE870' },
  gcash: { name: 'GCash', re: /gcash/i, color: '#5B9BFF' },
  maribank: { name: 'MariBank', re: /mari\s?bank|maribank/i, color: '#F28A5B' },
  gotyme: { name: 'GoTyme', re: /go\s?tyme/i, color: '#3FD0D6' },
};
// Official icons, downloaded once from each bank's own website (Nov 20 2026) into brand/banks/.
const BANK_LOGO = { gcash: 'brand/banks/gcash.png', gotyme: 'brand/banks/gotyme.png', maribank: 'brand/banks/maribank.png', wise: 'brand/banks/wise.png' };
const CASH_LOGO = 'brand/banks/cash.svg';
function accIcon(a, size = 38) {
  const src = (a?.bank && BANK_LOGO[a.bank]) || (a?.type === 'cash' ? CASH_LOGO : null);
  return src ? `<img class="logo" src="${src}" alt="" width="${size}" height="${size}">` : (ACCOUNT_TYPES[a?.type]?.[1] || '•');
}
const DEFAULT_CATS = [
  ['expense', 'Food & groceries', '🛒'], ['expense', 'Dining out', '🍜'], ['expense', 'Transport', '🚕'],
  ['expense', 'Utilities', '💡'], ['expense', 'Phone & internet', '📶'], ['expense', 'Rent & home', '🏠'],
  ['expense', 'Health', '💊'], ['expense', 'Family support', '👨‍👩‍👧'], ['expense', 'Shopping', '🛍️'],
  ['expense', 'Subscriptions', '🔁'], ['expense', 'Fun & going out', '🎉'], ['expense', 'Personal care', '💈'],
  ['expense', 'Education', '📚'], ['expense', 'Gifts & giving', '🎁'], ['expense', 'Fees & charges', '🧾'],
  ['expense', 'Daybreak business', '🌅'], ['expense', 'Other', '•'],
  ['income', 'Salary', '💼'], ['income', 'Freelance & VA work', '💻'], ['income', 'Business income', '🌅'],
  ['income', 'Interest', '🪙'], ['income', 'Other income', '➕'],
];
// Daybreak's monthly tools, from Business/Daybreak Assist/departments/finance/money-status.md (Nov 18 2026).
const DAYBREAK_BILLS = [
  ['Claude Max', 6200, '2026-12-08', 'monthly', 'US$100 a month. Peso amount is an estimate at ₱62 per US$ (Daybreak money status, Nov 18 2026).'],
  ['ElevenLabs Starter', 372, '2026-12-16', 'monthly', 'US$6 a month. Peso amount is an estimate (Daybreak money status, Nov 18 2026).'],
  ['Kling AI Standard', 482.02, '2026-12-19', 'monthly', '₱482.02 per 31 days; about ₱652.58 from about Feb 20 2027 (Daybreak money status).'],
  ['Domain daybreakassist.com', 776, '2027-11-16', 'yearly', 'US$12.51 a year. Peso amount is an estimate at ₱62 per US$.'],
];
const RULES = [
  [/grab(?!\s?food)|angkas|joyride|move ?it|jeep|lrt|mrt|taxi|petron|shell|caltex|seaoil|toll|autosweep|easytrip|beep/i, 'Transport'],
  [/meralco|maynilad|manila water|prime water/i, 'Utilities'],
  [/pldt|globe|smart|converge|sky ?cable|dito|\bload\b|tnt/i, 'Phone & internet'],
  [/jollibee|mcdo|mcdonald|starbucks|kfc|chowking|mang inasal|greenwich|foodpanda|grab ?food|restaurant|cafe|coffee|pizza|bakery|samgyup/i, 'Dining out'],
  [/puregold|savemore|sm (super|hyper)market|robinsons|7-?eleven|ministop|alfamart|market|grocery|landers|s&r|walter ?mart/i, 'Food & groceries'],
  [/mercury|watsons|southstar|pharmacy|drug|hospital|clinic|maxicare|philhealth|dental/i, 'Health'],
  [/netflix|spotify|youtube|apple\.com|icloud|google|claude|anthropic|openai|chatgpt|elevenlabs|kling|canva|disney|viu/i, 'Subscriptions'],
  [/lazada|shopee|zalora|tiktok shop|uniqlo/i, 'Shopping'],
  [/salary|payroll/i, 'Salary'],
  [/interest/i, 'Interest'],
  [/\bfee\b|charge|penalt/i, 'Fees & charges'],
];

// ---------- notification safety (mirrors looks_like_code / has_money_amount / money_redact in schema.sql) ----------
// A pattern check reduces risk; it cannot promise every login-code message is caught.
// (No "authori…": MariBank ends every alert with "If unauthorized, please chat with us", Nov 21 2026.)
const CODE_WORDS = /otp|one[- ]?time|verification|verify (?:your (?:identity|account|login|device|number|email)|it.?s you)|authenticat|passcode|pass code|password|\bpin\b|mpin|security code|log[- ]?in|sign[- ]?in|access code|confirmation code|activation|new device|do not share|don't share|never share|huwag (mo )?(ibigay|ibahagi|i-share)|wag (mo )?(ibigay|ibahagi)/i;
function looksLikeCode(t) {
  t = String(t || '');
  return CODE_WORDS.test(t) || /code[^0-9]{0,25}[0-9]{4,8}(?![0-9])/i.test(t) || /(^|[^0-9])[0-9]{4,8}[^0-9]{0,25}(is your|as your)/i.test(t);
}
const hasMoney = t => /(PHP|Php|php|₱|USD|SGD|EUR|GBP|AUD|CAD|\$|\bP)\s?[0-9]/.test(t || '') || /[0-9](\.[0-9]{1,2})?\s?(PHP|USD|SGD|EUR|GBP|AUD|CAD)\b/.test(t || '');
function redact(t) {
  let s = String(t || '');
  s = s.replace(/(PHP|Php|php|₱|USD|SGD|EUR|GBP|AUD|CAD|\$|\bP)(\s?)([0-9][0-9,]*(\.[0-9]{1,2})?)/g, '$1$2⟦$3⟧');
  s = s.replace(/([0-9][0-9,]*(\.[0-9]{1,2})?)(\s?)(PHP|USD|SGD|EUR|GBP|AUD|CAD)/g, '⟦$1⟧$3$4');
  s = s.replace(/(^|[^0-9⟦])[0-9]{3}[ -][0-9]{3}(?![0-9⟧])/g, '$1•••');
  s = s.replace(/(^|[^0-9.,⟦])[0-9]{4,8}(?![0-9.,⟧])/g, '$1•••');
  return s.replace(/[⟦⟧]/g, '');
}
// What the database would do with one notification: drop it, or keep a redacted copy.
function screenNotification(item) {
  const raw = `${item.title || ''} ${item.body || ''}`;
  if (!/(gcash|wise|transferwise|mari ?bank|maribank|gotyme|go ?tyme|messag|\bmms\b|gmail|android\.gm\b)/i.test(`${item.app || ''} ${item.package || ''}`)) return { keep: false, why: 'not one of your bank apps, Messages or Gmail' };
  if (looksLikeCode(raw)) return { keep: false, why: 'looks like a login or verification code' };
  if (!hasMoney(raw) && !(/messag|\bmms\b|gmail|android\.gm\b/i.test(`${item.app || ''} ${item.package || ''}`) && /bill|due|payment|statement|soa|billing|amount/i.test(raw))) return { keep: false, why: 'no money amount in it' };
  return { keep: true, title: redact(String(item.title || '').slice(0, 300)), body: redact(String(item.body || '').slice(0, 1000)) };
}

// ---------- state ----------
const TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'bills', 'inbox'];
const S = {
  mode: null, sb: null, user: null,
  d: { accounts: [], categories: [], transactions: [], budgets: [], bills: [], inbox: [] },
  view: 'home', month: thisMonth(), tag: 'all',
  f: { q: '', account: '', category: '' },
  billView: 'list', calMonth: thisMonth(), keyStatus: null,
  settings: Object.assign({ rates: { USD: 62 }, hideBanner: false }, LS.get('money-settings', {})),
};
const saveSettings = () => LS.set('money-settings', S.settings);
const isDemo = () => S.mode === 'demo';

// ---------- data layer ----------
async function fetchAll(t) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await S.sb.from(t).select('*').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const DB = {
  saveDemo() { LS.set('money-demo-db', S.d); },
  async load() {
    if (isDemo()) { const d = LS.get('money-demo-db', null); if (d) Object.assign(S.d, d); demoPurge(); return; }
    try { await S.sb.rpc('purge_inbox'); } catch { /* purge is best effort */ }
    for (const t of TABLES) S.d[t] = await fetchAll(t);
  },
  async insert(t, rows) {
    rows = [].concat(rows);
    if (isDemo()) {
      let out = rows.map(r => ({ id: uid(), created_at: new Date().toISOString(), ...r }));
      if (t === 'inbox') out = out.map(demoSanitize).filter(Boolean);   // same rules as the database trigger
      S.d[t].push(...out); this.saveDemo(); return out;
    }
    const { data, error } = await S.sb.from(t).insert(rows).select();
    if (error) throw error;
    S.d[t].push(...data); return data;      // inbox rows the trigger drops come back as nothing
  },
  async update(t, id, patch) {
    const i = S.d[t].findIndex(r => r.id === id);
    if (isDemo()) {
      const row = S.d[t][i];
      if (t === 'inbox' && row.status === 'new' && patch.status && patch.status !== 'new') Object.assign(row, { title: null, body: null, reviewed_at: new Date().toISOString() });
      Object.assign(row, patch); this.saveDemo(); return row;
    }
    const { data, error } = await S.sb.from(t).update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (i >= 0) S.d[t][i] = data; return data;
  },
  async remove(t, id) {
    if (!isDemo()) { const { error } = await S.sb.from(t).delete().eq('id', id); if (error) throw error; }
    S.d[t] = S.d[t].filter(r => r.id !== id);
    if (isDemo()) this.saveDemo();
  },
};
function demoSanitize(row) {
  const s = screenNotification(row); if (!s.keep) return null;
  const day = iso(new Date(row.received_at || Date.now()));
  const fp = `${(row.package || row.app || '').toLowerCase()}|${s.title}|${s.body}|${day}`;
  if (S.d.inbox.some(r => r.fingerprint === fp)) return null;
  return { status: 'new', received_at: new Date().toISOString(), ...row, title: s.title, body: s.body, fingerprint: fp };
}
function demoPurge() {
  const now = Date.now(), days = n => n * 86400000;
  S.d.inbox = S.d.inbox.filter(r => r.status === 'new' ? now - new Date(r.received_at) < days(30) : now - new Date(r.reviewed_at || r.received_at) < days(7));
}
async function safe(fn) {
  try { return await fn(); } catch (e) { console.error(e); toast('Could not save: ' + (e.message || e)); throw e; }
}

// ---------- lookups and maths ----------
const acc = id => S.d.accounts.find(a => a.id === id);
const cat = id => S.d.categories.find(c => c.id === id);
const curOf = id => acc(id)?.currency || 'PHP';
const rate = cur => (!cur || cur === 'PHP') ? 1 : (S.settings.rates[cur] ?? null);
const toPHP = (amt, accountId) => { const r = rate(curOf(accountId)); return r == null ? 0 : amt * r; };
const tagOK = t => S.tag === 'all' || t.tag === S.tag;
const activeAccounts = () => S.d.accounts.filter(a => !a.archived).sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name));
const catsOf = kind => S.d.categories.filter(c => c.kind === kind && !c.archived).sort((a, b) => (a.sort || 0) - (b.sort || 0));

function balances() {
  const b = {};
  for (const a of S.d.accounts) b[a.id] = num(a.opening_balance);
  for (const t of S.d.transactions) {
    const x = num(t.amount);
    if (!(t.account_id in b)) continue;
    if (t.kind === 'expense') b[t.account_id] -= x;
    else if (t.kind === 'income') b[t.account_id] += x;
    else if (t.kind === 'transfer') {
      b[t.account_id] -= x;
      if (t.to_account_id in b) b[t.to_account_id] += t.to_amount != null ? num(t.to_amount) : x;
    }
  }
  return b;
}
// IOUs: debts and money people owe him are 'loan' accounts. They are not wallets.
// A debt to a biller (Meralco arrears…) is an unpaid bill, shown apart from IOUs with people.
const BILLER_RE = /meralco|pldt|globe|smart|converge|maynilad|manila water|sky ?(cable|fiber)?|dito|electric|water|internet|rent|insurance/i;
const isBillDebt = a => a?.type === 'loan' && (BILLER_RE.test(a.name) || S.d.bills.some(b => b.active && norm(b.name) === norm(a.name)));
const isIOU = a => a?.type === 'loan';
function worth() {
  const b = balances(); let own = 0, owe = 0, owed = 0; const missing = new Set();
  for (const a of activeAccounts()) {
    const r = rate(a.currency); if (r == null) { if (Math.abs(b[a.id]) > 0.004) missing.add(a.currency); continue; }   // only flag a missing rate when that money matters
    const v = b[a.id] * r;
    if (isIOU(a)) { if (v >= 0) owed += v; else owe += v; }
    else if (v >= 0) own += v; else owe += v;
  }
  return { own, owe, owed, net: own + owed + owe, missing: [...missing] };
}
// How many cards per row on a wide screen: as many as fit at a readable size, choosing the count that leaves the fewest gaps.
function cardCols(n) {
  const w = Math.min(window.innerWidth, 1520) - (window.innerWidth > 760 ? 320 : 40), max = Math.max(1, Math.min(n, Math.floor(w / 230)));
  let best = max, gaps = 99;
  for (let c = max; c >= Math.max(2, max - 1); c--) { const g = (c - n % c) % c; if (g < gaps) { gaps = g; best = c; } }   // never collapse to one huge card
  return best;
}
function iouList(b) {
  const ious = activeAccounts().filter(a => isIOU(a) && !isBillDebt(a) && Math.abs(b[a.id]) > 0.004);
  const row = a => { const v = b[a.id], nm = a.name.replace(/\s*\((?:i owe|owes me|owe[sd]? me|i owe him|i owe her)\)\s*$/i, '');
    return `<button class="iou" data-a="cardMenu" data-id="${a.id}"><span class="av ${v < 0 ? 'out' : 'in'}">${esc((nm[0] || '?').toUpperCase())}</span><span class="main"><b>${esc(nm)}</b><small>${v < 0 ? 'You owe' : 'Owes you'}</small></span><span class="amt ${v < 0 ? 'neg' : 'pos'}">${money(Math.abs(v), a.currency)}</span>${IC('chevron-right', 'sm')}</button>`; };
  const them = ious.filter(a => b[a.id] > 0), me = ious.filter(a => b[a.id] < 0);
  return { count: ious.length, html: `${them.length ? `<div class="iou-h">Owed to you</div>${them.map(row).join('')}` : ''}${me.length ? `<div class="iou-h">You owe</div>${me.map(row).join('')}` : ''}` };
}
function unpaidBills(b) {
  const list = activeAccounts().filter(a => isBillDebt(a) && Math.abs(b[a.id]) > 0.004);
  const total = list.reduce((t, a) => t + Math.max(0, -b[a.id]) * (rate(a.currency) ?? 0), 0);
  const html = list.map(a => `<button class="iou" data-a="cardMenu" data-id="${a.id}"><span class="av out">${IC('receipt', 'sm')}</span><span class="main"><b>${esc(a.name)}</b><small>Unpaid balance</small></span><span class="amt neg">${money(Math.abs(b[a.id]), a.currency)}</span>${IC('chevron-right', 'sm')}</button>`).join('');
  return { count: list.length, total, card: list.length ? `<section class="card iou-card"><div class="sh"><b class="cap">Unpaid bills</b><span class="grow"></span><span class="xs faint">${money(total)} to clear</span></div>${html}</section>` : '' };
}
const ADJ = 'Balance adjustment';
const isAdj = t => t.note === ADJ && !t.category_id;
const txInMonth = mk => S.d.transactions.filter(t => t.date.startsWith(mk) && !isAdj(t));   // stats only; Activity still lists adjustments
// last time each account was matched to the real bank balance (kept in the Scry profile, not the public code)
const matchedMap = () => (isDemo() ? S.settings.matched : S.user?.user_metadata?.matched) || {};
function matchedLabel(id) {
  const d = matchedMap()[id]; if (!d) return '<span class="warn">Never matched</span>';
  const n = daysBetween(d, today());
  return n <= 0 ? 'Matched today' : n === 1 ? 'Matched yesterday' : n > 10 ? `<span class="warn">Matched ${n} days ago</span>` : `Matched ${n} days ago`;
}
function monthTotals(mk) {
  let inc = 0, out = 0;
  for (const t of txInMonth(mk)) {
    if (!tagOK(t)) continue;
    if (t.kind === 'income') inc += toPHP(num(t.amount), t.account_id);
    if (t.kind === 'expense') out += toPHP(num(t.amount), t.account_id);
  }
  return { inc, out, left: inc - out };
}
function spentByCat(mk, useTag = true) {
  const m = {};
  for (const t of txInMonth(mk)) {
    if (t.kind !== 'expense' || (useTag && !tagOK(t))) continue;
    const k = t.category_id || '_none'; m[k] = (m[k] || 0) + toPHP(num(t.amount), t.account_id);
  }
  return m;
}
const budgetFor = (mk, cid) => S.d.budgets.find(b => b.month.startsWith(mk) && b.category_id === cid);
function topCats(kind, n) {
  const use = {};
  for (const t of S.d.transactions) if (t.kind === kind && t.category_id) use[t.category_id] = (use[t.category_id] || 0) + 1;
  return catsOf(kind).sort((a, b) => (use[b.id] || 0) - (use[a.id] || 0) || (a.sort || 0) - (b.sort || 0)).slice(0, n);
}

// bills
const nextDate = (s, rep) => rep === 'weekly' ? addDays(s, 7) : rep === 'monthly' ? addMonths(s, 1) : rep === 'quarterly' ? addMonths(s, 3) : rep === 'yearly' ? addMonths(s, 12) : null;
function occurrences(bill, from, to) {
  const out = []; let d = bill.due_date, guard = 0;
  while (d && d <= to && guard++ < 500) { if (d >= from) out.push(d); if (bill.repeat === 'none') break; d = nextDate(d, bill.repeat); }
  return out;
}
const activeBills = () => S.d.bills.filter(b => b.active && (S.tag === 'all' || b.tag === S.tag));
function upcoming(days) {
  const t = today(), end = addDays(t, days), out = [];
  for (const b of activeBills()) {
    if (b.due_date < t) out.push({ bill: b, date: b.due_date, late: true });
    else for (const d of occurrences(b, t, end)) out.push({ bill: b, date: d, late: false });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// Paydays (GOOD Hoops every 2 weeks, Intelocate, …). Stored in Blu's Scry login profile like his own names.
const INCOME_REPEAT = { biweekly: 'Every 2 weeks', semimonthly: 'Twice a month (15th & end)', monthly: 'Monthly', weekly: 'Weekly', none: 'One-off' };
const incomes = () => ((isDemo() ? S.settings.incomes : S.user?.user_metadata?.incomes) || []).filter(x => x && x.name);
async function saveIncomes(list) {
  if (isDemo()) { S.settings.incomes = list; saveSettings(); return; }
  const { data, error } = await S.sb.auth.updateUser({ data: { incomes: list } }); if (error) throw error; S.user = data.user;
}
function nextPayday(d, every) {
  if (every === 'weekly') return addDays(d, 7);
  if (every === 'biweekly') return addDays(d, 14);
  if (every === 'monthly') return addMonths(d, 1);
  if (every === 'semimonthly') {                 // the 15th, then the last day of the month, then the 15th…
    const x = parseD(d), last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    return x.getDate() < 15 ? iso(new Date(x.getFullYear(), x.getMonth(), 15)) : x.getDate() < last ? iso(new Date(x.getFullYear(), x.getMonth(), last)) : iso(new Date(x.getFullYear(), x.getMonth() + 1, 15));
  }
  return null;
}
function upcomingIncome(days) {
  const t = today(), end = addDays(t, days), out = [];
  for (const inc of incomes()) {
    if (S.tag !== 'all' && (inc.tag || 'personal') !== S.tag) continue;
    let d = inc.next, n = 0;
    if (d < t) out.push({ inc, date: d, late: true, first: true });
    else while (d && d <= end && n++ < 10) { out.push({ inc, date: d, first: n === 1 }); d = nextPayday(d, inc.every); }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// Pay can be in another currency than the account it lands in (Intelocate pays US$ by the hour into Wise).
const incCur = i => i.pay_cur || curOf(i.account_id);
const incAmt = i => num(i.hourly) && num(i.hours) ? num(i.hourly) * num(i.hours) : num(i.amount);
// Pay whose hours change (GOOD Hoops): estimate from the last 3 paydays he logged, in the account's currency.
function incAvg(i) {
  const n = norm(i.name), past = S.d.transactions.filter(t => t.kind === 'income' && t.account_id === i.account_id && (norm(t.note) === n || payerName(t.note) === i.name)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return past.length ? { v: past.reduce((s, t) => s + num(t.amount), 0) / past.length, n: past.length } : null;
}
const incInAcc = i => { const v = incAmt(i), pc = incCur(i), ac = curOf(i.account_id); if (pc === ac) return v; const r1 = rate(pc), r2 = rate(ac); return r1 && r2 ? Math.round(v * r1 / r2 * 100) / 100 : null; };
const incomePerMonth = () => incomes().reduce((s, i) => { const f = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 }[i.every] || 0;
  if (incAmt(i)) return s + incAmt(i) * f * (rate(incCur(i)) ?? 0);
  const av = incAvg(i); return s + (av ? av.v * f * (rate(curOf(i.account_id)) ?? 0) : 0); }, 0);
function incomeRow(o, withLog = true) {
  const i = o.inc, a = acc(i.account_id), dd = daysBetween(today(), o.date);
  const when = o.late ? `<span class="badge warn">${-dd === 1 ? '1 day ago' : -dd + ' days ago'}</span>` : dd === 0 ? '<span class="badge ok">Today</span>' : dd === 1 ? '<span class="badge ok">Tomorrow</span>' : '';
  return `<div class="item click inc-row" data-a="editIncome" data-id="${i.id}" role="button" tabindex="0">${dateBox(o.date, false)}
    <div class="main"><div class="t"><span class="tn">${esc(i.name)}</span>${dbBadge(i.tag)}</div><div class="s">${esc(INCOME_REPEAT[i.every] || '')}${a ? ' · into ' + esc(a.name) : ''}</div></div>
    ${when}<div class="amt pos">${(() => { const v = incAmt(i), pc = incCur(i), ac = a?.currency || 'PHP', cv = incInAcc(i);
      if (!v) { const av = incAvg(i);
        return `${av ? '≈' + money(av.v, ac) : 'Varies'}<small class="inc-sub">${num(i.hourly) ? `${money(num(i.hourly), pc)}/hr · ` : ''}${av ? `avg of last ${av.n}` : 'hours vary'}</small>`; }
      if (pc === ac) return '+' + money(v, ac);
      return `${cv != null ? '+≈' + money(cv, ac) : '+' + money(v, pc)}<small class="inc-sub">${money(v, pc)}${num(i.hourly) ? ` · ${money(num(i.hourly), pc)}/hr × ${num(i.hours)}h` : ''}</small>`; })()}</div>${withLog ? `<button class="btn sm inc-log" data-a="logIncome" data-id="${i.id}" data-date="${o.date}" aria-label="Log ${esc(i.name)} pay">${IC('download', 'sm')} Log</button>` : ''}</div>`;
}
function incomeForm(i0 = {}) {
  // Dollar pay lands in Wise USD unless he picks another account.
  const i = i0.account_id ? i0 : { ...i0, account_id: (activeAccounts().find(a => a.bank === 'wise' && a.currency === 'USD') || activeAccounts().find(a => a.bank === 'wise') || {}).id };
  modal(i.id ? 'Edit income' : 'Add income source', `<form class="form" id="incf" onsubmit="return false">
    <label class="f">Who pays you<input name="name" value="${esc(i.name || '')}" placeholder="e.g. GOOD Hoops, Intelocate" autofocus></label>
    <div class="two"><label class="f">Paid in<select name="pay_cur">${['PHP', 'USD', 'CAD', 'SGD', 'EUR', 'GBP', 'AUD'].map(c => `<option ${(i.pay_cur || curOf(i.account_id)) === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="f">Lands in<select name="account_id">${accOptions(i.account_id)}</select></label></div>
    <div class="two"><label class="f">Hourly rate<input name="hourly" inputmode="decimal" value="${i.hourly ? num(i.hourly) : ''}" placeholder="If paid by the hour"></label>
      <label class="f">Hours each payday<input name="hours" inputmode="decimal" value="${i.hours ? num(i.hours) : ''}" placeholder="e.g. 80"></label></div>
    <label class="f">Or a set amount each payday<input name="amount" inputmode="decimal" value="${!num(i.hourly) && i.amount ? num(i.amount).toFixed(2) : ''}" placeholder="Leave blank if it varies"></label>
    <div class="two"><label class="f">How often<select name="every">${Object.entries(INCOME_REPEAT).map(([k, l]) => `<option value="${k}" ${(i.every || 'biweekly') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Next payday<input type="date" name="next" value="${i.next || today()}"></label></div>
    <div class="hint">Paid in dollars? Scry shows it in pesos at your USD rate (Settings), so the peso figure moves with the rate. When you log the pay, type what actually arrived.</div>
    ${segTag(i.tag || 'personal')}
  </form>`, `${i.id ? `<button class="btn danger left" data-a="delIncome" data-id="${i.id}">Delete</button>` : ''}<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="saveIncome" data-id="${i.id || ''}">Save</button>`);
}

const PER_MONTH = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12, none: 0 };
const billsPerMonth = () => activeBills().reduce((s, b) => s + num(b.amount) * (PER_MONTH[b.repeat] || 0), 0);
const overdueBills = () => S.d.bills.filter(b => b.active && b.due_date < today());

// smart category guess: learn from past notes first, then keyword rules
function guessCategory(note, kind) {
  const n = norm(note); if (!n) return null;
  for (let i = S.d.transactions.length - 1; i >= 0; i--) {
    const t = S.d.transactions[i];
    if (t.kind === kind && t.category_id && norm(t.note) === n) return t.category_id;
  }
  for (const [re, name] of RULES) if (re.test(note)) { const c = S.d.categories.find(c => c.name === name && c.kind === kind); if (c) return c.id; }
  return null;
}

// ---------- notification reader ----------
// A text whose sender is the bank itself ("GCash": "Your payment of P976.90 to Grab…") counts as that bank.
const SMS_BANK = { gcash: /^\s*gcash\b/i, maribank: /^\s*mari\s?bank\b/i, gotyme: /^\s*go\s?tyme\b/i, wise: /^\s*wise\b/i };
const smsBank = item => /messag|\bmms\b|\bsms\b/i.test(`${item.app || ''} ${item.package || ''}`)
  ? (Object.entries(SMS_BANK).find(([, re]) => re.test(item.title || '')) || [])[0] || null : null;
function bankOf(item) {
  const s = `${item.app || ''} ${item.package || ''}`;
  for (const [k, v] of Object.entries(BANKS)) if (v.re.test(s)) return k;
  return smsBank(item);
}
// Texts (Google Messages / Samsung Messages) and Gmail carry bills and payment confirmations from billers.
function sourceOf(item) {
  const s = `${item.app || ''} ${item.package || ''}`;
  if (/gmail|android\.gm\b/i.test(s)) return 'email';
  if (/messag|\bmms\b|\bsms\b/i.test(s)) return smsBank(item) ? 'bank' : 'sms';
  return 'bank';
}
// Biller name from the sender ("PLDTHome" → PLDT) or the text ("for PLDT Account")
function billerOf(item) {
  const text = `${item.title || ''} ${item.body || ''}`;
  const bm = text.match(/\bbiller:\s*([A-Za-z0-9&'. \-]{2,40}?)\s*(?:\.\s|bill amount|amount|reference|$)/i) || text.match(/\bpayment (?:of [^.]{0,30}? )?to ([A-Z][A-Za-z0-9&' \-]{2,40}?)(?:\.|,| for\b|$)/);
  const known = [['PLDT', /pldt/i], ['Meralco', /meralco/i], ['Globe', /globe/i], ['Smart', /\bsmart\b/i], ['Converge', /converge/i], ['Maynilad', /maynilad/i], ['Manila Water', /manila water/i], ['Sky', /\bsky ?(cable|fiber)\b/i], ['DITO', /\bdito\b/i]];
  const k = known.find(([, re]) => re.test(text)); if (k) return k[0];
  if (bm) return bm[1].replace(/\s+(inc|corp|co)\.?$/i, '').trim();
  const m = text.match(/\b(?:for|from)\s+([A-Z][A-Za-z&.\- ]{2,30}?)\s+(?:account|acct|bill|subscription)\b/i);
  return m ? m[1].trim() : (item.title || '').replace(/\s*(home|ph|alerts?|notify|noreply|no-reply)\s*$/i, '').trim() || null;
}
function billDueOf(item) {                      // a due date written in the message, if any
  const text = `${item.title || ''} ${item.body || ''}`;
  const m = text.match(/\bdue(?:\s+date)?(?:\s+on|\s+is|:)?\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (!m) return null;
  const d = new Date(/\d{4}/.test(m[1]) || /\//.test(m[1]) ? m[1] : `${m[1]} ${new Date().getFullYear()}`);
  return isNaN(d) ? null : iso(d);
}
// Employers as their payroll names appear in Wise → the income source they belong to.
const PAYERS = [[/western canada preparatory/i, 'GOOD Hoops'], [/summit stride/i, 'Intelocate']];
const payerName = s => (PAYERS.find(([re]) => re.test(s || '')) || [])[1] || null;
function parseNotif(item) {
  const text = `${item.title || ''}. ${item.body || ''}`.replace(/\s+/g, ' ');
  let amount = null, currency = 'PHP', m;
  const N = '([0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)';
  if ((m = text.match(new RegExp('(?:PHP|Php|₱|\\bP)\\s?' + N))) || (m = text.match(new RegExp(N + '\\s?PHP', 'i')))) amount = m[1];
  else if ((m = text.match(new RegExp('\\b(USD|SGD|EUR|GBP|AUD|CAD)\\s?' + N))) || (m = text.match(new RegExp(N + '\\s?(USD|SGD|EUR|GBP|AUD|CAD)\\b')))) {
    const curFirst = /^[A-Z]{3}$/.test(m[1]); currency = curFirst ? m[1] : m[2]; amount = curFirst ? m[2] : m[1];
  } else if ((m = text.match(/(?:US)?\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/))) { currency = 'USD'; amount = m[1]; }
  amount = amount != null ? Number(String(amount).replace(/,/g, '')) : null;
  const inRe = /you(?:'ve| have)? received|\breceived\b|credited|cash[- ]?in|deposit|incoming|refund|added to your|you got|has arrived|interest earned|money in/i;
  const outRe = /you(?:'ve| have)? sent|\bsent to\b|you paid|payment (?:to|of|for)|\bpaid\b|purchase|debited|withdr[ae]w|cash[- ]?out|transferred to|\bspent\b|charged|deducted|money out|card (?:payment|transaction)|transaction of\b.{1,40}?\bto\b|you(?:'ve| have)? transferred|\btransferred\b.{1,40}?\bto\b|qrph payment|scan ?& ?pay transaction|bills? payment|merchant payment/i;
  let kind = null;
  if (/sent you|has sent you/i.test(text)) kind = 'income';
  else if (/\btransfer of\b.{1,40}?\bto\b/i.test(text)) kind = 'expense';   // MariBank: "An InstaPay transfer of PHP 50.00 to GCash …"
  else if (/\btransfer of\b.{1,40}?\bfrom\b/i.test(text)) kind = 'income';
  else if (outRe.test(text)) kind = 'expense';
  else if (inRe.test(text)) kind = 'income';
  const pq = text.match(/\b(?:from|to|at)\s+["“']([^"”']{1,40})["”']/);   // a quoted name: from "JUAN & CO"
  // A full stop ends the name only at a sentence end, so initials like "B. H. R. AUSTRIA" stay whole.
  const pm = pq || text.match(/\b(?:from|to|at)\s+([A-Z0-9][A-Za-z0-9&'.*\- ]{1,40}?)(?=\s+(?:on|with|via|using|ref|reference|has|is|was|and|for)\b|\s*[,!(•]|\.(?:\s+[a-z]|\s*$)|$)/);
  const rm = text.match(/(?:ref(?:erence)?(?:\s*(?:no|number|#))?\.?|txn(?: id)?|transaction id)[:\s#]*([A-Z0-9-]{5,})/i);
  if (sourceOf(item) !== 'bank') {          // a biller's text or email: either "thanks for your payment" or "your bill is due"
    if (amount == null) {                   // billers often write a bare number: "amount due 1,599.00", "total of 6147.61"
      const near = text.match(/(?:amount|total|balance|bill|due|payment|pay|amt)\b[^0-9]{0,30}?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{2})/i)
        || text.match(/(?<![0-9/.-])([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2}|[0-9]+\.[0-9]{2})(?![0-9/])/);   // else any money-looking number with centavos
      if (near) amount = Number(near[1].replace(/,/g, ''));
    }
    const paid = /thank you for (?:your )?payment|payment (?:of|amounting to)[^.]{0,40}(?:has been |was )?(?:received|posted|credited)|we(?:'ve| have) received your payment|successfully paid|payment received|successful (?:bill )?payment|successfully processed your payment|payment (?:was |is )?successful/i.test(text);
    const due = /\bdue\b|amount due|total amount due|statement of account|your (?:bill|soa)|bill (?:is|amounting)|please pay|\bbill\b|\bsoa\b|\bbilling\b|e-?statement/i.test(text);
    const k = paid ? 'billpaid' : due ? 'billdue' : null;
    return { amount, currency, kind: k, party: billerOf(item), due: k === 'billdue' ? billDueOf(item) : null, ref: rm ? rm[1] : null, ok: k != null };   // amount may be missing (subject-only email)
  }
  // Cashback / rebate credited (MariBank: "Your PHP 2.00 reward for Scan & Pay Cashback has been credited")
  const cashback = /cash ?back|rebate|reward/i.test(text) && /credited|received|earned|added|unlocked/i.test(text);
  if (cashback) kind = 'income';
  // A fee written in the message: "fee of PHP 15.00", "convenience fee: P10"
  const fm = text.match(/(?:transaction|service|convenience|processing|transfer)?\s*(?:fee|charge)s?\b[^0-9]{0,25}?(?:PHP|₱|\bP)?\s?([0-9]+(?:\.[0-9]{1,2})?)/i);
  const fee = fm && !cashback ? Number(fm[1]) : 0;
  const payer = kind === 'income' ? payerName(text) : null;
  return { amount, currency, kind, party: cashback ? 'Cashback' : payer ? payer : (pm ? pm[1].trim() : null), payer, cashback, fee: fee > 0 && amount && fee < amount ? fee : 0, ref: rm ? rm[1] : null, ok: amount != null && kind != null };
}
function possibleDuplicate(accountId, amount, date) {
  const near = S.d.transactions.filter(t => t.account_id === accountId && Math.abs(daysBetween(t.date, date)) <= 2);
  return near.find(t => Math.abs(num(t.amount) - amount) < 0.005)
    || near.find(t => t.bill_id && near.some(f => f !== t && f.note === `${t.note} fee` && Math.abs(num(t.amount) + num(f.amount) - amount) < 0.005));
}
const newInbox = () => S.d.inbox.filter(i => i.status === 'new').sort((a, b) => b.received_at.localeCompare(a.received_at));
// Same bank AND same currency first (Wise has PHP/USD/CAD accounts), then any account of that bank.
const inboxAccount = it => {
  const mine = S.d.accounts.filter(x => x.bank === bankOf(it) && !x.archived);
  const cur = parseNotif(it).currency;
  return mine.find(x => (x.currency || 'PHP') === cur) || mine[0];
};
// ----- transfers between Blu's own accounts -----
// His names as banks print them live in his Scry login profile (user_metadata.own_names), never in this public code.
const ownNames = () => String((S.user?.user_metadata?.own_names ?? S.settings.ownNames) || '')
  .split(',').map(norm).filter(n => n.length >= 3);
const isOwnParty = party => { const p = norm(party); return !!p && ownNames().some(n => p.includes(n)); };
const BANK_WORDS = { gcash: /gcash/i, gotyme: /go-?\s?tyme/i, maribank: /mari\s?bank/i, wise: /\bwise\b/i };
function accountNamedIn(text, currency, exceptId) {
  const k = Object.keys(BANK_WORDS).find(b => BANK_WORDS[b].test(text || '')); if (!k) return null;
  const mine = S.d.accounts.filter(x => x.bank === k && !x.archived && x.id !== exceptId);
  return mine.find(x => (x.currency || 'PHP') === currency) || mine[0] || null;
}
const sameTransfer = (fromId, toId, amount, date) => S.d.transactions.find(t => t.kind === 'transfer'
  && (!fromId || t.account_id === fromId) && (!toId || t.to_account_id === toId)
  && Math.abs(num(t.amount) - amount) < 0.005 && Math.abs(daysBetween(t.date, date)) <= 2);

function inboxCheck(it) {
  if (sourceOf(it) !== 'bank') {
    const p = parseNotif(it), date = iso(new Date(it.received_at));
    // A monthly bill (Meralco, BP Water) is updated, never a one-off like "Meralco arrears".
    const same = b => b.active && (norm(b.name).includes(norm(p.party)) || norm(p.party).includes(norm(b.name)) || norm(b.name).split(' ')[0] === norm(p.party).split(' ')[0] && norm(p.party).split(' ')[0].length > 2);
    const bill = p.party ? (S.d.bills.find(b => same(b) && b.repeat !== 'none') || (p.kind === 'billpaid' ? S.d.bills.find(same) : null)) : null;
    const near = S.d.transactions.filter(t => t.kind === 'expense' && Math.abs(daysBetween(t.date, date)) <= 3);
    const dup = p.kind === 'billpaid' && p.amount != null ? (near.find(t => Math.abs(num(t.amount) - p.amount) < 0.005)
      || near.find(t => t.bill_id && near.some(f => f !== t && f.note === `${t.note} fee` && Math.abs(num(t.amount) + num(f.amount) - p.amount) < 0.005))
      || newInbox().find(o => o.id !== it.id && sourceOf(o) === 'bank' && Math.abs((parseNotif(o).amount ?? -1) - p.amount) < 0.005 && Math.abs(daysBetween(iso(new Date(o.received_at)), date)) <= 3)) : null;
    return { p, a: null, date, bill, dup, biller: true, ready: false };
  }
  const p = parseNotif(it), a = inboxAccount(it), date = iso(new Date(it.received_at));
  const curMismatch = a && p.ok && p.currency !== (a.currency || 'PHP');
  const own = p.ok && isOwnParty(p.party);
  if (own && p.kind === 'expense') {                       // money leaving one of his accounts for another of his
    const to = accountNamedIn(p.party, p.currency, a?.id);
    const dup = a && to ? sameTransfer(a.id, to.id, p.amount, date) : null;
    return { p, a, date, dup, curMismatch, xfer: { from: a, to }, ready: !!(a && to && !dup && !curMismatch) };
  }
  if (own && p.kind === 'income') {                        // the receiving side of his own transfer
    const counted = a ? sameTransfer(null, a.id, p.amount, date) : null;
    return { p, a, date, dup: counted, curMismatch, xfer: { from: null, to: a }, counted: !!counted, ready: false };
  }
  const dup = a && p.amount != null ? possibleDuplicate(a.id, p.amount, date) : null;
  // Paying a bill from a bank or e-wallet usually adds ₱10–15: ₱515 against a ₱500 bill = ₱500 bill + ₱15 fee.
  let split = null;
  if (p.ok && p.kind === 'expense' && !p.cashback) {
    const near = S.d.bills.filter(b => b.active && Math.abs(daysBetween(b.due_date, date)) <= 12);
    const named = near.find(b => p.party && (norm(p.party).includes(norm(b.name)) || norm(b.name).includes(norm(p.party))));
    const bill = (named && p.amount - num(named.amount) >= 0 && p.amount - num(named.amount) <= 30 ? named : null)
      || near.find(b => p.amount - num(b.amount) > 0.004 && p.amount - num(b.amount) <= 30);
    if (bill) split = { bill, base: num(bill.amount), fee: Math.round((p.amount - num(bill.amount)) * 100) / 100 };
    else if (p.fee) split = { bill: null, base: Math.round((p.amount - p.fee) * 100) / 100, fee: p.fee };
  }
  return { p, a, date, dup, curMismatch, split, ready: p.ok && a && !dup && !curMismatch };
}
// Cashback and fees get their own categories (made once, on first use).
async function catFor(kind, name, icon) {
  const ex = S.d.categories.find(c => !c.archived && c.kind === kind && norm(c.name) === norm(name));
  if (ex) return ex.id;
  const [c] = await DB.insert('categories', { kind, name, icon, sort: 90 }); return c.id;
}

// ---------- seeding ----------
async function seedIfEmpty() {
  if (S.d.categories.length) return;
  await DB.insert('categories', DEFAULT_CATS.map(([kind, name, icon], i) => ({ kind, name, icon, sort: i })));
  const dbc = S.d.categories.find(c => c.name === 'Daybreak business');
  await DB.insert('bills', DAYBREAK_BILLS.map(([name, amount, due_date, repeat, note]) => ({
    name, amount, due_date, repeat, note, tag: 'daybreak', category_id: dbc?.id || null, active: true, autopay: true,
  })));
  if (isDemo()) await seedDemo();
}
async function seedDemo() {
  const [go, mari, gc, wise, cash] = await DB.insert('accounts', [
    { name: 'GoTyme', type: 'bank', bank: 'gotyme', opening_balance: 38000, currency: 'PHP', sort: 1 },
    { name: 'MariBank', type: 'savings', bank: 'maribank', opening_balance: 52000, currency: 'PHP', sort: 2 },
    { name: 'GCash', type: 'ewallet', bank: 'gcash', opening_balance: 4200, currency: 'PHP', sort: 3 },
    { name: 'Wise USD', type: 'bank', bank: 'wise', opening_balance: 420, currency: 'USD', sort: 4 },
    { name: 'Cash', type: 'cash', opening_balance: 2500, currency: 'PHP', sort: 5 },
  ]);
  const c = n => S.d.categories.find(x => x.name === n)?.id;
  const mk = thisMonth(), d = n => `${mk}-${pad(Math.min(n, parseInt(today().slice(8), 10)))}`;
  await DB.insert('transactions', [
    { date: d(1), kind: 'income', amount: 850, account_id: wise.id, category_id: c('Freelance & VA work'), note: 'Client payment', tag: 'personal' },
    { date: d(2), kind: 'transfer', amount: 300, to_amount: 18600, account_id: wise.id, to_account_id: go.id, note: 'Wise to GoTyme', tag: 'personal' },
    { date: d(3), kind: 'expense', amount: 3180, account_id: go.id, category_id: c('Food & groceries'), note: 'Puregold', tag: 'personal' },
    { date: d(4), kind: 'expense', amount: 1699, account_id: go.id, category_id: c('Phone & internet'), note: 'PLDT Fiber', tag: 'personal' },
    { date: d(5), kind: 'expense', amount: 289, account_id: gc.id, category_id: c('Dining out'), note: 'Jollibee', tag: 'personal' },
    { date: d(6), kind: 'expense', amount: 185, account_id: gc.id, category_id: c('Transport'), note: 'Grab', tag: 'personal' },
    { date: d(7), kind: 'transfer', amount: 2000, account_id: go.id, to_account_id: gc.id, note: 'Top up GCash', tag: 'personal' },
    { date: d(8), kind: 'expense', amount: 5000, account_id: go.id, category_id: c('Family support'), note: 'Padala kay Mama', tag: 'personal' },
    { date: d(9), kind: 'expense', amount: 482.02, account_id: gc.id, category_id: c('Daybreak business'), note: 'Kling AI', tag: 'daybreak' },
    { date: d(10), kind: 'expense', amount: 640, account_id: cash.id, category_id: c('Dining out'), note: 'Samgyup with friends', tag: 'personal' },
    { date: d(12), kind: 'income', amount: 96.4, account_id: mari.id, category_id: c('Interest'), note: 'MariBank interest', tag: 'personal' },
    { date: d(14), kind: 'expense', amount: 2450, account_id: go.id, category_id: c('Utilities'), note: 'Meralco', tag: 'personal' },
    { date: d(16), kind: 'expense', amount: 420, account_id: gc.id, category_id: c('Transport'), note: 'Angkas + LRT', tag: 'personal' },
  ]);
  await DB.insert('budgets', [
    ['Food & groceries', 9000], ['Dining out', 3000], ['Transport', 2500], ['Utilities', 3500], ['Phone & internet', 1800],
    ['Family support', 5000], ['Subscriptions', 1500], ['Daybreak business', 7500], ['Fun & going out', 2000],
  ].map(([n, amount]) => ({ month: mk + '-01', category_id: c(n), amount })));
  await DB.insert('bills', [
    { name: 'Meralco', amount: 2450, due_date: addDays(today(), -2), repeat: 'monthly', tag: 'personal', category_id: c('Utilities'), account_id: go.id, active: true },
    { name: 'PLDT Fiber', amount: 1699, due_date: addDays(today(), 5), repeat: 'monthly', tag: 'personal', category_id: c('Phone & internet'), account_id: go.id, active: true },
    { name: 'Maynilad', amount: 380, due_date: addDays(today(), 11), repeat: 'monthly', tag: 'personal', category_id: c('Utilities'), account_id: gc.id, active: true },
  ]);
  const now = Date.now(), ago = h => new Date(now - h * 3600000).toISOString();
  // SAMPLE notifications, invented wording, not each bank's real format. They pass through the same
  // filter as real ones would: the code message and the amount-less message are dropped, never stored.
  await DB.insert('inbox', [
    { received_at: ago(1), app: 'GCash', package: 'com.globe.gcash.android', title: 'GCash', body: 'You have paid PHP 156.00 to 7-Eleven via QR. Ref No. 1029384756' },
    { received_at: ago(3), app: 'GoTyme', package: 'ph.gotyme.bank', title: 'Money in', body: 'You received P 2,500.00 from JUAN DELA CRUZ.' },
    { received_at: ago(5), app: 'Wise', package: 'com.transferwise.android', title: 'You received 120.00 USD', body: '120.00 USD from ACME LLC has arrived in your USD balance.' },
    { received_at: ago(8), app: 'MariBank', package: 'ph.maribank', title: 'Transfer successful', body: 'PHP 1,000.00 sent to GCash 0917•••. ' },
    { received_at: ago(2), app: 'GCash', package: 'com.globe.gcash.android', title: 'GCash', body: 'Your authentication code is 482913. Do not share it with anyone.' },
    { received_at: ago(26), app: 'MariBank', package: 'ph.maribank', title: 'Transaction alert', body: 'Your account was credited with your daily interest.' },
  ]);
}

// ---------- shell ----------
// Lucide icons (lucide@0.460.0, loaded in index.html); drawn into <i data-lucide> after each render.
const IC = (name, cls = '') => `<i data-lucide="${name}" class="lc ${cls}" aria-hidden="true"></i>`;
const drawIcons = () => { try { window.lucide?.createIcons(); } catch { /* icons are decoration only */ } };
const NAV = [['home', 'Home', 'house'], ['tx', 'Activity', 'activity'], ['budget', 'Budgets', 'pie-chart'], ['bills', 'Bills', 'calendar-days'], ['accounts', 'Wallet', 'wallet']];
function navCounts() { return { home: newInbox().length, tx: 0, bills: overdueBills().length }; }
function shell() {
  return `<div class="shell">
    <aside class="rail" aria-label="Main navigation"><div class="brand"><img class="mark" src="brand/scry-icon.svg" alt="">Scry</div>
      ${isDemo() ? '<span class="demo-pill" title="Sample data only">Demo data</span>' : '<div style="height:18px"></div>'}
      <nav class="nav" id="railnav"></nav>
      <div class="foot">${isDemo() ? 'Sample data, kept only in this browser. Nothing is sent anywhere.' : esc(S.user?.email || '')}</div></aside>
    <main id="main"></main>
    <nav class="tabbar" id="tabnav" aria-label="Main navigation"></nav>
    <button class="fab" data-a="addTx" aria-label="Add a transaction">${IC('plus', 'lg')}<span>Add</span></button></div>`;
}
function renderNav() {
  const c = navCounts(), cnt = k => c[k] ? `<span class="count ${k === 'bills' ? 'risk' : ''}" aria-label="${c[k]} need attention">${c[k]}</span>` : '';
  const link = ([k, l, i]) => `<a href="#${k}" class="${S.view === k ? 'on' : ''}" ${S.view === k ? 'aria-current="page"' : ''} aria-label="${l}"><span class="ni">${IC(i)}</span>${l}${cnt(k)}</a>`;
  $('#railnav').innerHTML = NAV.map(link).join('') + `<a href="#penny" class="penny-link ${S.view === 'penny' ? 'on' : ''}"><span class="ni">${IC('sparkles')}</span>Ask Penny</a>`
    + '<div class="sep"></div>' + link(['settings', 'Settings', 'settings']);
  const tab = k => link(NAV.find(n => n[0] === k));
  $('#tabnav').innerHTML = tab('home') + tab('tx') + `<button class="tab-add" data-a="addSheet" aria-label="Add">${IC('plus', 'lg')}</button>` + tab('bills') + tab('accounts');
}
function mhead() {
  const hr = new Date().getHours(), hi = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const nm = String(S.user?.user_metadata?.own_names || '').split(',')[0].trim().split(' ')[0] || 'Blu';
  const brand = S.view === 'home' ? `<div class="brand greet"><div><div class="hi cap">${new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</div><div class="nm">Hello, ${esc(nm)}!</div></div></div>` : `<div class="brand"><img class="mark" src="brand/scry-icon.svg" alt="">Scry</div>`;
  return `<div class="mhead">${brand}${isDemo() ? '<span class="demo-pill">Demo</span>' : ''}
    <a href="#penny" class="gear penny-btn ${S.view === 'penny' ? 'on' : ''}" aria-label="Ask Penny, your AI accountant" style="color:var(--gold-1)">${IC('sparkles')}</a>
    <a href="#settings" class="gear ${S.view === 'settings' ? 'on' : ''}" aria-label="Settings">${IC('settings')}</a></div>`;
}
function render() {
  if (!$('#main')) $('#root').innerHTML = shell();
  renderNav();
  const V = { home: vHome, tx: vTx, budget: vBudget, bills: vBills, accounts: vAccounts, settings: vSettings, penny: vPenny }[S.view] || vHome;
  document.body.dataset.view = S.view; window.__hideAmt = !!S.settings.hideAmounts;
  $('#main').innerHTML = mhead() + V();
  drawIcons();
  if (S.view === 'penny') { const log = $('#pennyLog'); if (log) log.scrollTop = log.scrollHeight; }
}

// ---------- Penny, the AI accountant ----------
// Chat lives only in this browser tab (sessionStorage); Penny herself runs as a Supabase Edge Function.
S.penny = (() => { try { return JSON.parse(localStorage.getItem('scry-penny') || sessionStorage.getItem('scry-penny') || '[]'); } catch { return []; } })();
const savePenny = () => { try { localStorage.setItem('scry-penny', JSON.stringify(S.penny.slice(-40))); } catch { /* storage full or blocked */ } };
const PENNY_STARTERS = ['How am I doing this month?', 'Where can I cut back?', 'Suggest budgets for next month', 'What bills are coming up?', 'Am I mixing Daybreak and personal money?'];
function pennyText(t) {
  // Safe mini-markdown: escape first, then **bold**, bullet lines and line breaks.
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .split('\n').map(l => /^\s*[-•]\s+/.test(l) ? `<li>${l.replace(/^\s*[-•]\s+/, '')}</li>` : l).join('\n')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, m => `<ul>${m.replace(/\n/g, '')}</ul>`)
    .replace(/\n/g, '<br>');
}
const PENNY_CARDS = [
  ['How am I doing this month?', 'activity', 'This month'],
  ['Where can I cut back?', 'scissors', 'Cut back'],
  ['What bills are coming up?', 'calendar-days', 'Bills ahead'],
  ['Suggest budgets for next month', 'pie-chart', 'Budgets'],
];
function vPenny() {
  const off = S.pennyBusy || isDemo();
  const av = `<span class="pav" aria-hidden="true">${IC('sparkles', 'sm')}</span>`;
  const msgs = S.penny.map((m, i) => m.role === 'user'
    ? `<div class="pm2 me"><div class="bub">${m.photo ? `<span class="photo-tag">${IC('camera', 'sm')} Photo</span> ` : ''}${esc(m.content)}</div></div>`
    : `<div class="pm2 her">${av}<div class="bub ${m.error ? 'err' : ''}">${pennyText(m.content)}${pennySaveBtn(m, i)}</div></div>${pennyItems(m, i)}`).join('');
  const welcome = `<div class="pwelcome"><span class="pav xl" aria-hidden="true">${IC('sparkles')}</span>
      <h2>Hi Blu, I'm Penny</h2><p>Your accountant in Scry. I see your accounts, spending, budgets and bills, and keep Daybreak's money apart from yours.</p>
      ${isDemo() ? '<p class="warn">In demo mode I\'m asleep: I only work with your live data.</p>' : ''}
      <div class="pcards">${PENNY_CARDS.map(([q, ic, k]) => `<button data-a="pennyAsk" data-q="${esc(q)}" ${off ? 'disabled' : ''}><span class="ic">${IC(ic, 'sm')}</span><small>${esc(k)}</small><b>${esc(q)}</b></button>`).join('')}</div></div>`;
  return `<div class="phead">${av}<div class="grow"><b>Penny</b><small>Your AI accountant · money questions only</small></div>
      ${S.penny.length ? `<button class="ash-btn pnew" data-a="pennyClear" aria-label="Start a new conversation">${IC('square-pen', 'sm')}</button>` : ''}</div>
    <div class="plog" id="pennyLog" aria-live="polite">${S.penny.length ? msgs : welcome}${!S.pennyBusy && S.penny.length && S.penny[S.penny.length - 1].role === 'user' ? `<div class="pm2 her">${av}<div class="bub err">Penny didn't get to answer that one. <button class="pretry" data-a="pennyRetry">${IC('rotate-ccw', 'sm')} Ask again</button></div></div>` : ''}${S.pennyBusy ? `<div class="pm2 her">${av}<div class="bub typing"><i></i><i></i><i></i></div></div>` : ''}</div>
    <form class="pcomp" onsubmit="return false">
      <button type="button" class="pc-cam" data-a="pennyScan" aria-label="Show Penny a photo of a bill or receipt" ${off ? 'disabled' : ''}>${IC('camera', 'sm')}</button>
      <textarea id="pennyIn" rows="1" placeholder="Ask Penny about your money…" ${off ? 'disabled' : ''}></textarea>
      <button class="pc-send" data-a="pennySend" aria-label="Send" ${off ? 'disabled' : ''}>${IC('arrow-up', 'sm')}</button>
    </form>
    <div class="pfine">Uses Claude by Anthropic · not a licensed financial adviser</div>`;
}
// ---------- Penny as bookkeeper: her proposed entries, approved by Blu one tap at a time ----------
const byName = (list, name) => { const n = norm(name); return n ? list.find(x => norm(x.name) === n) || list.find(x => norm(x.name).includes(n) || n.includes(norm(x.name))) : null; };
function resolveItem(it, pending = []) {                          // turn her names into real ids; anything unknown is reported, not guessed
  const d = it.d, accs = activeAccounts();
  if (it.type === 'tx') {
    const a = byName(accs, d.account), to = d.kind === 'transfer' ? byName(accs, d.to_account) : null;
    const c = d.kind === 'transfer' ? null : byName(catsOf(d.kind), d.category);
    const waits = n => pending.some(p => norm(p) === norm(n));
    const err = !a ? (waits(d.account) ? `Waits for "${d.account}" above` : `No account called "${d.account}"`) : d.kind === 'transfer' && !to ? (waits(d.to_account) ? `Waits for "${d.to_account}" above` : `No account called "${d.to_account}"`) : !(num(d.amount) > 0) ? 'Amount missing' : !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ? 'Date missing' : '';
    return { err, row: err ? null : { kind: d.kind, amount: Math.abs(num(d.amount)), date: d.date, account_id: a.id, to_account_id: to?.id || null, to_amount: to && to.currency !== a.currency && num(d.to_amount) > 0 ? num(d.to_amount) : null, category_id: c?.id || null, note: d.note || null, tag: d.tag === 'daybreak' ? 'daybreak' : 'personal' } };
  }
  if (it.type === 'bill') {
    const c = byName(catsOf('expense'), d.category), ex = d.update_existing ? byName(S.d.bills.filter(b => b.active), d.name) : null;
    const err = d.update_existing && !ex ? `No bill called "${d.name}" to update` : !/^\d{4}-\d{2}-\d{2}$/.test(d.due_date) ? 'Due date missing' : '';
    return { err, ex, row: err ? null : { name: d.name, amount: num(d.amount), due_date: d.due_date, repeat: d.repeat || 'monthly', category_id: c?.id || ex?.category_id || null, note: d.note || ex?.note || null, tag: ex?.tag || 'personal', active: true, autopay: ex?.autopay || false } };
  }
  if (it.type === 'cat') {
    const kind = d.kind === 'income' ? 'income' : 'expense', ex = catsOf(kind).find(c => norm(c.name) === norm(d.name));
    return { err: ex ? `You already have "${ex.name}"` : !String(d.name || '').trim() ? 'Name missing' : '', row: { kind, name: String(d.name).trim(), icon: d.icon || null, sort: S.d.categories.length + 1 } };
  }
  if (it.type === 'income') {
    const a = byName(accs, d.account), ex = d.update_existing ? incomes().find(x => norm(x.name) === norm(d.name)) || byName(incomes(), d.name) : null;
    const hourly = num(d.hourly_rate), hours = num(d.hours_per_payday);
    const err = !a ? (pending.some(p => norm(p) === norm(d.account)) ? `Waits for "${d.account}" above` : `No account called "${d.account}"`)
      : d.update_existing && !ex ? `No payday called "${d.name}" to update` : !/^\d{4}-\d{2}-\d{2}$/.test(d.next_payday) ? 'Next payday missing' : '';
    return { err, ex, row: err ? null : { id: ex?.id || Math.random().toString(36).slice(2, 10), name: ex?.name || String(d.name).trim(), pay_cur: (d.pay_currency || a.currency || 'PHP').toUpperCase().slice(0, 3),
      hourly, hours, amount: hourly && hours ? Math.round(hourly * hours * 100) / 100 : num(d.fixed_amount), account_id: a.id, every: d.every || 'biweekly', next: d.next_payday, tag: ex?.tag || 'personal' } };
  }
  const dup = byName(accs, d.name);
  return { err: dup && norm(dup.name) === norm(d.name) ? `You already have "${dup.name}"` : '', row: { name: d.name, type: d.type, currency: (d.currency || 'PHP').toUpperCase().slice(0, 3), opening_balance: num(d.opening_balance), sort: S.d.accounts.length + 1 } };
}
function itemLine(it) {
  const d = it.d;
  if (it.type === 'tx') {
    const a = byName(activeAccounts(), d.account), cur = a?.currency || 'PHP';
    const head = { expense: 'Expense', income: 'Income', transfer: 'Transfer' }[d.kind] || 'Entry';
    const toA = d.kind === 'transfer' ? byName(activeAccounts(), d.to_account) : null;
    const where = d.kind === 'transfer' ? `${esc(d.account)} → ${esc(d.to_account)}${num(d.to_amount) > 0 && toA && toA.currency !== cur ? ` (${money(num(d.to_amount), toA.currency)})` : ''}` :`${esc(d.account)}${d.category ? ' · ' + esc(d.category) : ''}`;
    return { ic: d.kind === 'income' ? 'arrow-down-left' : d.kind === 'transfer' ? 'arrow-left-right' : 'arrow-up-right', tone: d.kind,
      t: `${head} ${d.kind === 'income' ? '+' : d.kind === 'expense' ? '−' : ''}${money(Math.abs(num(d.amount)), cur)}`, s: `${where} · ${esc(shortDate(d.date))}${d.note ? ' · ' + esc(d.note) : ''}${d.tag === 'daybreak' ? ' · Daybreak' : ''}` };
  }
  if (it.type === 'bill') return { ic: 'receipt', tone: 'bill', t: `${d.update_existing ? 'Update bill' : 'New bill'} · ${esc(d.name)} ${money(num(d.amount))}`, s: `${esc(d.repeat === 'none' ? 'One-off' : d.repeat)} · due ${esc(d.due_date ? shortDate(d.due_date) : '?')}${d.note ? ' · ' + esc(d.note) : ''}` };
  if (it.type === 'cat') return { ic: 'tag', tone: 'bill', t: `New category · ${esc(d.icon || '')} ${esc(d.name)}`, s: d.kind === 'income' ? 'Income' : 'Spending' };
  if (it.type === 'income') { const pc = (d.pay_currency || 'PHP').toUpperCase();
    return { ic: 'calendar-clock', tone: 'income', t: `${d.update_existing ? 'Update payday' : 'New payday'} · ${esc(d.name)}`,
      s: `${num(d.hourly_rate) ? `${money(num(d.hourly_rate), pc)}/hr${num(d.hours_per_payday) ? ` × ${num(d.hours_per_payday)} hrs` : ' · hours vary'}` : num(d.fixed_amount) ? money(num(d.fixed_amount), pc) : 'amount varies'} · ${esc(INCOME_REPEAT[d.every] || d.every)} · into ${esc(d.account)} · next ${esc(d.next_payday ? shortDate(d.next_payday) : '?')}` }; }
  return { ic: d.type === 'loan' || num(d.opening_balance) < 0 ? 'landmark' : 'wallet', tone: 'acct', t: `New account · ${esc(d.name)}`, s: `${esc(ACCOUNT_TYPES[d.type]?.[0] || d.type)} · starts at ${money(num(d.opening_balance), (d.currency || 'PHP').toUpperCase())}${d.note ? ' · ' + esc(d.note) : ''}` };
}
function pennyItems(m, i) {
  if (!m.items?.length) return '';
  const open = m.items.filter(x => x.st === 'new').length;
  return `<div class="pbooks"><div class="pb-head">${IC('book-open-check', 'sm')} <b>Prepared for your books</b><span class="grow"></span>${open > 1 ? `<button class="pb-all" data-a="pbAll" data-i="${i}">Approve all ${open}</button>` : ''}</div>
    ${m.items.map((it, j) => { const L = itemLine(it), chk = it.st === 'new' ? resolveItem(it, m.items.filter(x => x.type === 'acct' && x.st === 'new').map(x => x.d.name)) : null; return `<div class="pb-row ${it.st}" data-tone="${L.tone}"><span class="ic">${IC(L.ic, 'sm')}</span>
      <span class="main"><b>${L.t}</b><small>${L.s}</small>${chk?.err ? `<small class="${chk.err.startsWith('Waits') ? 'pb-wait' : 'pb-err'}">${esc(chk.err)}</small>` : ''}${it.st === 'fail' ? `<small class="pb-err">${esc(it.msg || 'Could not save')}</small>` : ''}</span>
      ${it.st === 'new' ? `<span class="pb-acts"><button class="pb-skip" data-a="pbSkip" data-i="${i}" data-j="${j}" aria-label="Skip">${IC('x', 'sm')}</button><button class="pb-ok" data-a="pbOk" data-i="${i}" data-j="${j}" ${chk?.err ? 'disabled' : ''} aria-label="Approve">${IC('check', 'sm')}</button></span>`
        : `<span class="pb-st">${it.st === 'ok' ? `${IC('check', 'sm')} Saved` : it.st === 'skip' ? 'Skipped' : 'Not saved'}</span>`}</div>`; }).join('')}</div>`;
}
async function pbApprove(i, j) {
  const it = S.penny[i]?.items?.[j]; if (!it || it.st !== 'new') return;
  const { err, row, ex } = resolveItem(it);
  if (err) { it.st = 'fail'; it.msg = err; return; }
  try {
    if (it.type === 'tx') await DB.insert('transactions', row);
    else if (it.type === 'bill') ex ? await DB.update('bills', ex.id, row) : await DB.insert('bills', row);
    else if (it.type === 'cat') await DB.insert('categories', row);
    else if (it.type === 'income') await saveIncomes(incomes().filter(x => x.id !== row.id).concat(row));
    else await DB.insert('accounts', row);
    it.st = 'ok';
  } catch (e) { it.st = 'fail'; it.msg = e.message || 'Could not save'; }
}
async function pbApproveAll(i) {
  const items = S.penny[i]?.items || [], order = { acct: 0, cat: 0, income: 1, bill: 1, tx: 2 };   // accounts and categories first, so entries can point at them
  for (const j of items.map((x, j) => j).sort((a, b) => order[items[a].type] - order[items[b].type])) await pbApprove(i, j);
  savePenny(); render(); toast(`${items.filter(x => x.st === 'ok').length} saved to your books`);
}

// A scanned photo's details ride on Penny's reply so Blu can save them with one tap.
function pennySaveBtn(m, i) {
  const r = m.scan; if (!r || m.saved || !['receipt', 'card_slip', 'bill', 'card_statement'].includes(r.doc_type) || !(r.total || r.lines?.length)) return '';
  const label = r.doc_type === 'bill' ? 'Save as a bill' : r.doc_type === 'card_statement' ? 'Add the charges' : 'Save as an expense';
  return `<div class="psave"><button class="btn sm" data-a="pennySave" data-i="${i}">${IC('download', 'sm')} ${label}</button></div>`;
}
function pennyScan() {
  if (isDemo() || S.pennyBusy) return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let image; try { image = await shrinkPhoto(f); } catch { return toast("Couldn't open that photo"); }
    const typed = ($('#pennyIn')?.value || '').trim();
    pennySend(typed || 'Please check this for me. What is it, is anything off, and what should I do?', image);
  };
  inp.click();
}
async function pennySend(q, image) {
  q = String(q || '').trim(); if (!q || S.pennyBusy || isDemo()) return;
  S.penny.push({ role: 'user', content: q, photo: !!image }); S.pennyBusy = true; savePenny(); render();
  const cats = S.d.categories.filter(c => !c.archived && c.kind === 'expense').map(c => c.name);
  const scanP = image ? S.sb.functions.invoke('scan', { body: { image, media_type: 'image/jpeg', categories: cats, today: today() } }).then(x => x.data).catch(() => null) : Promise.resolve(null);
  try {
    const history = S.penny.filter(m => !m.error).map(({ role, content, photo, items }) => ({ role, content: (photo ? `[Blu showed you a photo here] ${content}` : content)
      + (items?.length ? `\n\n[Entries you prepared: ${items.map(x => `${x.type === 'tx' ? `${x.d.kind} ${x.d.amount} ${x.d.account}${x.d.to_account ? '→' + x.d.to_account : ''} ${x.d.date}` : x.d.name} = ${x.st === 'ok' ? 'APPROVED and saved' : x.st === 'skip' ? 'skipped by Blu' : x.st === 'fail' ? 'failed to save' : 'still waiting'}`).join('; ')}]` : '') }));
    const { data, error } = await S.sb.functions.invoke('penny', {
      body: { messages: history, image: image || undefined, today: today(), rates: S.settings.rates, ratesDate: S.settings.ratesDate || null },
    });
    let msg = data?.reply, isErr = false;
    if (error) {
      isErr = true;
      try { msg = (await error.context?.json?.())?.error; } catch { /* no body */ }
      msg ||= 'Penny couldn\'t answer right now. Try again in a moment.';
    }
    const scan = await scanP;
    // Penny fetched the latest market rate: Scry keeps it too.
    if (!isErr && data?.rates?.rates?.USD > 0) { Object.assign(S.settings, { rates: data.rates.rates, ratesDate: data.rates.date, ratesAt: Date.now() }); saveSettings(); }
    const items = isErr ? [] : (data?.proposals || []).flatMap(p => p.tool === 'propose_transactions' ? (p.input?.entries || []).map(e => ({ type: 'tx', d: e, st: 'new' }))
      : p.tool === 'propose_bill' ? [{ type: 'bill', d: p.input, st: 'new' }] : p.tool === 'propose_account' ? [{ type: 'acct', d: p.input, st: 'new' }]
      : p.tool === 'propose_category' ? [{ type: 'cat', d: p.input, st: 'new' }] : p.tool === 'propose_income' ? [{ type: 'income', d: p.input, st: 'new' }] : []);
    S.penny.push({ role: 'assistant', content: msg || 'No answer came back.', error: isErr, scan: !isErr && scan && !scan.error ? scan : undefined, items: items.length ? items : undefined });
  } catch (e) {
    S.penny.push({ role: 'assistant', content: 'Penny couldn\'t be reached. Check your internet and try again.', error: true });
  }
  S.pennyBusy = false; savePenny(); render();
  setTimeout(() => $('#pennyIn')?.focus(), 30);
}
const ph = (eyebrow, title, sub, acts = '') => `<div class="ph"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${acts ? `<div class="row acts">${acts}</div>` : ''}</div>`;
const tagChips = () => `<div class="chips" role="group" aria-label="Show">${[['all', 'All'], ['personal', 'Personal'], ['daybreak', 'Daybreak']].map(([k, l]) => `<button class="${S.tag === k ? 'on' : ''}" aria-pressed="${S.tag === k}" data-a="tag" data-v="${k}">${l}</button>`).join('')}</div>`;
const monthNav = (key = 'month') => `<div class="monthnav"><button class="iconbtn" data-a="month" data-k="${key}" data-v="-1" aria-label="Previous month">‹</button><b>${monthName(S[key])}</b><button class="iconbtn" data-a="month" data-k="${key}" data-v="1" aria-label="Next month">›</button></div>`;
const catIcon = c => esc(c?.icon || '•');
const dbBadge = tag => tag === 'daybreak' ? ' <span class="badge db">Daybreak</span>' : '';
function txRow(t) {
  const c = cat(t.category_id), a = acc(t.account_id), cur = curOf(t.account_id);
  let title, sub, amt, cls = '';
  if (t.kind === 'transfer') {
    title = t.note || 'Transfer'; sub = `${esc(a?.name || '?')} → ${esc(acc(t.to_account_id)?.name || '?')}`; amt = money(num(t.amount), cur); cls = 'muted';
  } else {
    title = t.note || c?.name || (t.kind === 'income' ? 'Income' : 'Expense');
    sub = isAdj(t) ? `Matched to your bank · ${esc(a?.name || '?')}` : `${esc(c?.name || 'Uncategorised')} · ${esc(a?.name || '?')}`;
    amt = (t.kind === 'income' ? '+' : '−') + money(num(t.amount), cur); cls = t.kind === 'income' ? 'pos' : '';
  }
  return `<div class="item click" data-a="editTx" data-id="${t.id}" role="button" tabindex="0"><div class="ico">${isAdj(t) ? IC('scale', 'sm') : t.kind === 'transfer' ? '⇄' : catIcon(c)}</div>
    <div class="main"><div class="t"><span class="tn">${esc(title)}</span>${dbBadge(t.tag)}</div><div class="s">${sub}</div></div>
    <div class="amt ${cls}">${amt}</div></div>`;
}
function dateBox(date, late) {
  const d = parseD(date), dd = daysBetween(today(), date);
  return `<div class="datebox ${late ? 'late' : dd <= 7 ? 'soon' : ''}"><span>${d.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase()}</span><b>${d.getDate()}</b></div>`;
}
function billRow(o, withPay = true) {
  const b = o.bill, dd = daysBetween(today(), o.date);
  const when = o.late ? `<span class="badge risk">${-dd === 1 ? '1 day late' : -dd + ' days late'}</span>` : dd === 0 ? '<span class="badge db">Due today</span>' : dd === 1 ? '<span class="badge db">Tomorrow</span>' : dd <= 7 ? `<span class="badge db">In ${dd} days</span>` : '';
  return `<div class="item click" data-a="editBill" data-id="${b.id}" role="button" tabindex="0">${dateBox(o.date, o.late)}
    <div class="main"><div class="t"><span class="tn">${esc(b.name)}</span>${dbBadge(b.tag)}</div><div class="s">${esc(b.repeat === 'none' ? 'One-off' : b.repeat[0].toUpperCase() + b.repeat.slice(1))}${b.autopay ? ' · auto-pay' : ''}${b.account_id && acc(b.account_id) ? ' · ' + esc(acc(b.account_id).name) : ''}</div></div>
    ${when}<div class="amt">${money(num(b.amount))}</div>${withPay ? `<button class="btn sm" data-a="payBill" data-id="${b.id}" data-date="${o.date}" aria-label="Log payment for ${esc(b.name)}">Pay</button>` : ''}</div>`;
}

// ---------- review tray ----------
// One review row: logo | what + status | amount | actions. Raw text lives only in the review sheet.
function reviewRow(it) {
  if (sourceOf(it) !== 'bank') {
    const { p, bill, dup } = inboxCheck(it), src = sourceOf(it);
    const title = p.ok ? `${p.party || 'Bill'} ${p.kind === 'billpaid' ? 'paid' : 'bill'}` : (it.title || 'Message');
    const status = !p.ok ? "Couldn't read this one" : dup ? 'Possible duplicate' : p.kind === 'billpaid' ? 'Which account paid it?' : `Due ${p.due ? shortDate(p.due) : 'soon'}${bill ? ' · update bill' : ' · add bill'}`;
    const st = !p.ok || dup ? 'risk' : p.kind === 'billpaid' ? 'ask' : '';
    return `<div class="rvr" data-a="editInbox" data-id="${it.id}" role="button" tabindex="0">
      <div class="lg src" aria-hidden="true">${IC(src === 'email' ? 'mail' : 'message-square-text', 'sm')}</div>
      <div class="main"><div class="t">${esc(title)}</div><div class="s"><span class="st ${st}">${esc(status)}</span><span class="when">${src === 'email' ? 'Email' : 'Text'} · ${esc(timeOf(it.received_at))}</span></div></div>
      <div class="amt">${p.amount != null ? (p.kind === 'billpaid' ? '−' : '') + money(p.amount, p.currency) : '<span class="faint">Amount?</span>'}</div><div class="ra"><button class="rbtn hov" data-a="ignoreInbox" data-id="${it.id}" aria-label="Dismiss">${IC('x', 'sm')}</button></div></div>`;
  }
  const { p, a, dup, curMismatch, ready, xfer, counted } = inboxCheck(it), bk = bankOf(it), bank = BANKS[bk];
  let title, amtTxt = '', amtCls = '', status = '', st = '';
  if (!p.ok) { title = it.title || 'Notification'; status = "Couldn't read this one"; st = 'risk'; }
  else if (xfer) {
    amtTxt = money(p.amount, p.currency); amtCls = 'muted';
    if (counted) { title = `${xfer.from?.name || 'Transfer'} → ${xfer.to?.name || '?'}`; status = 'Already counted'; }
    else if (xfer.from && xfer.to) { title = `${xfer.from.name} → ${xfer.to.name}`; status = 'Own transfer'; }
    else if (!xfer.from) { title = `Into ${xfer.to?.name || 'your account'}`; status = 'From which account?'; st = 'ask'; }
    else { title = `Out of ${xfer.from.name}`; status = 'To which account?'; st = 'ask'; }
  } else {
    title = p.party || (p.kind === 'income' ? 'Money in' : 'Money out');
    amtTxt = (p.kind === 'income' ? '+' : '−') + money(p.amount, p.currency); amtCls = p.kind === 'income' ? 'pos' : '';
    const g = cat(guessCategory(p.party || it.title, p.kind));
    if (!a) { status = `No ${bank?.name || ''} account linked`; st = 'risk'; }
    else if (curMismatch) { status = `${p.currency} account needed`; st = 'risk'; }
    else if (dup) { status = 'Possible duplicate'; st = 'risk'; }
    else if (p.cashback) status = 'Cashback';
    else if (inboxCheck(it).split) { const sp = inboxCheck(it).split; status = `${sp.bill ? sp.bill.name : 'Payment'} ${money(sp.base)} + ${money(sp.fee)} fee`; }
    else status = [g?.name, a.name].filter(Boolean).join(' · ');
  }
  const logo = BANK_LOGO[bk] ? `<img src="${BANK_LOGO[bk]}" alt="" width="40" height="40">` : `<span>${esc((bank?.name || it.app || '?')[0])}</span>`;
  const acts = counted ? `<button class="rbtn" data-a="ignoreInbox" data-id="${it.id}" aria-label="Dismiss">${IC('x', 'sm')}</button>`
    : `${ready ? `<button class="rbtn ok" data-a="acceptInbox" data-id="${it.id}" aria-label="Approve">${IC('check', 'sm')}</button>` : ''}<button class="rbtn hov" data-a="ignoreInbox" data-id="${it.id}" aria-label="Dismiss">${IC('x', 'sm')}</button>`;
  return `<div class="rvr" data-a="editInbox" data-id="${it.id}" role="button" tabindex="0">
    <div class="lg" aria-hidden="true">${logo}</div>
    <div class="main"><div class="t">${esc(title)}</div><div class="s"><span class="st ${st}">${esc(status)}</span><span class="when" title="${esc(bank?.name || it.app || '')}">${esc(timeOf(it.received_at))}</span></div></div>
    <div class="amt ${amtCls}">${amtTxt}</div><div class="ra">${acts}</div></div>`;
}
function reviewStrip() {
  const items = newInbox(); if (!items.length) return '';
  const ready = items.filter(it => inboxCheck(it).ready).length;
  return `<a class="rv-strip" href="#tx"><span class="n">${items.length}</span><div class="grow"><b>${items.length} to review</b><div class="s">${ready ? `${ready} ready to approve` : 'Tap to check them'}</div></div>${IC('chevron-right')}</a>`;
}
function tray(limit) {
  const items = newInbox(); if (!items.length) return '';
  const ready = items.filter(it => inboxCheck(it).ready).length;
  return `<section class="card tray" aria-label="To review"><div class="trh"><b>To review</b><span class="count">${items.length}</span><span class="grow"></span>
    ${ready > 1 ? `<button class="btn sm" data-a="acceptAll">${IC('check-check', 'sm')} Approve ${ready} ready</button>` : ''}</div>
    <div class="rvlist">${items.slice(0, limit).map(reviewRow).join('')}</div>
    ${items.length > limit ? `<a class="more" href="#tx">See all ${items.length}</a>` : ''}</section>`;
}
// ---------- views ----------
const CAT_ICON = { 'food & groceries': 'shopping-cart', 'dining out': 'utensils', transport: 'car', utilities: 'lightbulb', 'phone & internet': 'wifi', 'rent & home': 'house', health: 'heart-pulse', 'family support': 'users', shopping: 'shopping-bag', subscriptions: 'repeat', education: 'book-open', 'personal care': 'sparkles', entertainment: 'film', fees: 'receipt', 'business': 'briefcase', gifts: 'gift', travel: 'plane', insurance: 'shield', savings: 'piggy-bank' };
const catLucide = c => CAT_ICON[String(c?.name || '').toLowerCase()] || 'tag';
// One account as a bank card, drawn from each bank's real card and official logo files (brand/cards/).
// No card numbers, real or fake.
const CARD_ART = {
  maribank: () => '',
  gotyme: () => '<div class="art gt" aria-hidden="true"><i class="stripes"></i><div class="band"><img src="brand/cards/gotyme-logo-dark.svg" alt=""></div></div>',
  gcash: () => '<img class="art gc-big" src="brand/cards/gcash-icon-white.svg" alt="">',
  wise: () => '<img class="art wise-flag" src="brand/cards/wise-flag.svg" alt="">',
};
const CARD_HEAD = {
  maribank: () => '',
  gotyme: () => '<img class="hd-gt" src="brand/cards/gotyme-logo-white.svg" alt="GoTyme">',
  gcash: () => '<img class="hd-gc" src="brand/cards/gcash-icon-white.svg" alt=""><span class="nm">GCash</span>',
  wise: a => `<img class="hd-wise" src="brand/cards/wise-logo.svg" alt="Wise">${a.currency !== 'PHP' || /wise\s+\w+/i.test(a.name) ? `<span class="cur">${esc(a.currency)}</span>` : ''}`,
};
// Blu's own card images (Nov 21 2026). Each already shows the logo and chip, so only the balance goes on top.
const CARD_PHOTO = { wise: 'wise', gotyme: 'gotyme', cash: 'cash', maribank: 'maribank', gcash: 'gcash' };
function bankCard(a, bal, o = {}) {
  const pb = a.bank || (a.type === 'cash' ? 'cash' : '');
  if (CARD_PHOTO[pb]) {
    const cur = o.cur || a.currency, id = o.id || a.id;
    const tag = o.count ? `${o.count} accounts` : (a.bank === 'wise' && (a.currency !== 'PHP' || /wise\s+\w+/i.test(a.name)) ? a.currency : '');
    return `<div class="bcard photo" data-brand="${pb}" data-a="cardMenu" data-id="${id}" role="button" tabindex="0" aria-label="${esc(o.count ? (BANKS[a.bank]?.name || a.name) : a.name)}, ${money(bal, cur)}">
      <img class="art pic" src="brand/cards/${CARD_PHOTO[pb]}.jpg" alt="">${tag ? `<span class="ptag">${esc(tag)}</span>` : ''}
      <div class="bot"><div class="k">${o.count ? 'Total' : 'Balance'}${o.note ? ` · ${esc(o.note)}` : ''}</div><div class="m ${bal < 0 ? 'neg' : ''}">${money(bal, cur)}</div></div></div>`;
  }
  const brand = a.bank || (a.type === 'cash' ? 'cash' : a.type === 'credit' ? 'credit' : 'other');
  const art = CARD_ART[brand]?.() || '';
  let head = CARD_HEAD[brand] ? CARD_HEAD[brand](a) : `<span class="lg">${accIcon(a, 30)}</span><span class="nm">${esc(a.name)}</span>`;
  if (o.count) head = head.replace(/<span class="cur">.*?<\/span>/, '') + `<span class="cur">${o.count} accounts</span>`;
  const chip = brand === 'maribank' ? '' : '<span class="chip" aria-hidden="true"></span>';
  const cur = o.cur || a.currency, id = o.id || a.id;
  return `<div class="bcard" data-brand="${brand}" data-a="cardMenu" data-id="${id}" role="button" tabindex="0" aria-label="${esc(o.count ? (BANKS[a.bank]?.name || a.name) : a.name)}, ${money(bal, cur)}">
    ${art}<div class="top">${head}</div>${chip}
    <div class="bot"><div class="k">${o.count ? 'Total' : 'Balance'}${o.note ? ` · ${esc(o.note)}` : ''}</div><div class="m ${bal < 0 ? 'neg' : ''}">${money(bal, cur)}</div></div></div>`;
}
// Several accounts at one bank (Wise PHP/USD/CAD) show as one card; tap it to see each one.
function walletItems(list) {
  const out = [], seen = {};
  for (const a of list) {
    if (a.bank && a.bank !== 'other' && list.filter(x => x.bank === a.bank).length > 1) {
      if (seen[a.bank]) { seen[a.bank].accs.push(a); continue; }
      seen[a.bank] = { key: 'g:' + a.bank, bank: a.bank, accs: [a] }; out.push(seen[a.bank]);
    } else out.push({ key: a.id, accs: [a] });
  }
  return out;
}
function groupTotal(accs, b) {        // in pesos; accounts without a rate are left out and noted
  let t = 0, missing = 0; for (const a of accs) { const r = rate(a.currency); if (r == null) { if (Math.abs(b[a.id]) > 0.004) missing++; continue; } t += b[a.id] * r; }
  return { t, missing };
}
function walletCard(it, b) {
  if (it.accs.length === 1) return bankCard(it.accs[0], b[it.accs[0].id]);
  const lead = it.accs.find(a => a.currency === 'PHP') || it.accs[0], g = groupTotal(it.accs, b);
  return bankCard(lead, g.t, { id: it.key, cur: 'PHP', count: it.accs.length, note: g.missing ? 'some not counted' : '' });
}
const itemValue = (it, b) => groupTotal(it.accs, b).t;
// Wallet stack on phone Home: swipe the front card to send it to the back, tap a peeking card to bring it forward.
function stackOrder(items) {
  let ord = []; try { ord = JSON.parse(localStorage.getItem('scry-stack') || '[]'); } catch { /* fresh order */ }
  const pos = k => ord.indexOf(k);
  // unknown cards keep their natural place (biggest balance in front); remembered ones follow the saved order
  return items.slice().sort((x, y) => { const px = pos(x.key), py = pos(y.key); return px < 0 || py < 0 ? 0 : px - py; });
}
function saveStack() { try { localStorage.setItem('scry-stack', JSON.stringify([...document.querySelectorAll('#wstack .bcard')].map(c => c.dataset.id))); } catch { /* per-browser nicety only */ } }
function stackFront(card) {               // move this card to the front (end of the list)
  const st = card.parentElement; st.appendChild(card); card.classList.remove('cin'); void card.offsetWidth; card.classList.add('cin'); saveStack();
}
function stackSendBack(card) {            // send the front card to the back (start of the list)
  const st = card.parentElement; card.style.transition = ''; card.style.transform = ''; card.style.opacity = '';
  st.insertBefore(card, st.firstElementChild); card.classList.remove('cin');
  const f = st.lastElementChild; f.classList.remove('cin'); void f.offsetWidth; f.classList.add('cin'); saveStack();
}
let drag = null;
// Light flick up (or sideways) on the front card sends it to the back. Speed counts, not just distance.
document.addEventListener('pointerdown', ev => {
  const card = ev.target.closest('#wstack .bcard'); if (!card || card !== card.parentElement.lastElementChild || card.parentElement.children.length < 2) return;
  drag = { card, x: ev.clientX, y: ev.clientY, dx: 0, dy: 0, moved: false, id: ev.pointerId, pts: [[ev.clientX, ev.clientY, performance.now()]] };
});
document.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 6) return;
    if (dy > Math.abs(dx)) { drag = null; return; }              // pulling down = let the page scroll
    drag.moved = true; try { drag.card.setPointerCapture(ev.pointerId); } catch { /* synthetic or lost pointer */ } drag.card.style.transition = 'none';
  }
  drag.dx = dx; drag.dy = Math.min(dy, 12);
  drag.pts.push([ev.clientX, ev.clientY, performance.now()]); if (drag.pts.length > 5) drag.pts.shift();
  drag.card.style.transform = `translate(${dx * .9}px, ${drag.dy}px) rotate(${dx / 30}deg)`;
  ev.preventDefault();
}, { passive: false });
function endDrag() {
  if (!drag) return; const { card, dx, dy, moved, pts } = drag; drag = null;
  if (!moved) return;
  window.__justDragged = true; setTimeout(() => { window.__justDragged = false; }, 80);
  const [x0, y0, t0] = pts[0], [x1, y1, t1] = pts[pts.length - 1], dt = Math.max(t1 - t0, 1);
  const vx = (x1 - x0) / dt, vy = (y1 - y0) / dt;                // px per ms
  const up = dy < -35 || vy < -0.35, side = Math.abs(dx) > 70 || Math.abs(vx) > 0.45;
  if (up || side) {
    card.style.transition = 'transform .24s cubic-bezier(.3,.7,.4,1), opacity .24s';
    card.style.transform = up && !(Math.abs(dx) > Math.abs(dy) * 1.2)
      ? `translateY(-75%) scale(.94) rotate(${dx / 40}deg)`
      : `translateX(${dx > 0 ? 125 : -125}%) rotate(${dx > 0 ? 10 : -10}deg)`;
    card.style.opacity = '0';
    setTimeout(() => stackSendBack(card), 230);
  } else { card.style.transition = 'transform .3s cubic-bezier(.2,.9,.25,1.15)'; card.style.transform = ''; }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// Open the bank's own app (Android package IDs checked on Google Play, Nov 21 2026).
// On Android this launches the app, or opens its Play Store page if it isn't installed. On a PC only Wise has a website.
const BANK_APP = {
  gcash: { pkg: 'com.globe.gcash.android', name: 'GCash' },
  maribank: { pkg: 'ph.seabank.seabank', name: 'MariBank' },
  gotyme: { pkg: 'ph.com.gotyme', name: 'GoTyme' },
  wise: { pkg: 'com.transferwise.android', name: 'Wise', web: 'https://wise.com/home' },
};
const isAndroid = () => /Android/i.test(navigator.userAgent);
function bankAppLink(bank) {
  const app = BANK_APP[bank]; if (!app) return null;
  if (isAndroid()) {
    const store = encodeURIComponent(`https://play.google.com/store/apps/details?id=${app.pkg}`);
    return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${app.pkg};S.browser_fallback_url=${store};end`;
  }
  return app.web || null;
}
function openAppBtn(bank) {
  const href = bankAppLink(bank); if (!href) return '';
  return `<a class="ash-open" href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${IC('external-link', 'sm')} Open ${esc(BANK_APP[bank].name)}${isAndroid() ? ' app' : ''}</a>`;
}

// Account sheet (tap a card): the bank's own colour, big balance, its transactions, and add buttons for this account.
const SHEET_TONE = { wise: 'wise', gotyme: 'gotyme', gcash: 'gcash', maribank: 'maribank', cash: 'cash' };
function sheet(tone, body, foot = '') {
  lastFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="scrim" data-a="closeScrim"><div class="modal asheet" data-tone="${tone}" role="dialog" aria-modal="true">${body}${foot ? `<div class="asheet-foot">${foot}</div>` : ''}</div></div>`;
  drawIcons();
}
function acctTxRow(t, a) {
  const c = cat(t.category_id), cur = curOf(a.id);
  let title, amt, cls, ico;
  if (t.kind === 'transfer') {
    const out = t.account_id === a.id, other = acc(out ? t.to_account_id : t.account_id);
    title = isAdj(t) ? ADJ : `Transfer ${out ? 'to' : 'from'} ${other?.name || '?'}`; ico = IC(out ? 'arrow-up-right' : 'arrow-down-left', 'sm');
    const v = out ? num(t.amount) : (t.to_amount != null ? num(t.to_amount) : num(t.amount));
    amt = (out ? '−' : '+') + money(v, cur); cls = out ? '' : 'pos';
  } else {
    title = isAdj(t) ? ADJ : (t.note || c?.name || (t.kind === 'income' ? 'Income' : 'Expense'));
    ico = isAdj(t) ? IC('scale', 'sm') : t.kind === 'income' ? IC('banknote', 'sm') : (c?.icon ? esc(c.icon) : IC('receipt', 'sm'));
    amt = (t.kind === 'income' ? '+' : '−') + money(num(t.amount), cur); cls = t.kind === 'income' ? 'pos' : 'neg';
  }
  return `<button class="atx" data-a="editTx" data-id="${t.id}"><span class="ic">${ico}</span><span class="main"><b>${esc(title)}</b><small>${longDay(t.date)}</small></span><span class="amt ${cls}">${amt}</span>${IC('chevron-right', 'sm')}</button>`;
}
function acctMenu(id, all = false) {
  const a = acc(id), bal = balances()[a.id], tone = SHEET_TONE[a.bank || (a.type === 'cash' ? 'cash' : '')] || 'other';
  const txs = S.d.transactions.filter(t => t.account_id === a.id || t.to_account_id === a.id)
    .sort((x, y) => y.date.localeCompare(x.date) || (y.created_at || '').localeCompare(x.created_at || ''));
  const shown = all ? txs : txs.slice(0, 6);
  sheet(tone, `<div class="ash-top"><button class="ash-btn" data-a="close" aria-label="Close">${IC('x')}</button><span class="grow"></span>
      <button class="ash-btn" data-a="sheetHide" data-id="${a.id}" aria-label="Hide or show amounts">${IC(S.settings.hideAmounts ? 'eye-off' : 'eye')}</button>
      <button class="ash-btn" data-a="matchAccount" data-id="${a.id}" aria-label="Match to your bank app">${IC('scale')}</button>
      <button class="ash-btn" data-a="editAccount" data-id="${a.id}" aria-label="Edit account">${IC('pencil')}</button></div>
    <div class="ash-head"><h2>${esc(a.name)}</h2><div class="cap">${esc(ACCOUNT_TYPES[a.type]?.[0] || a.type)} · ${esc(a.currency)}</div></div>
    <div class="ash-bal"><div class="cap">${isIOU(a) ? (bal < 0 ? 'You owe' : 'Owes you') : 'Current balance'}</div><div class="v ${bal < 0 && !isIOU(a) ? 'neg' : ''}">${money(isIOU(a) ? Math.abs(bal) : bal, a.currency)}</div><div class="ash-match">${matchedLabel(a.id)}</div>${openAppBtn(a.bank)}</div>
    ${a.type !== 'cash' ? `<section class="ash-qr" id="qrBox" data-id="${a.id}"><div class="ash-ch"><b class="cap">Receive money</b></div><div class="qr-body"><span class="spin sm"></span></div></section>` : ''}
    <section class="ash-card"><div class="ash-ch"><b class="cap">Transactions</b><span class="grow"></span><span class="xs">${txs.length}</span></div>
      ${shown.length ? shown.map(t => acctTxRow(t, a)).join('') : '<div class="ash-empty">Nothing here yet.</div>'}
      ${!all && txs.length > 6 ? `<button class="ash-more" data-a="sheetAll" data-id="${a.id}">See all ${txs.length} ${IC('chevron-down', 'sm')}</button>` : ''}</section>`,
    `<button class="ash-add out" data-a="sheetAdd" data-k="expense" data-id="${a.id}">${IC('plus', 'sm')} Expense</button>
     <button class="ash-add tr" data-a="sheetAdd" data-k="transfer" data-id="${a.id}">${IC('arrow-left-right', 'sm')} Transfer</button>
     <button class="ash-add in" data-a="sheetAdd" data-k="income" data-id="${a.id}">${IC('plus', 'sm')} Income</button>`);
  if (a.type !== 'cash') loadQR(a.id);
}
// Receive QR: kept privately in Blu's Supabase (function "qr"), cached in this browser for speed.
const qrCache = {};
const qrLocal = id => { try { return localStorage.getItem('scry-qr-' + id); } catch { return null; } };
async function loadQR(id) {
  if (isDemo()) return paintQR(id, null);
  if (qrCache[id] !== undefined) return paintQR(id, qrCache[id]);
  const cached = qrLocal(id); if (cached) paintQR(id, cached);
  try {
    const { data } = await S.sb.functions.invoke('qr', { body: { action: 'get', account_id: id } });
    qrCache[id] = data?.image || null;
    try { qrCache[id] ? localStorage.setItem('scry-qr-' + id, qrCache[id]) : localStorage.removeItem('scry-qr-' + id); } catch { /* cache only */ }
  } catch { qrCache[id] = cached || null; }
  paintQR(id, qrCache[id]);
}
function paintQR(id, b64) {
  const box = $('#qrBox'); if (!box || box.dataset.id !== id) return;
  box.querySelector('.qr-body').innerHTML = b64
    ? `<button class="qr-thumb" data-a="qrShow" data-id="${id}" aria-label="Show this QR full screen"><img src="data:image/png;base64,${b64}" alt="Receive QR"></button>
       <div class="qr-side"><b>Ready to scan</b><small>Tap the code to show it full screen.</small>
       <div class="qr-acts"><button class="qr-mini" data-a="qrPick" data-id="${id}">${IC('refresh-cw', 'sm')} Replace</button><button class="qr-mini" data-a="qrDel" data-id="${id}">${IC('trash-2', 'sm')} Remove</button></div></div>`
    : isDemo() ? '<div class="qr-empty">Receive QR works once you\'re signed in.</div>'
    : `<div class="qr-empty"><b>No receive QR added yet.</b><small>Save the code from your bank app to show when someone pays you.</small>
       <button class="qr-add" data-a="qrPick" data-id="${id}">${IC('plus', 'sm')} Add receive QR</button></div>`;
  drawIcons();
}
async function qrToPng(file) {                   // keep it crisp: PNG, longest side at most 900px
  const bmp = await createImageBitmap(file), k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/png').split(',')[1];
}
function qrPick(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const box = $('#qrBox'); if (box) box.querySelector('.qr-body').innerHTML = '<span class="spin sm"></span> Saving…';
    try {
      const image = await qrToPng(f);
      const { data, error } = await S.sb.functions.invoke('qr', { body: { action: 'put', account_id: id, image } });
      if (error || !data?.ok) { let m; try { m = (await error?.context?.json?.())?.error; } catch { /* none */ } throw new Error(m || 'Could not save it'); }
      qrCache[id] = image; try { localStorage.setItem('scry-qr-' + id, image); } catch { /* cache only */ }
      paintQR(id, image); toast('Receive QR saved');
    } catch (e) { toast(e.message || 'Could not save it'); paintQR(id, qrCache[id] || null); }
  };
  inp.click();
}
async function qrDel(id) {
  if (!confirm('Remove this receive QR?')) return;
  try { await S.sb.functions.invoke('qr', { body: { action: 'del', account_id: id } }); } catch { /* try anyway */ }
  qrCache[id] = null; try { localStorage.removeItem('scry-qr-' + id); } catch { /* cache only */ }
  paintQR(id, null); toast('Removed');
}
function qrShow(id) {
  const a = acc(id), b64 = qrCache[id] || qrLocal(id); if (!b64) return;
  const back = document.createElement('div'); back.className = 'qr-full'; back.dataset.a = 'qrClose';
  back.innerHTML = `<div class="qr-card"><div class="qr-title">${esc(a.name)}</div><img src="data:image/png;base64,${b64}" alt="Receive QR for ${esc(a.name)}"><div class="qr-hint">Scan to send money to Blu</div></div><div class="qr-close">Tap anywhere to close</div>`;
  document.body.appendChild(back);
}
function groupMenu(bank) {
  const b = balances(), accs = activeAccounts().filter(a => a.bank === bank), g = groupTotal(accs, b);
  sheet(SHEET_TONE[bank] || 'other', `<div class="ash-top"><button class="ash-btn" data-a="close" aria-label="Close">${IC('x')}</button></div>
    <div class="ash-head"><h2>${esc(BANKS[bank]?.name || 'Accounts')}</h2><div class="cap">${accs.length} accounts</div></div>
    <div class="ash-bal"><div class="cap">Total in pesos</div><div class="v">${money(g.t)}</div>${g.missing ? '<div class="ash-match">Some currencies have no rate yet</div>' : ''}${openAppBtn(bank)}</div>
    <section class="ash-card">${accs.map(a => `<button class="atx" data-a="openAcct" data-id="${a.id}"><span class="ic cur">${esc(a.currency)}</span><span class="main"><b>${esc(a.name)}</b><small>${matchedLabel(a.id)}</small></span><span class="amt">${money(b[a.id], a.currency)}</span>${IC('chevron-right', 'sm')}</button>`).join('')}</section>
    ${accs.some(a => rate(a.currency) == null) ? `<div class="ash-match" style="margin-top:12px">${accs.filter(a => rate(a.currency) == null).map(a => a.currency).join(', ')} not in the total yet · <a href="#settings" data-a="close">set the rate</a></div>` : ''}`);
}

// Safe to spend: money he has, minus every bill due before his next payday (overdue ones included).
function safeToSpend() {
  const w = worth(), t = today();
  const nextInc = upcomingIncome(90).find(o => !o.late && o.date > t);
  const until = nextInc?.date || addDays(t, 14);
  const due = [];
  for (const bl of S.d.bills.filter(x => x.active)) {
    if (bl.due_date < t) due.push({ bill: bl, date: bl.due_date, late: true });
    else for (const d of occurrences(bl, t, addDays(until, -1))) due.push({ bill: bl, date: d, late: false });
  }
  due.sort((x, y) => x.date.localeCompare(y.date));
  const owed = due.reduce((s, o) => s + num(o.bill.amount), 0);
  return { have: w.own, owed, safe: w.own - owed, until, payer: nextInc?.inc?.name || null, due };
}
function safeRow() {
  const s = safeToSpend();
  return `<button class="safe ${s.safe < 0 ? 'neg' : ''}" data-a="safeInfo"><span class="sl">Safe to spend until ${esc(shortDate(s.until))}</span><b>${money(s.safe)}</b>${IC('chevron-right', 'sm')}</button>`;
}
// Payday: a paycheck from one of his income sources landed in the last 3 days and has no plan yet.
function freshPay() {
  const done = S.settings.planDone || {}, since = addDays(today(), -3);
  for (const t of S.d.transactions.filter(t => t.kind === 'income' && t.date >= since && !done[t.id]).sort((x, y) => y.date.localeCompare(x.date))) {
    const src = incomes().find(i => norm(i.name) === norm(t.note) || payerName(t.note) === i.name || norm(t.note).includes(norm(i.name).split(' ')[0]));
    if (src) return { t, src };
  }
  return null;
}
function paydayCard() {
  const p = freshPay(); if (!p) return '';
  const a = acc(p.t.account_id);
  return `<section class="card payday c12" style="--o:2"><span class="pd-ic">${IC('party-popper')}</span><div class="main"><b>${esc(p.src.name)} pay landed: ${money(num(p.t.amount), a?.currency || 'PHP')}</b><small>Into ${esc(a?.name || '?')} on ${esc(shortDate(p.t.date))}. Penny can plan where it goes before your next payday.</small></div>
    <button class="btn pri" data-a="paydayPlan" data-id="${p.t.id}">${IC('sparkles', 'sm')} Plan my payday</button><button class="rbtn" data-a="paydaySkip" data-id="${p.t.id}" aria-label="Not now">${IC('x', 'sm')}</button></section>`;
}

function vHome() {
  const w = worth(), mt = monthTotals(thisMonth()), up = upcoming(45), b = balances();
  const nm = String(S.user?.user_metadata?.own_names || '').split(',')[0].trim().split(' ')[0] || 'Blu';
  const hidden = !!S.settings.hideAmounts;
  const whole = hidden ? money(w.own) : money(w.own).replace(/\.\d\d$/, ''), cents = hidden ? '' : money(w.own).slice(-3);   // Total balance = money he has; debts shown below it
  const accAll = activeAccounts().filter(a => !isIOU(a)).sort((x, y) => (b[x.id] * (rate(x.currency) ?? 0)) - (b[y.id] * (rate(y.currency) ?? 0)));
  const ious = iouList(b), unpaid = unpaidBills(b);
  const accs = accAll.some(a => Math.abs(b[a.id]) > 0.004) ? accAll.filter(a => Math.abs(b[a.id]) > 0.004) : accAll;   // smallest first, biggest in front
  const funded = it => it.accs.some(a => Math.abs(b[a.id]) > 0.004);
  const allItems = walletItems(accAll).sort((x, y) => itemValue(x, b) - itemValue(y, b));
  const homeItems = allItems.some(funded) ? allItems.filter(funded) : allItems;      // smallest first, biggest in front
  const recent = S.d.transactions.filter(tagOK).sort((x, y) => y.date.localeCompare(x.date) || (y.created_at || '').localeCompare(x.created_at || '')).slice(0, 4);
  const mtx = txInMonth(thisMonth()).filter(tagOK), nIn = mtx.filter(t => t.kind === 'income').length, nOut = mtx.filter(t => t.kind === 'expense').length;
  const tot = mt.inc + mt.out, pIn = tot ? Math.round(mt.inc / tot * 100) : 0, pOut = tot ? 100 - pIn : 0;
  const nBud = S.d.budgets.filter(x => x.month.startsWith(thisMonth()) && num(x.amount) > 0).length;
  const quick = topCats('expense', 4);
  const plural = (n, w1) => `${n} ${w1}${n === 1 ? '' : 's'}`;
  return `<div class="hello only-desk"><div class="hi cap">${new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</div><div class="nm">Hello, ${esc(nm)}!</div></div>`
  + (isDemo() && !S.settings.hideBanner ? `<div class="demo-banner" role="note"><span><b>You're looking at demo data.</b> Every number and notification here is a made-up sample, stored only in this browser.</span><button data-a="hideBanner" aria-label="Hide this note">${IC('x', 'sm')}</button></div>` : '')
  + `<div class="hg">
    <section class="card hero balance lux c7" style="--o:1"><span class="lux-guil" aria-hidden="true"></span><span class="lux-sheen" aria-hidden="true"></span><img class="lux-mark" src="brand/scry-mark.svg" alt="">
      <div class="bh"><span class="cap k">Total balance</span><span class="grow"></span>
        <button class="eye" data-a="toggleHide" aria-label="${hidden ? 'Show amounts' : 'Hide amounts'}" aria-pressed="${hidden}">${IC(hidden ? 'eye-off' : 'eye', 'sm')}</button></div>
      <div class="v">${whole}<small>${cents}</small></div>
      <div class="bmeta">${w.owe < 0 ? `<span class="owe">${IC('trending-down', 'sm')} You owe ${money(-w.owe)}</span>` : `<span class="ok">${IC('shield-check', 'sm')} Nothing owed</span>`}${w.owed > 0 ? `<span class="dot">·</span><span class="owed">Owed to you ${money(w.owed)}</span>` : ''}${w.owe < 0 || w.owed > 0 ? `<span class="dot">·</span><span>Net worth ${money(w.net)}</span>` : ''}${w.missing.length ? `<span class="dot">·</span><span>Excludes ${w.missing.join(', ')}</span><span class="dot">·</span><a href="#settings">set rate</a>` : ''}</div>
      ${safeRow()}
      <div class="bscope">${tagChips()}</div>
      <div class="hq only-desk"><button class="btn pri" data-a="addTx">${IC('plus', 'sm')} Add</button><button class="btn" data-a="scan">${IC('scan-line', 'sm')} Scan</button><button class="btn" data-a="addTransfer">${IC('arrow-left-right', 'sm')} Transfer</button><a class="btn" href="#bills">${IC('receipt', 'sm')} Pay bill</a></div>
    </section>
    <section class="card summ2 c5" style="--o:5">
      <div class="sh"><b class="cap">Summary</b><span class="grow"></span><span class="pill">${monthName(thisMonth()).split(' ')[0]}</span></div>
      <div class="s2-net"><div class="cap">Net cash flow</div><div class="v ${mt.left < 0 ? 'neg' : ''}">${mt.left > 0 ? '+' : ''}${money(mt.left)}</div></div>
      ${(() => { const cbc = catsOf('income').find(c => norm(c.name) === 'cashback'); const v = cbc ? txInMonth(thisMonth()).filter(t => t.category_id === cbc.id).reduce((x, t) => x + toPHP(num(t.amount), t.account_id), 0) : 0;
        const fc = catsOf('expense').find(c => norm(c.name) === 'fees'); const f = fc ? txInMonth(thisMonth()).filter(t => t.category_id === fc.id).reduce((x, t) => x + toPHP(num(t.amount), t.account_id), 0) : 0;
        return v || f ? `<div class="s2-extra">${v ? `<span>🎁 Cashback <b>${money(v)}</b></span>` : ''}${f ? `<span>🧾 Fees <b>${money(f)}</b></span>` : ''}</div>` : ''; })()}
      <div class="s2-bar" aria-hidden="true"><i class="in" style="flex:${tot ? mt.inc : 1}"></i><i class="out" style="flex:${tot ? mt.out : 1}"></i></div>
      <div class="s2-row">
        <a class="s2 in" href="#tx"><span class="ic">${IC('arrow-down-left', 'sm')}</span><span class="k">Income</span><b>${money(mt.inc)}</b><small>${plural(nIn, 'transaction')}${tot ? ` · ${pIn}%` : ''}</small></a>
        <a class="s2 out" href="#tx"><span class="ic">${IC('arrow-up-right', 'sm')}</span><span class="k">Spent</span><b>${money(mt.out)}</b><small>${plural(nOut, 'transaction')}${tot ? ` · ${pOut}%` : ''}</small></a>
      </div>
    </section>
    ${newInbox().length ? `<div class="only-phone c12" style="--o:2">${reviewStrip()}</div><div class="only-desk c12">${tray(4)}</div>` : ''}
    <div class="c12 only-phone" style="--o:3">
      <div class="wstack" id="wstack">${stackOrder(homeItems).map(it => walletCard(it, b)).join('')}</div>
      <a class="wlink" href="#accounts">${accAll.length} account${accAll.length === 1 ? '' : 's'} in your wallet ${IC('chevron-right', 'sm')}</a>
    </div>
    <div class="c12 only-desk"><div class="sechead"><b class="cap">Wallet</b><a href="#accounts">See all</a></div>
      <div class="cardgrid" style="grid-template-columns:repeat(${cardCols(homeItems.length)},minmax(0,1fr))">${homeItems.slice().reverse().map(it => walletCard(it, b)).join('')}</div></div>
    ${paydayCard()}
    ${unpaid.count && ious.count ? `<div class="c6" style="--o:4">${unpaid.card}</div><div class="c6" style="--o:4"><section class="card iou-card"><div class="sh"><b class="cap">IOUs</b><span class="grow"></span><span class="xs faint">People</span></div>${ious.html}</section></div>`
      : unpaid.count ? `<div class="c12" style="--o:4">${unpaid.card}</div>`
      : ious.count ? `<section class="card iou-card c12" style="--o:4"><div class="sh"><b class="cap">IOUs</b><span class="grow"></span><span class="xs faint">People</span></div>${ious.html}</section>` : ''}
    ${quick.length ? `<div class="qcats c12" style="--o:4">${quick.map(c => `<button data-a="quickCat" data-id="${c.id}"><span>${IC(catLucide(c))}</span><b>${esc(c.name.split(/[ &]/)[0])}</b></button>`).join('')}</div>` : ''}
    <a class="rowlink c12" style="--o:6" href="#budget"><span><b>${nBud ? 'Budgets' : 'Set budgets'}</b>${nBud ? `<small>${nBud} set for ${monthName(thisMonth()).split(' ')[0]}</small>` : '<small>Give every peso a job</small>'}</span>${IC('chevron-right')}</a>
    <div class="${recent.length ? 'c6' : 'c12'}" style="--o:7"><section class="card"><div class="sh"><b class="cap">Upcoming</b><span class="grow"></span><a href="#bills" class="xs">All bills</a></div>
      ${(() => { const both = [...upcomingIncome(45).map(o => ({ ...o, k: 'inc' })), ...up.map(o => ({ ...o, k: 'bill' }))].sort((x, y) => x.date.localeCompare(y.date)).slice(0, 5);
        return both.length ? `<div class="list">${both.map(o => o.k === 'inc' ? incomeRow(o, o.first) : billRow(o)).join('')}</div>` : '<div class="empty1">Nothing due or coming in for 45 days.</div>'; })()}</section></div>
    ${recent.length ? `<div class="c6" style="--o:8"><section class="card"><div class="sh"><b class="cap">Recent</b><span class="grow"></span><a href="#tx" class="xs">See all</a></div><div class="list">${recent.map(txRow).join('')}</div></section></div>` : ''}
  </div>`;
}
// Net worth (PHP) at the end of each of the last N days, rebuilt backwards from today's balance.
function worthSeries(days) {
  const delta = {};
  for (const t of S.d.transactions) {
    const v = t.kind === 'income' ? toPHP(num(t.amount), t.account_id)
      : t.kind === 'expense' ? -toPHP(num(t.amount), t.account_id)
      : (t.to_account_id ? toPHP(t.to_amount != null ? num(t.to_amount) : num(t.amount), t.to_account_id) : 0) - toPHP(num(t.amount), t.account_id);
    delta[t.date] = (delta[t.date] || 0) + v;
  }
  const out = []; let w = worth().net;
  for (let i = 0; i < days; i++) { out.unshift(w); w -= delta[addDays(today(), -i)] || 0; }
  return out;
}
function sparkline(pts) {
  const W = 320, H = 54, min = Math.min(...pts), max = Math.max(...pts), span = max - min;
  const y = v => span ? (H - 6 - ((v - min) / span) * (H - 14)).toFixed(1) : (H / 2).toFixed(1);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * W).toFixed(1)} ${y(v)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Balance over the last 30 days"><defs><linearGradient id="spk" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#F2C57C"/><stop offset="1" stop-color="#3FE0C2"/></linearGradient><linearGradient id="spf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3FE0C2" stop-opacity=".18"/><stop offset="1" stop-color="#3FE0C2" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W} ${H} L0 ${H} Z" fill="url(#spf)" stroke="none"/><path d="${d}" fill="none" stroke="url(#spk)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function filteredTx() {
  const q = norm(S.f.q);
  return S.d.transactions.filter(t => t.date.startsWith(S.month) && tagOK(t)
    && (!S.f.account || t.account_id === S.f.account || t.to_account_id === S.f.account)
    && (!S.f.category || t.category_id === S.f.category)
    && (!q || norm(`${t.note} ${cat(t.category_id)?.name} ${acc(t.account_id)?.name}`).includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''));
}
function vTx() {
  const list = filteredTx(), days = {}, mt = monthTotals(S.month);
  for (const t of list) (days[t.date] ||= []).push(t);
  const filtered = S.f.account || S.f.category || S.f.q;
  return ph('Activity', 'Transactions', `${money(mt.inc)} in · ${money(mt.out)} out in ${monthName(S.month)}`,
    `${monthNav()}<button class="btn" data-a="scan">${IC('scan-line', 'sm')} Scan</button><button class="btn" data-a="import">${IC('upload', 'sm')} Import statement</button><button class="btn ghost" data-a="exportCsv">Export</button>`)
  + tray(50)
  + `<div class="toolbar"><label class="search"><span class="sr">Search</span><input placeholder="Search notes, categories, accounts" value="${esc(S.f.q)}" data-c="fq"></label>
    <select data-c="faccount" aria-label="Account"><option value="">All accounts</option>${activeAccounts().map(a => `<option value="${a.id}" ${S.f.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    <select data-c="fcategory" aria-label="Category"><option value="">All categories</option>${S.d.categories.filter(c => !c.archived).map(c => `<option value="${c.id}" ${S.f.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    ${tagChips()}${filtered ? '<button class="btn ghost sm" data-a="clearFilters">Clear filters</button>' : ''}</div>
  <section class="card">${Object.keys(days).length ? Object.entries(days).map(([d, ts]) => {
    const net = ts.reduce((s, t) => s + (t.kind === 'income' ? 1 : t.kind === 'expense' ? -1 : 0) * toPHP(num(t.amount), t.account_id), 0);
    return `<div class="day"><span>${longDay(d)}</span><span class="mono ${net > 0 ? 'pos' : ''}">${signed(net)}</span></div><div class="list">${ts.map(txRow).join('')}</div>`;
  }).join('') : `<div class="empty">${filtered ? 'Nothing matches these filters.' : 'No transactions this month.'}</div>`}</section>`;
}

function vBudget() {
  const mk = S.month, spent = spentByCat(mk, false), cats = catsOf('expense');
  let inc = 0; for (const t of txInMonth(mk)) if (t.kind === 'income') inc += toPHP(num(t.amount), t.account_id);
  const budgeted = cats.reduce((s, c) => s + num(budgetFor(mk, c.id)?.amount), 0);
  const totalSpent = Object.values(spent).reduce((s, v) => s + v, 0);
  const ready = inc - budgeted, cls = Math.abs(ready) < 0.005 ? 'zero' : ready > 0 ? 'ok' : 'over';
  let on = 0, near = 0, over = 0;
  for (const c of cats) { const bud = num(budgetFor(mk, c.id)?.amount); if (!bud) continue; const p = (spent[c.id] || 0) / bud; if (p > 1) over++; else if (p > .8) near++; else on++; }
  return ph('Budgets', 'Give every peso a job', null, `${monthNav()}<button class="btn" data-a="copyBudget">Copy last month</button>`)
  + `<div class="assign ${cls}"><div><div class="lbl">${ready >= 0 ? 'Ready to assign' : 'Assigned more than you earned'}</div><div class="big">${money(ready)}</div>
      <div class="xs muted" style="margin-top:4px">Income ${money(inc)} · Budgeted ${money(budgeted)} · Spent ${money(totalSpent)}</div></div>
    <div class="status-pills"><span class="badge ok">${on} on track</span><span class="badge db">${near} close</span><span class="badge risk">${over} over</span></div></div>
  <section class="card"><div class="bud head"><span>Category</span><span style="text-align:right">Budget</span><span class="h3">Spent</span><span class="h4" style="text-align:right">Left</span></div>
  ${cats.map(c => {
    const bud = num(budgetFor(mk, c.id)?.amount), sp = spent[c.id] || 0, left = bud - sp, p = bud ? sp / bud : (sp ? 1.01 : 0);
    return `<div class="bud"><span class="cn"><span class="ico" style="width:32px;height:32px;font-size:15px">${catIcon(c)}</span><span>${esc(c.name)}</span></span>
      <input inputmode="decimal" value="${bud ? bud.toFixed(2) : ''}" placeholder="0.00" data-c="budget" data-id="${c.id}" aria-label="Budget for ${esc(c.name)}">
      <div class="spentcol"><div class="bar"><i class="${p > 1 ? 'over' : p > .8 ? 'warn' : ''}" style="width:${Math.min(100, p * 100)}%"></i></div></div>
      <span class="left ${left < 0 ? 'neg' : 'muted'}">${bud || sp ? `${money(sp)} spent · ${left < 0 ? money(-left) + ' over' : money(left) + ' left'}` : '<span class="faint">Not budgeted</span>'}</span></div>`;
  }).join('')}</section>`;
}

function vBills() {
  const t = today(), all = activeBills(), late = [], soon = [], later = [];
  for (const b of all) { const o = { bill: b, date: b.due_date, late: b.due_date < t }; (o.late ? late : daysBetween(t, b.due_date) <= 7 ? soon : later).push(o); }
  const sum = arr => arr.reduce((s, o) => s + num(o.bill.amount), 0);
  const group = (title, arr) => arr.length ? `<div class="day"><span>${title}</span><span class="mono">${money(sum(arr))}</span></div><div class="list">${arr.sort((x, y) => x.date.localeCompare(y.date)).map(o => billRow(o)).join('')}</div>` : '';
  const paused = S.d.bills.filter(b => !b.active && (S.tag === 'all' || b.tag === S.tag));
  const head = ph('Bills', 'Bills & subscriptions', null,
    `${tagChips()}<div class="chips" role="group" aria-label="View"><button class="${S.billView === 'list' ? 'on' : ''}" data-a="billView" data-v="list">List</button><button class="${S.billView === 'cal' ? 'on' : ''}" data-a="billView" data-v="cal">Calendar</button></div><button class="btn" data-a="scan">${IC('scan-line', 'sm')} Scan a bill</button><button class="btn pri" data-a="addBill">+ Add bill</button>`)
  + `<section class="card mb"><div class="trio">
      <div><div class="lbl">Overdue</div><div class="mid ${late.length ? 'neg' : ''}">${money(sum(late))}</div><div class="xs faint">${late.length} bill${late.length === 1 ? '' : 's'}</div></div>
      <div><div class="lbl">Next 7 days</div><div class="mid warn">${money(sum(soon))}</div><div class="xs faint">${soon.length} bill${soon.length === 1 ? '' : 's'}</div></div>
      <div><div class="lbl">Per month</div><div class="mid">${money(billsPerMonth())}</div><div class="xs faint">all repeating bills</div></div></div></section>`;
  if (S.billView === 'cal') return head + calendar();
  const inc = upcomingIncome(45), srcs = incomes();
  const incCard = `<section class="card mb inc-card"><h2>Income coming in <small><button class="btn sm" data-a="addIncome">${IC('plus', 'sm')} Add income</button></small></h2>
    ${srcs.length ? `<div class="list">${inc.slice(0, 6).map(o => incomeRow(o, o.first)).join('') || '<div class="empty1">No paydays in the next 45 days.</div>'}</div>
      <div class="xs faint" style="margin-top:8px">About ${money(incomePerMonth())} a month from ${srcs.length} source${srcs.length === 1 ? '' : 's'}${srcs.some(x => !num(x.amount) && !incAvg(x)) ? ' (pay that varies counts once you have logged a payday)' : ''}</div>`
      : '<div class="empty1">Add GOOD Hoops, Intelocate and any other pay so Scry knows when money is coming in.</div>'}
    ${srcs.some(x => /good ?hoops/i.test(x.name)) ? '' : `<button class="inc-suggest" data-a="suggestGoodHoops">${IC('sparkles', 'sm')}<span><b>Add your GOOD Hoops pay</b><small>US$8/hr · hours vary · every 2 weeks · into Wise USD · next Dec 5</small></span>${IC('chevron-right', 'sm')}</button>`}
    ${srcs.some(x => /intelocate|summit/i.test(x.name)) ? '' : `<button class="inc-suggest" data-a="suggestIntelocate">${IC('sparkles', 'sm')}<span><b>Add your Intelocate pay</b><small>US$6/hr · 80 hrs every 2 weeks · into Wise USD · next Dec 5</small></span>${IC('chevron-right', 'sm')}</button>`}</section>`;
  const ub = unpaidBills(balances());
  return head + (ub.count ? `<div class="mb">${ub.card}</div>` : '') + incCard + `<section class="card">${group('Overdue', late)}${group('Next 7 days', soon)}${group('Later', later)}${all.length ? '' : '<div class="empty">No bills yet. Add rent, Meralco, internet, subscriptions…</div>'}</section>
    ${paused.length ? `<section class="card" style="margin-top:var(--gap)"><h2>Paid one-offs & paused</h2><div class="list">${paused.map(b => billRow({ bill: b, date: b.due_date }, false)).join('')}</div></section>` : ''}`;
}
function calendar() {
  const mk = S.calMonth, first = parseD(mk + '-01'), start = addDays(mk + '-01', -((first.getDay() + 6) % 7)), t = today(), end = addDays(start, 41), byDay = {};
  for (const b of activeBills()) {
    if (b.due_date < t) { if (b.due_date >= start) (byDay[b.due_date] ||= []).push({ b, late: true }); }
    else for (const d of occurrences(b, start, end)) (byDay[d] ||= []).push({ b });
  }
  for (const tx of S.d.transactions) if (tx.bill_id && tx.date >= start && tx.date <= end) { const b = S.d.bills.find(x => x.id === tx.bill_id); if (b) (byDay[tx.date] ||= []).push({ b, paid: true, amt: num(tx.amount) }); }
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    cells += `<div class="c ${d.slice(0, 7) !== mk ? 'out' : ''} ${d === t ? 'today' : ''}"><div class="n">${parseD(d).getDate()}</div>${(byDay[d] || []).map(x => `<div class="pill ${x.paid ? 'paid' : x.late ? 'late' : x.b.tag === 'daybreak' ? 'db' : ''}" data-a="editBill" data-id="${x.b.id}" title="${esc(x.b.name)} · ${money(x.amt ?? num(x.b.amount))}${x.paid ? ' · paid' : x.late ? ' · overdue' : ''}">${esc(x.b.name)}</div>`).join('')}</div>`;
  }
  return `<section class="card"><div class="row" style="margin-bottom:14px">${monthNav('calMonth')}<span class="grow"></span><span class="xs faint row" style="gap:6px"><span class="badge risk">Overdue</span><span class="badge db">Daybreak</span><span class="badge">Personal</span><span>Crossed out = paid</span></span></div>
    <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div></section>`;
}

function vAccounts() {
  const b = balances(), w = worth();
  const list = activeAccounts().filter(a => !isIOU(a)).sort((x, y) => (b[y.id] * (rate(y.currency) ?? 0)) - (b[x.id] * (rate(x.currency) ?? 0)));
  const ious = iouList(b);
  return ph('Wallet', 'Wallet', 'Tap a card to see its activity or match it to your bank app', '<button class="btn pri" data-a="addAccount">+ Add account</button>')
  + `<section class="card hero networth mb"><div class="bh"><span class="cap k">Total balance</span><span class="grow"></span><button class="eye" data-a="toggleHide" aria-label="Hide or show amounts">${IC(S.settings.hideAmounts ? 'eye-off' : 'eye', 'sm')}</button></div>
    <div class="v">${money(w.own)}</div>
    <div class="nw2 four"><div><span>Net worth</span><b class="${w.net < 0 ? 'neg' : ''}">${money(w.net)}</b></div><button class="nwb" data-a="safeInfo"><span>Safe to spend</span><b class="${safeToSpend().safe < 0 ? 'neg' : ''}">${money(safeToSpend().safe)}</b></button><div><span>I owe</span><b>${money(-w.owe)}</b></div><div><span>Owed to me</span><b>${money(w.owed)}</b></div></div>
    ${w.missing.length ? `<div class="fine">Not counted: ${w.missing.join(', ')} · <a href="#settings">set rate</a></div>` : ''}</section>
  <div class="cardgrid wallet">${walletItems(list).sort((x, y) => itemValue(y, b) - itemValue(x, b)).map(it => walletCard(it, b)).join('')}
    <button class="bcard addcard" data-a="addAccount">${IC('plus', 'lg')}<span>Add account</span></button></div>
  ${unpaidBills(b).count ? `<div style="margin-top:var(--gap)">${unpaidBills(b).card}</div>` : ''}
  ${ious.count ? `<section class="card iou-card wal" style="margin-top:var(--gap)"><div class="sh"><b class="cap">IOUs</b><span class="grow"></span><span class="xs faint">People</span></div>${ious.html}</section>` : ''}`;
}

function vSettings() {
  const supa = !isDemo(), cfg = LS.get('money-cfg', {}) || {}, ks = S.keyStatus;
  const url = supa ? (cfg.url || window.MONEY_CONFIG?.url) : 'https://YOUR-PROJECT.supabase.co';
  const keyLine = !supa ? '<span class="badge">Not available in demo</span>'
    : !ks ? '<span class="badge">No phone key yet</span>'
    : ks.revoked_at ? `<span class="badge risk">Revoked ${esc(timeOf(ks.revoked_at))}</span>`
    : `<span class="badge ok">Active · ends in …${esc(ks.key_hint || '')}</span> <span class="xs faint">made ${esc(timeOf(ks.created_at))} · last used ${ks.last_used_at ? esc(timeOf(ks.last_used_at)) : 'never'}</span>`;
  return ph('Settings', 'Settings', supa ? 'Signed in as ' + esc(S.user?.email) : 'Demo mode · nothing here is connected to anything')
  + `<div class="grid g2">
    <section class="card span2"><h2>Phone link <small>Auto-detect for GCash, MariBank, GoTyme, Wise</small></h2>
      <div class="grid g2" style="gap:18px">
        <div class="stack">
          <div class="row">${keyLine}</div>
          ${supa ? `<div class="row"><button class="btn pri" data-a="makeKey">${ks && !ks.revoked_at ? 'Replace phone key' : 'Create phone key'}</button>${ks && !ks.revoked_at ? '<button class="btn danger" data-a="revokeKey">Revoke key</button>' : ''}</div><div id="keybox"></div>` : '<div class="callout">Setting up the phone link needs your own Supabase project. Nothing is set up yet, and nothing will be until you decide.</div>'}
          <details><summary>MacroDroid setup (on your phone)</summary>
          <ol class="small muted" style="line-height:1.75;padding-left:18px">
            <li>Install <b>MacroDroid</b> from the Play Store, open it, tap <b>Add Macro</b>, name it <b>Scry</b>.</li>
            <li><b>Trigger</b> → Device Events → <b>Notification</b> → <b>Notification Received</b> → <b>Select application(s)</b>: GCash, MariBank, GoTyme, Wise. Allow notification access when Android asks.</li>
            <li><b>Required filter</b>, same screen: text content → <b>Matches</b>, tick <b>Regex</b>, paste:<br><code>(?is)^(?!.*(otp|one.?time|verification|passcode|password|\bpin\b|mpin|do not share)).*(PHP|₱|USD|CAD|SGD|\bP ?[0-9]|bill|due|payment|statement|soa|amount).*$</code><br>Only money and bill notifications without login words ever leave your phone.</li>
            <li><b>Action</b> → Web Interactions → <b>HTTP Request</b>. Method <b>POST</b>. URL: <code>${esc(url)}/functions/v1/ingest</code></li>
            <li><b>Query Params</b> tab, add five: <code>key</code> = your phone key · <code>app</code> = {not_app_name} · <code>pkg</code> = {not_app_package} · <code>title</code> = {not_title} · <code>text</code> = {notification}. Use the magic-text button to insert the {…} items.</li>
            <li>Save. Pay ₱1 with GCash: it should show in <b>To review</b> within a minute.</li>
            <li>Optional check: in the action, <b>Save HTTP return code</b> to a variable. 200 = received, 401 = wrong key.</li>
          </ol></details>
        </div>
        <div class="callout"><b>What leaves your phone:</b> the app name, the notification's title and text, and the phone key, over HTTPS to your Supabase project. Nothing else.<br><br>
          <b>What's dropped before saving:</b> notifications from other apps, ones that look like login or verification codes, and ones without a money amount. This is a pattern check. It catches common code messages but <b>can miss unusual wording</b>, which is why the phone-side filter above matters.<br><br>
          <b>What's saved:</b> a copy with stray 4–8 digit numbers blanked out (•••), and the time. The text is wiped the moment you approve or dismiss it. Reviewed rows are deleted after 7 days, unreviewed ones after 30.<br><br>
          <b>Limits:</b> 60 notifications an hour, 300 waiting. The same text from the same bank on the same day is saved once.<br><br>
          <b>Your choices (Nov 20):</b> sorting happens on the phone first · every item waits for your ✓, nothing is added automatically · Wise uses notifications plus a monthly CSV statement, not the Wise API.</div>
      </div>
      <h3 style="margin:20px 0 6px">Your name on bank alerts</h3>
      <p class="xs faint" style="margin:0 0 8px">When a transfer is to or from one of these names, Scry logs it as a transfer between your own accounts, not spending. Separate with commas.</p>
      <input data-c="ownNames" style="width:100%" placeholder="e.g. Juan Dela Cruz, J. D. Cruz" value="${esc((S.user?.user_metadata?.own_names ?? S.settings.ownNames) || '')}" aria-label="Your names on bank alerts">
      <h3 style="margin:20px 0 8px">Test the filter and reader</h3>
      <p class="xs faint" style="margin:0 0 8px">Runs only in this browser. Shows whether a notification would be kept, what would be stored, and what the reader understands.</p>
      <div class="row"><select id="simApp" aria-label="Bank app">${Object.entries(BANKS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
        <input id="simText" class="grow" placeholder="e.g. You have paid PHP 156.00 to 7-Eleven" style="min-width:220px" aria-label="Notification text">
        <button class="btn" data-a="simulate">Test</button></div>
      <div id="simOut" class="small" style="margin-top:10px" aria-live="polite"></div></section>

    <section class="card span2"><h2>Exchange rates <small>pesos per 1 unit</small></h2>
      <div class="ratesg">${['USD', 'CAD', 'SGD', 'EUR', 'GBP', 'AUD'].map(c => `<div class="row" style="gap:10px;justify-content:space-between"><span class="muted">${c}</span><b>${S.settings.rates[c] ? '₱' + num(S.settings.rates[c]).toFixed(2) : '–'}</b></div>`).join('')}</div>
      <p class="xs faint" style="margin:10px 0 0">${S.settings.ratesDate ? `Market rate of ${shortDate(S.settings.ratesDate)}, updated by itself every day.` : 'Updates by itself from the daily market rate.'} Wise converts at about this rate, minus its small fee.</p></section>

    <section class="card span2"><h2>Categories <small><a href="#" data-a="addCat">+ Add</a></small></h2>
      ${['expense', 'income'].map(k => `<div class="lbl" style="margin:4px 0 8px">${k === 'expense' ? 'Spending' : 'Income'}</div><div class="catpick" style="margin-bottom:12px">${catsOf(k).map(c => `<button data-a="editCat" data-id="${c.id}">${catIcon(c)} ${esc(c.name)}</button>`).join('')}</div>`).join('')}</section>

    <section class="card span2"><h2>Your data</h2><div class="row"><button class="btn" data-a="exportCsv">Export transactions (CSV)</button><button class="btn" data-a="exportJson">Back up everything (JSON)</button><span class="grow"></span>
      ${supa ? '<button class="btn" data-a="signOut">Sign out</button>' : '<button class="btn danger" data-a="resetDemo">Reset demo data</button>'}<button class="btn ghost" data-a="disconnect">${supa ? 'Disconnect this browser' : 'Leave demo'}</button></div></section>
  </div>`;
}

// ---------- modal & forms ----------
let lastFocus = null;
function modal(title, body, foot = '', wide = false) {
  lastFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="scrim" data-a="closeScrim"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button data-a="close" aria-label="Close">${IC('x')}</button></header>${body}${foot ? `<footer>${foot}</footer>` : ''}</div></div>`;
  drawIcons();
  setTimeout(() => ($('#modal-root [autofocus]') || $('#modal-root .modal button'))?.focus(), 30);
}
const closeModal = () => { if (!$('#modal-root').innerHTML) return; $('#modal-root').innerHTML = ''; lastFocus?.focus?.(); };
const accOptions = (sel, allowEmpty, only) => (allowEmpty ? '<option value="">—</option>' : '') + activeAccounts().filter(a => !only || only(a) || a.id === sel).map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}${a.currency !== 'PHP' ? ' (' + a.currency + ')' : ''}</option>`).join('');
const catOptions = (kind, sel) => '<option value="">Uncategorised</option>' + catsOf(kind).map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.name)}</option>`).join('');
const segTag = v => `<div class="seg" data-seg="tag" role="group" aria-label="Personal or Daybreak">${[['personal', 'Personal'], ['daybreak', 'Daybreak 🌅']].map(([k, l]) => `<button type="button" class="${v === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>`;
const amountField = (name, val, cur) => `<div class="amount-wrap"><span class="cur" data-cur>${SYM[cur] || cur}</span><input class="amount-in" name="${name}" inputmode="decimal" placeholder="0.00" value="${val != null ? num(val).toFixed(2) : ''}" autofocus aria-label="Amount"></div>`;

let txCtx = null;
const isCashAcc = a => a.type === 'cash';
const isMoneyAcc = a => !isCashAcc(a) && !['loan', 'credit', 'investment'].includes(a.type);
const MOVE = {
  withdraw: { title: 'Withdraw cash', save: 'Save withdrawal', note: 'Cash withdrawal', from: isMoneyAcc, to: isCashAcc },
  deposit: { title: 'Deposit cash', save: 'Save deposit', note: 'Cash deposit', from: isCashAcc, to: isMoneyAcc },
  move: { title: 'Transfer', save: 'Save transfer', note: '', from: isMoneyAcc, to: isMoneyAcc },
};
function moveForm(mode) {
  const m = MOVE[mode], from = activeAccounts().filter(m.from), to = activeAccounts().filter(m.to);
  if (mode !== 'move' && !activeAccounts().some(isCashAcc)) { toast('Add a Cash account first'); return accountForm({ type: 'cash', name: 'Cash' }); }
  if (!from.length || !to.length || (mode === 'move' && from.length < 2)) return toast('Add two bank or e-wallet accounts first');
  const b = balances(), top = l => [...l].sort((x, y) => ((y.currency === 'PHP') - (x.currency === 'PHP')) || (b[y.id] || 0) * (rate(y.currency) ?? 0) - (b[x.id] || 0) * (rate(x.currency) ?? 0));
  const f = top(from)[0], t = top(to).find(a => a.id !== f.id);
  txForm({ kind: 'transfer', account_id: f.id, to_account_id: t?.id, note: m.note }, { mode });
}
function txForm(t = {}, ctx = {}) {
  txCtx = ctx;
  const kind = t.kind || 'expense', accId = t.account_id || activeAccounts()[0]?.id, mv = MOVE[ctx.mode];
  modal(t.id ? 'Edit transaction' : ctx.inboxId ? 'Review notification' : mv ? mv.title : 'Add transaction', `<form class="form" id="txf" data-kind="${kind}" onsubmit="return false">

    <div class="seg"${mv ? ' hidden' : ''} data-seg="kind" role="group" aria-label="Type">${[['expense', 'Expense', 'e'], ['income', 'Income', 'i'], ['transfer', 'Transfer', 't']].map(([k, l, c]) => `<button type="button" class="${c} ${kind === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
    ${amountField('amount', t.amount, curOf(accId))}
    <div id="catBlock"><div class="lbl" style="margin-bottom:6px">Category</div><div class="catpick" id="catpick"></div>
      <select name="category_id" style="margin-top:8px;width:100%" aria-label="All categories">${catOptions(kind === 'transfer' ? 'expense' : kind, t.category_id)}</select>
      <div class="hint" id="guessHint" style="margin-top:4px"></div></div>
    <div class="two"><label class="f"><span id="accLbl">Account</span><select name="account_id">${accOptions(accId, false, mv?.from)}</select></label>
      <label class="f" id="toWrap">To account<select name="to_account_id">${accOptions(t.to_account_id, !mv, mv?.to)}</select></label></div>
    <label class="f" id="toAmtWrap">Amount received (other currency)<input name="to_amount" inputmode="decimal" value="${t.to_amount != null ? num(t.to_amount).toFixed(2) : ''}"></label>
    <label class="f">Note<input name="note" value="${esc(t.note || '')}" placeholder="e.g. Jollibee, Meralco, padala" autocomplete="off"></label>
    <div class="two"><label class="f">Date<input type="date" name="date" value="${t.date || today()}"></label>
      <div class="f" style="justify-content:flex-end"><div class="quickdates"><button type="button" data-a="setDate" data-v="0">Today</button><button type="button" data-a="setDate" data-v="-1">Yesterday</button></div></div></div>
    ${segTag(t.tag || 'personal')}
    ${ctx.raw ? `<details class="orig"><summary>Original notification</summary><div>${esc(ctx.raw)}</div></details>` : ''}
  </form>`, `${t.id ? '<button class="btn danger left" data-a="delTx" data-id="' + t.id + '">Delete</button>' : ''}${ctx.inboxId ? `<button class="btn ghost left" data-a="ignoreInbox" data-id="${ctx.inboxId}">Dismiss</button>` : `<button class="btn ghost" data-a="close">Cancel</button>`}<button class="btn pri" id="saveTxBtn" data-a="saveTx" data-id="${t.id || ''}">Save</button>`);
  syncTxForm();
}
function syncTxForm() {
  const f = $('#txf'); if (!f) return;
  const kind = f.dataset.kind, from = f.account_id.value, to = f.to_account_id.value;
  $('#toWrap').style.display = kind === 'transfer' ? '' : 'none';
  $('#catBlock').style.display = kind === 'transfer' ? 'none' : '';
  $('#accLbl').textContent = kind === 'transfer' ? 'From account' : 'Account';
  $('#toAmtWrap').style.display = kind === 'transfer' && to && curOf(from) !== curOf(to) ? '' : 'none';
  $('#txf [data-cur]').textContent = SYM[curOf(from)] || curOf(from);
  if (kind !== 'transfer') {
    const sel = f.category_id.value;
    $('#catpick').innerHTML = topCats(kind, 8).map(c => `<button type="button" class="${sel === c.id ? 'on' : ''}" data-a="pickCat" data-id="${c.id}">${catIcon(c)} ${esc(c.name)}</button>`).join('');
  }
  $('#saveTxBtn').textContent = txCtx?.inboxId ? 'Approve' : MOVE[txCtx?.mode] ? MOVE[txCtx.mode].save : { expense: 'Save expense', income: 'Save income', transfer: 'Save transfer' }[kind];
}

function accountForm(a = {}) {
  modal(a.id ? 'Edit account' : 'Add account', `<form class="form" id="accf" onsubmit="return false">
    <label class="f">Name<input name="name" value="${esc(a.name || '')}" placeholder="e.g. GoTyme, GCash, Wise USD" autofocus></label>
    <div class="two"><label class="f">Type<select name="type">${Object.entries(ACCOUNT_TYPES).map(([k, [l]]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Currency<select name="currency">${['PHP', 'USD', 'SGD', 'EUR', 'GBP', 'AUD', 'CAD'].map(c => `<option ${(a.currency || 'PHP') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="f">Starting balance<input name="opening_balance" inputmode="decimal" value="${a.opening_balance != null ? num(a.opening_balance).toFixed(2) : ''}" placeholder="What it holds today"></label>
    <div class="hint" style="margin-top:-8px">For a credit card or loan, enter what you owe as a minus number, e.g. -8500.</div>
    <label class="f">Auto-detect from phone notifications<select name="bank"><option value="">Off (manual only)</option>${Object.entries(BANKS).map(([k, v]) => `<option value="${k}" ${a.bank === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
  </form>`, `${a.id ? `<button class="btn danger left" data-a="archiveAccount" data-id="${a.id}">Archive</button><button class="btn" data-a="matchAccount" data-id="${a.id}">Match balance</button>` : ''}<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="saveAccount" data-id="${a.id || ''}">Save account</button>`);
}

function billForm(b = {}, inboxId = '') {
  modal(b.id ? 'Edit bill' : 'Add bill', `<form class="form" id="billf" data-inbox="${esc(inboxId)}" onsubmit="return false">
    <label class="f">Name<input name="name" value="${esc(b.name || '')}" placeholder="e.g. Meralco, PLDT, Rent" autofocus></label>
    <div class="two"><label class="f">Amount (₱)<input name="amount" inputmode="decimal" value="${b.amount != null ? num(b.amount).toFixed(2) : ''}"></label>
      <label class="f">Next due date<input type="date" name="due_date" value="${b.due_date || today()}"></label></div>
    <div class="two"><label class="f">Repeats<select name="repeat">${['monthly', 'weekly', 'quarterly', 'yearly', 'none'].map(r => `<option value="${r}" ${(b.repeat || 'monthly') === r ? 'selected' : ''}>${r === 'none' ? 'One-off' : r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select></label>
      <label class="f">Category<select name="category_id">${catOptions('expense', b.category_id)}</select></label></div>
    <label class="f">Usually paid from<select name="account_id">${accOptions(b.account_id, true)}</select></label>
    <label class="f">Note<input name="note" value="${esc(b.note || '')}"></label>
    <label class="row small muted" style="gap:8px"><input type="checkbox" name="autopay" ${b.autopay ? 'checked' : ''}> Auto-pay (charged automatically)</label>
    ${segTag(b.tag || 'personal')}
  </form>`, `${inboxId ? `<button class="btn ghost left" data-a="ignoreInbox" data-id="${esc(inboxId)}">Dismiss</button>` : b.id ? `<button class="btn danger left" data-a="delBill" data-id="${b.id}">Delete</button>` : ''}<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="saveBill" data-id="${b.id || ''}">Save bill</button>`);
}

function payForm(b, date) {
  const accId = b.account_id || activeAccounts()[0]?.id, cur = curOf(accId), r = rate(cur);
  const amt0 = cur === 'PHP' || !r ? num(b.amount) : num(b.amount) / r;
  // Open the bank or e-wallet app to actually pay; then come back and log it here.
  const apps = [...new Set(activeAccounts().filter(a => a.bank && BANK_APP[a.bank]).map(a => a.bank))].filter(k => bankAppLink(k));
  const payApps = apps.length ? `<div class="payapps"><div class="lbl">Pay in your app</div><div class="pa-row">${apps.map(k => { const h = bankAppLink(k);
    return `<a class="pa" data-bank="${k}" href="${esc(h)}" ${h.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}><img src="${BANK_LOGO[k]}" alt="">${esc(BANK_APP[k].name)}</a>`; }).join('')}</div>
    <div class="xs faint" style="margin-top:8px">When you come back to Scry, it asks if the payment went through and logs it for you. Already paid? Log it below.</div></div>` : '';
  modal('Pay ' + b.name, `<form class="form" id="payf" data-bill="${b.id}" data-due="${date}" onsubmit="return false">
    ${payApps}
    ${amountField('amount', amt0, cur)}
    <div class="two"><label class="f">Fee<input name="fee" inputmode="decimal" placeholder="0.00"></label><label class="f">Paid from<select name="account_id">${accOptions(accId)}</select></label></div>
    <label class="f">Date paid<input type="date" name="date" value="${today()}"></label>
    <div class="callout">${b.repeat === 'none' ? 'This one-off bill will be marked paid.' : `Next due date moves to <b>${shortDate(nextDate(date, b.repeat))}</b>.`}${b.note ? `<div class="xs faint" style="margin-top:6px">${esc(b.note)}</div>` : ''}</div>
  </form>`, `<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="confirmPay" data-id="${b.id}" data-date="${date}">Log payment</button>`);
}

// Tapping a bank button remembers the bill. Back in Scry, one question: did it go through? Yes logs it.
const PAYING = 'scry-paying';
document.addEventListener('click', ev => {
  const a = ev.target.closest('a.pa[data-bank]'), f = $('#payf'); if (!a || !f) return;
  const ac = activeAccounts().find(x => x.bank === a.dataset.bank && x.currency === 'PHP') || activeAccounts().find(x => x.bank === a.dataset.bank);
  const same = !ac || curOf(ac.id) === curOf(f.account_id.value);   // typed amounts only carry over in the same currency
  const p = { bill: f.dataset.bill, due: f.dataset.due, account_id: ac?.id || f.account_id.value, amount: same ? amt(f.amount.value) || null : null, fee: same ? amt(f.fee?.value) || 0 : 0, at: Date.now() };
  LS.set(PAYING, p);
  setTimeout(() => { const b = S.d.bills.find(x => x.id === p.bill); if (b) paidPrompt(b, p); }, 700);   // waiting for him when he comes back
}, true);
// A bank or email message that matches a bill payment already logged (bill + fee) is closed and linked to it.
async function autoLinkPaid() {
  const done = [];
  for (const it of newInbox()) {
    let c; try { c = inboxCheck(it); } catch { continue; }
    if (c.dup?.bill_id) done.push([it.id, c.dup.id]);
  }
  for (const [id, tx] of done) await DB.update('inbox', id, { status: 'done', transaction_id: tx }).catch(() => {});
  if (done.length) render();
}
function checkPaying() {
  const p = LS.get(PAYING, null); if (!p || !S.mode) return;
  const age = Date.now() - p.at;
  if (age > 6 * 3600e3) return LS.del(PAYING);
  if (age < 2500) return;                                         // still on the way out to the app
  const b = S.d.bills.find(x => x.id === p.bill);
  if (!b || !b.active || (b.last_paid && b.last_paid >= iso(new Date(p.at)))) return LS.del(PAYING);
  const open = $('#modal-root').innerHTML; if (open && !$('#payf')) return;   // something else is open: ask next time
  LS.del(PAYING); if ($('#modal-root').textContent.includes('Did you pay')) return; paidPrompt(b, p);
}
function paidPrompt(b, p0) {
  let p = p0;
  const a = acc(p.account_id), cur = curOf(p.account_id), r = rate(cur);
  const amt0 = p.amount ?? (cur === 'PHP' || !r ? num(b.amount) : num(b.amount) / r);
  if (!p.fee) { const fc = S.d.categories.find(c => c.kind === 'expense' && norm(c.name) === 'fees');
    const last = fc && S.d.transactions.filter(t => t.category_id === fc.id && t.account_id === p.account_id).sort((x, y) => y.date.localeCompare(x.date))[0];
    if (last) p = { ...p, fee: num(last.amount) }; }
  modal(`Did you pay ${b.name}?`, `<form class="form" id="payf" data-bill="${b.id}" data-due="${p.due}" onsubmit="return false">
    <div class="paid-q">${a?.bank && BANK_LOGO[a.bank] ? `<img src="${BANK_LOGO[a.bank]}" alt="">` : IC('receipt')}<div>You opened <b>${esc(BANK_APP[a?.bank]?.name || 'your app')}</b> to pay this. If it went through, check the amount and log it. Add the fee if the app charged one.</div></div>
    ${amountField('amount', amt0, cur)}
    <div class="two"><label class="f">Fee<input name="fee" inputmode="decimal" value="${p.fee ? p.fee.toFixed(2) : ''}" placeholder="0.00"></label><label class="f">Paid from<select name="account_id">${accOptions(p.account_id)}</select></label></div>
    <input type="hidden" name="date" value="${today()}">
  </form>`, `<button class="btn ghost" data-a="close">Not paid</button><button class="btn pri" data-a="confirmPay" data-id="${b.id}" data-date="${p.due}">Yes, log it</button>`);
}

function catForm(c = {}) {
  modal(c.id ? 'Edit category' : 'Add category', `<form class="form" id="catf" onsubmit="return false">
    <div class="two"><label class="f">Icon<input name="icon" value="${esc(c.icon || '')}" maxlength="4" placeholder="🙂"></label>
      <label class="f">Type<select name="kind" ${c.id ? 'disabled' : ''}><option value="expense" ${c.kind !== 'income' ? 'selected' : ''}>Spending</option><option value="income" ${c.kind === 'income' ? 'selected' : ''}>Income</option></select></label></div>
    <label class="f">Name<input name="name" value="${esc(c.name || '')}" autofocus></label></form>`,
  `${c.id ? `<button class="btn danger left" data-a="archiveCat" data-id="${c.id}">Archive</button>` : ''}<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="saveCat" data-id="${c.id || ''}">Save</button>`);
}

// ---------- match balance: line Scry up with the real bank balance ----------
function matchForm(a, real) {
  const cur = a.currency, have = balances()[a.id];
  modal(`Match ${a.name}`, `<form class="form" id="matchf" data-id="${a.id}" onsubmit="return false">
    <div class="match-have"><div class="lbl">Scry thinks you have</div><div class="mid">${money(have, cur)}</div><div class="xs faint">${matchedLabel(a.id)}</div></div>
    <div class="f"><span>What your ${esc(a.name)} app shows right now</span>
      <div class="match-in">${amountField('real', real ?? null, cur)}<button type="button" class="btn cam" data-a="matchShot" data-id="${a.id}" aria-label="Read it from a screenshot of your bank app" title="Read it from a screenshot">${IC('camera')}</button></div></div>
    <div class="callout xs" id="matchDiff"></div>
  </form>`, `<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="saveMatch" data-id="${a.id}">Match</button>`);
  syncMatch();
}
function syncMatch() {
  const f = $('#matchf'); if (!f) return;
  const a = acc(f.dataset.id), have = balances()[a.id], raw = f.real.value.trim(), real = amt(raw), d = real - have;
  $('#matchDiff').innerHTML = !raw ? `Type the balance, or tap the camera and pick a screenshot of your ${esc(a.name)} app.`
    : Math.abs(d) < 0.005 ? `${IC('circle-check', 'sm')} Spot on. Nothing to fix.`
    : `Scry is <b>${money(Math.abs(d), a.currency)} ${d > 0 ? 'too low' : 'too high'}</b>. I'll add one "${ADJ}" of ${d > 0 ? '+' : '−'}${money(Math.abs(d), a.currency)} so it matches. It won't count as spending or income.${Math.abs(d) > 500 ? '<div class="warn" style="margin-top:6px">That is a big gap: a transaction may have been missed. Check Activity after.</div>' : ''}`;
  drawIcons();
}
async function saveMatch(id) {
  const f = $('#matchf'), a = acc(id), raw = f.real.value.trim();
  if (!raw) { f.real.focus(); return toast('Enter the balance your bank app shows'); }
  const d = Math.round((amt(raw) - balances()[id]) * 100) / 100;
  await safe(async () => {
    if (Math.abs(d) >= 0.01) await DB.insert('transactions', { kind: d > 0 ? 'income' : 'expense', amount: Math.abs(d), date: today(), account_id: id, note: ADJ, tag: 'personal', category_id: null });
    const matched = { ...matchedMap(), [id]: today() };
    if (isDemo()) { S.settings.matched = matched; saveSettings(); }
    else { const { data, error } = await S.sb.auth.updateUser({ data: { matched } }); if (error) throw error; S.user = data.user; }
  });
  closeModal(); render();
  toast(Math.abs(d) < 0.01 ? `${a.name} was spot on` : `${a.name} matched. It was off by ${money(Math.abs(d), a.currency)}`);
}
function matchShot(id) {
  if (isDemo()) return toast("Reading screenshots works once you're signed in");
  const a = acc(id), inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    $('#matchDiff').innerHTML = '<span class="spin sm" aria-hidden="true"></span> Reading your screenshot…';
    try {
      const image = await shrinkPhoto(file);
      const { data, error } = await S.sb.functions.invoke('scan', { body: { image, media_type: 'image/jpeg', categories: [], today: today(), hint: `Balance screen for the account "${a.name}" (${BANKS[a.bank]?.name || a.type}) in ${a.currency}.` } });
      if (error || !data || data.doc_type !== 'balance') throw new Error('no balance');
      const f = $('#matchf'); if (!f) return;
      f.real.value = Number(data.total).toFixed(2); syncMatch();
      if (data.currency && data.currency !== a.currency) $('#matchDiff').insertAdjacentHTML('beforeend', `<div class="warn" style="margin-top:6px">The screenshot shows ${esc(data.currency)}, this account is ${esc(a.currency)}. Double-check.</div>`);
    } catch { if ($('#matchDiff')) $('#matchDiff').innerHTML = '<span class="warn">Couldn\'t find a balance in that screenshot. Type it in instead.</span>'; }
  };
  inp.click();
}

// ---------- photo scanner: receipts, bills, card slips, card statements ----------
// The photo goes to the `scan` Edge Function once (Claude reads it) and is never stored.
// Nothing is saved until Blu taps Save on the pre-filled form.
let scanResult = null;
function scanPick() {
  if (isDemo()) return toast("Scanning works once you're signed in");
  if (!activeAccounts().length) return (toast('Add an account first'), accountForm());
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
  inp.onchange = () => inp.files[0] && scanFile(inp.files[0]);
  inp.click();
}
async function shrinkPhoto(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
async function scanFile(file) {
  modal('Reading your photo', `<div class="scan-wait"><span class="spin" aria-hidden="true"></span><div><b>Scry is reading it…</b><div class="xs muted">Usually 5 to 15 seconds. The photo isn't saved.</div></div></div>`, `<button class="btn ghost" data-a="close">Cancel</button>`);
  let image;
  try { image = await shrinkPhoto(file); } catch { closeModal(); return toast("Couldn't open that photo"); }
  const cats = S.d.categories.filter(c => !c.archived && c.kind === 'expense').map(c => c.name);
  let r;
  try {
    const { data, error } = await S.sb.functions.invoke('scan', { body: { image, media_type: 'image/jpeg', categories: cats, today: today() } });
    if (error) { let m; try { m = (await error.context?.json?.())?.error; } catch { /* no body */ } throw new Error(m || "Couldn't read that photo. Try again."); }
    r = data;
  } catch (e) {
    if (!$('.scan-wait')) return;  // cancelled
    return modal("Couldn't read it", `<div class="callout">${esc(e.message)}</div>`, `<button class="btn ghost" data-a="close">Close</button><button class="btn pri" data-a="scanAgain">Try again</button>`);
  }
  if (!$('.scan-wait')) return;    // cancelled while waiting
  closeModal(); scanResult = r; showScan(r);
}
const catByName = name => S.d.categories.find(c => !c.archived && c.kind === 'expense' && c.name === name)?.id;
function scanAccount(r) {
  const accs = activeAccounts();
  if (r.payment_method === 'cash') return accs.find(a => a.type === 'cash')?.id;
  if (r.payment_method === 'card' || r.card_last4) return accs.find(a => a.type === 'credit')?.id;
  if (r.payment_method === 'ewallet') return accs.find(a => a.bank === 'gcash')?.id;
  return undefined;
}
function scanSummary(r) {
  const bits = [{ receipt: 'Receipt', card_slip: 'Card slip', bill: 'Bill', card_statement: 'Card statement', other: 'Photo' }[r.doc_type] || 'Photo'];
  if (r.card_last4) bits.push('card ending ' + r.card_last4);
  if (r.note) bits.push(r.note);
  if (r.confidence !== 'high') bits.push(r.confidence === 'low' ? 'blurry, please double-check the amount' : 'partly unclear, check the amount');
  return bits.join(' · ');
}
function showScan(r) {
  if (r.doc_type === 'card') return modal("That's a card", `<div class="callout">Scry never reads card numbers. Scan the <b>receipt</b>, <b>charge slip</b> or <b>statement</b> instead.</div>`, `<button class="btn ghost" data-a="close">Close</button><button class="btn pri" data-a="scanAgain">Scan something else</button>`);
  if (r.doc_type === 'balance') return modal('That is a balance screen', `<div class="callout">To line Scry up with it, open <b>Accounts</b>, tap <b>Match</b> on that account, then tap the camera and pick this screenshot.</div>`, `<a class="btn pri" href="#accounts" data-a="close">Go to Accounts</a>`);
  if (r.doc_type === 'other' && !r.total) return modal('Nothing to add', `<div class="callout">I couldn't find an amount in that photo. Try again closer, with the total in view.</div>`, `<button class="btn ghost" data-a="close">Close</button><button class="btn pri" data-a="scanAgain">Try again</button>`);
  const foreign = r.currency && r.currency !== 'PHP' ? ` (${r.currency} on the photo)` : '';
  if (r.doc_type === 'bill') {
    const existing = S.d.bills.find(b => b.active && norm(b.name) === norm(r.merchant));
    if (existing) billForm({ ...existing, amount: r.total || existing.amount, due_date: r.due_date || existing.due_date });
    else billForm({ name: r.merchant, amount: r.total || null, due_date: r.due_date || today(), repeat: 'monthly', category_id: catByName(r.category), note: r.note || null });
    return scanCallout(`${existing ? 'Updating your existing bill. ' : ''}${scanSummary(r)}${foreign}`);
  }
  if (r.doc_type === 'card_statement' && r.lines?.length) return scanStatement(r);
  txForm({ kind: 'expense', amount: r.total || null, note: r.merchant || null, date: r.date || today(), category_id: catByName(r.category), account_id: scanAccount(r) });
  scanCallout(scanSummary(r) + foreign);
}
function scanCallout(text) {
  const f = $('#txf') || $('#billf'); if (!f) return;
  f.insertAdjacentHTML('afterbegin', `<div class="callout xs scan-note">${IC('scan-line', 'sm')} Read from your photo: ${esc(text)}. Check it, then save.</div>`);
  drawIcons();
}
function scanStatement(r) {
  const credit = activeAccounts().find(a => a.type === 'credit');
  const already = l => S.d.transactions.some(t => t.date === l.date && Math.abs(num(t.amount) - Math.abs(l.amount)) < 0.005);
  modal(r.merchant || 'Card statement', `<div class="callout xs scan-note">${IC('scan-line', 'sm')} ${esc(scanSummary(r))}${r.total ? ` · amount due <b>${money(r.total)}</b>` : ''}${r.due_date ? ` by <b>${shortDate(r.due_date)}</b>` : ''}</div>
    <form class="form" id="scanf" onsubmit="return false">
      <label class="f">Add these charges to<select name="account_id">${accOptions(credit?.id)}</select></label>
      <label class="row small muted" style="gap:8px"><input type="checkbox" checked data-a="scanAll"> Select all</label>
      <div class="list" id="scanLines">${r.lines.map((l, i) => { const dup = already(l); return `<label class="item" style="gap:10px"><input type="checkbox" data-i="${i}" ${l.amount > 0 && !dup ? 'checked' : ''}><div class="main"><div class="t">${esc(l.description || 'Charge')}</div><div class="s">${l.date ? shortDate(l.date) : 'no date'}${l.amount < 0 ? ' · payment or credit' : ''}${dup ? ' · looks already added' : ''}</div></div><div class="amt ${l.amount < 0 ? 'pos' : ''}">${money(Math.abs(l.amount))}</div></label>`; }).join('')}</div>
      ${r.total && r.due_date ? `<label class="row small muted" style="gap:8px"><input type="checkbox" name="mkbill" checked> Also add a bill reminder for ${money(r.total)} due ${shortDate(r.due_date)}</label>` : ''}
    </form>`, `<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="scanAddLines">Add selected</button>`, true);
}
async function scanAddLines() {
  const r = scanResult, v = form('#scanf'); if (!r) return;
  const picks = [...document.querySelectorAll('#scanLines input[data-i]:checked')].map(c => r.lines[Number(c.dataset.i)]);
  if (!picks.length && !v.mkbill) return toast('Pick at least one');
  const rows = picks.map(l => { const kind = l.amount < 0 ? 'income' : 'expense'; return { kind, amount: Math.abs(l.amount), date: l.date || today(), account_id: v.account_id, note: l.description || null, tag: 'personal', category_id: guessCategory(l.description, kind) }; });
  await safe(async () => {
    if (rows.length) await DB.insert('transactions', rows);
    if (v.mkbill) await DB.insert('bills', { name: r.merchant || 'Card bill', amount: r.total, due_date: r.due_date, repeat: 'monthly', account_id: null, autopay: false, tag: 'personal', active: true, note: r.minimum_due ? `Minimum due ${money(r.minimum_due)}` : null });
  });
  scanResult = null; closeModal(); render(); toast(`Added ${rows.length} charge${rows.length === 1 ? '' : 's'}${v.mkbill ? ' and a bill reminder' : ''}`);
}

// ---------- statement import (CSV) ----------
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function parseDateStr(s, fmt) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return fmt === 'dmy' ? `${y}-${pad(m[2])}-${pad(m[1])}` : `${y}-${pad(m[1])}-${pad(m[2])}`;
  }
  const d = new Date(s); return isNaN(d) ? null : iso(d);
}
const parseAmt = s => { const v = String(s || '').replace(/[^0-9.\-()]/g, ''); if (!v) return null; const neg = /^\(.*\)$/.test(v) || v.startsWith('-'); const n = Number(v.replace(/[()\-]/g, '')); return Number.isFinite(n) ? (neg ? -n : n) : null; };
let imp = null;
function importForm() {
  imp = { rows: null, map: null, file: '' };
  modal('Import a statement', `<div id="impBody"></div>`, `<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="doImport" id="impBtn" disabled>Import</button>`, true);
  renderImport();
}
const guessCol = (head, re) => head.findIndex(h => re.test(h));
function renderImport() {
  const step = !imp.rows ? 1 : 2;
  const steps = `<div class="steps"><span class="${step === 1 ? 'on' : 'done'}">1 · Choose file</span><span class="${step === 2 ? 'on' : ''}">2 · Match columns</span><span class="${step === 2 ? 'on' : ''}">3 · Check & import</span></div>`;
  const accPick = `<label class="f">Into account<select id="impAcc">${accOptions(imp.acc || activeAccounts()[0]?.id)}</select></label>`;
  if (step === 1) {
    $('#impBody').innerHTML = steps + `<div class="form">${accPick}<div class="drop">Pick a CSV statement file<br><span class="xs faint">Wise: download a CSV statement from Wise once a month and import it here to catch anything a notification missed. GCash, GoTyme and MariBank email password-protected PDFs, which this importer can't read yet.</span><br><input type="file" id="impFile" accept=".csv,text/csv"></div></div>`;
    return;
  }
  const [head, ...rows] = imp.rows, opt = sel => `<option value="-1">—</option>` + head.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('');
  if (!imp.map) {
    imp.map = { date: guessCol(head, /date/i), desc: guessCol(head, /desc|detail|narr|particular|merchant|payee|note/i), amount: guessCol(head, /amount|total/i), inc: guessCol(head, /credit|money in|deposit|paid in/i), out: guessCol(head, /debit|money out|withdraw|paid out/i), fmt: 'mdy' };
    if (imp.map.inc >= 0 && imp.map.out >= 0) imp.map.amount = -1;
  }
  const M = imp.map, all = rowsToTx(rows), good = all.filter(t => !t.err), fresh = good.filter(t => !isDupTx(t));
  $('#impBody').innerHTML = steps + `<div class="form">${accPick}<div class="xs faint">File: ${esc(imp.file)} · ${rows.length} rows</div>
    <div class="grid g3" style="gap:10px">
      <label class="f">Date<select data-imp="date">${opt(M.date)}</select></label>
      <label class="f">Description<select data-imp="desc">${opt(M.desc)}</select></label>
      <label class="f">Date style<select data-imp="fmt"><option value="mdy" ${M.fmt === 'mdy' ? 'selected' : ''}>MM/DD/YYYY</option><option value="dmy" ${M.fmt === 'dmy' ? 'selected' : ''}>DD/MM/YYYY</option></select></label>
      <label class="f">Amount (minus = out)<select data-imp="amount">${opt(M.amount)}</select></label>
      <label class="f">or Money in<select data-imp="inc">${opt(M.inc)}</select></label>
      <label class="f">and Money out<select data-imp="out">${opt(M.out)}</select></label></div>
    <div class="row"><span class="badge ok">${fresh.length} new</span><span class="badge">${good.length - fresh.length} already here</span><span class="badge ${all.length - good.length ? 'db' : ''}">${all.length - good.length} unreadable</span></div>
    <div style="overflow:auto;max-height:280px"><table class="t"><tr><th>Date</th><th>Description</th><th>Amount</th><th>Category guess</th></tr>
    ${all.slice(0, 12).map(t => t.err ? `<tr><td colspan="4" class="warn">${esc(t.err)}</td></tr>` : `<tr><td>${t.date}</td><td class="wrap">${esc(t.note)}${isDupTx(t) ? ' <span class="badge">already here</span>' : ''}</td><td class="mono ${t.kind === 'income' ? 'pos' : ''}">${t.kind === 'income' ? '+' : '−'}${nf2.format(t.amount)}</td><td>${esc(cat(t.category_id)?.name || '—')}</td></tr>`).join('')}</table></div></div>`;
  $('#impBtn').disabled = !fresh.length;
  $('#impBtn').textContent = fresh.length ? `Import ${fresh.length}` : 'Import';
}
const isDupTx = t => S.d.transactions.some(x => x.account_id === t.account_id && x.date === t.date && Math.abs(num(x.amount) - t.amount) < .005 && x.kind === t.kind);
function rowsToTx(rows) {
  const M = imp.map, accId = imp.acc || activeAccounts()[0]?.id;
  return rows.map(r => {
    const date = parseDateStr(r[M.date], M.fmt);
    const a = M.amount >= 0 ? parseAmt(r[M.amount]) : ((parseAmt(r[M.inc]) || 0) - Math.abs(parseAmt(r[M.out]) || 0));
    if (!date || a == null || a === 0) return { err: `Skipped: ${r.slice(0, 4).join(' · ')}` };
    const kind = a > 0 ? 'income' : 'expense', note = String(r[M.desc] ?? '').trim().slice(0, 140);
    return { date, amount: Math.abs(a), kind, note, account_id: accId, category_id: guessCategory(note, kind), tag: 'personal' };
  });
}

// ---------- actions ----------
const form = id => Object.fromEntries(new FormData($(id)).entries());
const segVal = name => $(`[data-seg="${name}"] .on`)?.dataset.v;
const amt = v => num(String(v ?? '').replace(/,/g, ''));
const A = {
  pennyAsk: el => { if (location.hash !== '#penny') location.hash = 'penny'; pennySend(el.dataset.q); },
  safeInfo: () => {
    const s = safeToSpend();
    modal('Safe to spend', `<div class="safe-sheet">
      <div class="ssr"><span>Money you have now</span><b>${money(s.have)}</b></div>
      ${s.due.length ? s.due.map(o => `<div class="ssr sub"><span>${esc(o.bill.name)} <small>${o.late ? 'overdue' : 'due ' + esc(shortDate(o.date))}</small></span><b>−${money(num(o.bill.amount))}</b></div>`).join('') : '<div class="ssr sub"><span>No bills due before then</span><b>₱0.00</b></div>'}
      <div class="ssr tot"><span>Safe to spend until ${esc(shortDate(s.until))}</span><b class="${s.safe < 0 ? 'neg' : ''}">${money(s.safe)}</b></div>
      <p class="xs faint">${s.payer ? `Your next payday is ${esc(s.payer)} on ${esc(shortDate(s.until))}.` : 'No payday set up, so this looks 2 weeks ahead.'} Every bill due before then is set aside, overdue ones too. Dollars in Wise count at today's rate.</p></div>`,
      `<button class="btn pri" data-a="close">Got it</button>`);
  },
  paydayPlan: el => {
    const t = S.d.transactions.find(x => x.id === el.dataset.id), p = freshPay(); if (!t || !p) return;
    S.settings.planDone = { ...(S.settings.planDone || {}), [t.id]: 1 }; saveSettings();
    const a = acc(t.account_id), s = safeToSpend();
    A.pennyAsk({ dataset: { q: `Payday plan: my ${p.src.name} pay of ${money(num(t.amount), a?.currency || 'PHP')} landed in ${a?.name || 'my account'} on ${t.date}. My next payday is ${s.until}. Plan where this money goes until then and prepare the moves for me to approve.` } });
  },
  paydaySkip: el => { S.settings.planDone = { ...(S.settings.planDone || {}), [el.dataset.id]: 1 }; saveSettings(); render(); },
  pennySend: () => pennySend($('#pennyIn')?.value),
  pennyScan: () => pennyScan(),
  pennySave: el => { const m = S.penny[Number(el.dataset.i)]; if (!m?.scan) return; scanResult = m.scan; m.saved = true; savePenny(); showScan(m.scan); },
  pennyClear: () => { S.penny = []; savePenny(); render(); },
  pbOk: async el => { await pbApprove(+el.dataset.i, +el.dataset.j); savePenny(); render(); },
  pbSkip: el => { const it = S.penny[+el.dataset.i]?.items?.[+el.dataset.j]; if (it) it.st = 'skip'; savePenny(); render(); },
  pbAll: el => pbApproveAll(+el.dataset.i),
  pennyRetry: () => { const q = S.penny.pop(); savePenny(); pennySend(q.content); },
  tag: el => { S.tag = el.dataset.v; render(); },
  month: el => { const k = el.dataset.k; S[k] = shiftMonth(S[k], Number(el.dataset.v)); render(); },
  billView: el => { S.billView = el.dataset.v; render(); },
  hideBanner: () => { S.settings.hideBanner = true; saveSettings(); render(); },
  clearFilters: () => { S.f = { q: '', account: '', category: '' }; render(); },
  close: closeModal,
  closeScrim: (el, ev) => { if (ev.target === el) closeModal(); },
  addTx: () => activeAccounts().length ? txForm() : (toast('Add an account first'), accountForm()),
  addSheet: () => modal('Add', `<div class="addgrid">
      <button data-a="addKind" data-v="expense"><span class="b out">${IC('arrow-up-right')}</span><b>Expense</b><small>Money you spent</small></button>
      <button data-a="addKind" data-v="income"><span class="b in">${IC('arrow-down-left')}</span><b>Income</b><small>Money you got</small></button>
      <button data-a="addMove" data-v="move"><span class="b">${IC('arrow-left-right')}</span><b>Transfer</b><small>Bank to bank</small></button>
      <button data-a="addMove" data-v="withdraw"><span class="b">${IC('banknote')}</span><b>Withdraw</b><small>Bank to cash</small></button>
      <button data-a="addMove" data-v="deposit"><span class="b">${IC('landmark')}</span><b>Deposit</b><small>Cash to bank</small></button>
      <button data-a="scanFromSheet"><span class="b gold">${IC('scan-line')}</span><b>Scan</b><small>Receipt, bill or statement</small></button>
      <a href="#bills" data-a="close" class="wide"><span class="b">${IC('receipt')}</span><b>Pay a bill</b><small>Log a bill payment</small></a>
    </div>`),
  addKind: el => { closeModal(); if (!activeAccounts().length) return (toast('Add an account first'), accountForm()); txForm({ kind: el.dataset.v }); },
  scanFromSheet: () => { closeModal(); scanPick(); },
  addMove: el => { closeModal(); moveForm(el.dataset.v); },
  addTransfer: () => { closeModal(); activeAccounts().length > 1 ? txForm({ kind: 'transfer' }) : toast('Add two accounts first'); },
  editTx: el => txForm(S.d.transactions.find(t => t.id === el.dataset.id)),
  pickCat: el => { $('#txf').category_id.value = el.dataset.id; $('#guessHint').textContent = ''; syncTxForm(); },
  setDate: el => { $('#txf').date.value = addDays(today(), Number(el.dataset.v)); },
  async saveTx(el) {
    const f = $('#txf'), v = form('#txf'), kind = f.dataset.kind, amount = amt(v.amount);
    if (!(amount > 0)) { f.amount.focus(); return toast('Enter an amount'); }
    if (kind === 'transfer' && (!v.to_account_id || v.to_account_id === v.account_id)) return toast('Pick a different "To" account');
    const row = {
      kind, amount, date: v.date || today(), account_id: v.account_id, note: v.note.trim() || null, tag: segVal('tag') || 'personal',
      to_account_id: kind === 'transfer' ? v.to_account_id : null,
      to_amount: kind === 'transfer' && v.to_amount && curOf(v.account_id) !== curOf(v.to_account_id) ? amt(v.to_amount) : null,
      category_id: kind === 'transfer' ? null : (v.category_id || guessCategory(v.note, kind) || null),
    };
    await safe(async () => {
      let saved;
      if (el.dataset.id) saved = await DB.update('transactions', el.dataset.id, row);
      else { if (txCtx?.inboxId) row.inbox_id = txCtx.inboxId; [saved] = await DB.insert('transactions', row); }
      if (txCtx?.inboxId) await DB.update('inbox', txCtx.inboxId, { status: 'done', transaction_id: saved.id });
      if (txCtx?.incomeId) {
        const list = incomes().map(x => x.id !== txCtx.incomeId ? x : { ...x, next: x.every === 'none' ? x.next : (() => { let d = x.next; do { d = nextPayday(d, x.every); } while (d && d <= row.date); return d || x.next; })() });
        await saveIncomes(list.filter(x => !(x.id === txCtx.incomeId && x.every === 'none')));
      }
    });
    txCtx = null; closeModal(); render(); toast('Saved');
  },
  async delTx(el) { if (!confirm('Delete this transaction?')) return; await safe(() => DB.remove('transactions', el.dataset.id)); closeModal(); render(); },
  addAccount: () => accountForm(),
  editAccount: el => { closeModal(); accountForm(acc(el.dataset.id)); },
  openAccount: el => { S.f.account = el.dataset.id; if (location.hash === '#tx') render(); else location.hash = 'tx'; },
  async saveAccount(el) {
    const v = form('#accf'); if (!v.name.trim()) return toast('Give the account a name');
    const row = { name: v.name.trim(), type: v.type, currency: v.currency, opening_balance: amt(v.opening_balance), bank: v.bank || null };
    await safe(() => el.dataset.id ? DB.update('accounts', el.dataset.id, row) : DB.insert('accounts', { ...row, sort: S.d.accounts.length + 1 }));
    closeModal(); render();
  },
  async archiveAccount(el) { if (!confirm('Archive this account? Its history stays.')) return; await safe(() => DB.update('accounts', el.dataset.id, { archived: true })); closeModal(); render(); },
  addBill: () => billForm(),
  addIncome: () => activeAccounts().length ? incomeForm() : (toast('Add an account first'), accountForm()),
  suggestGoodHoops: () => {
    const wise = activeAccounts().find(a => a.bank === 'wise' && a.currency === 'USD') || activeAccounts().find(a => a.bank === 'wise');
    incomeForm({ name: 'GOOD Hoops', pay_cur: 'USD', hourly: 8, account_id: wise?.id, every: 'biweekly', next: '2026-12-05', tag: 'personal' });
  },
  suggestIntelocate: () => {
    const wise = activeAccounts().find(a => a.bank === 'wise' && a.currency === 'USD') || activeAccounts().find(a => a.bank === 'wise');
    incomeForm({ name: 'Intelocate (Summit Stride)', pay_cur: 'USD', hourly: 6, hours: 80, account_id: wise?.id, every: 'biweekly', next: '2026-12-05', tag: 'personal' });
  },
  editIncome: el => incomeForm(incomes().find(x => x.id === el.dataset.id)),
  async saveIncome(el) {
    const v = form('#incf'); if (!v.name.trim()) return toast('Who pays you?');
    const hourly = amt(v.hourly) || 0, hours = amt(v.hours) || 0;
    const row = { id: el.dataset.id || Math.random().toString(36).slice(2, 10), name: v.name.trim(), amount: hourly && hours ? Math.round(hourly * hours * 100) / 100 : (amt(v.amount) || 0), pay_cur: v.pay_cur || curOf(v.account_id), hourly, hours, account_id: v.account_id, every: v.every, next: v.next || today(), tag: segVal('tag') || 'personal' };
    const list = incomes().filter(x => x.id !== row.id).concat(row);
    await safe(() => saveIncomes(list)); closeModal(); render(); toast('Saved');
  },
  async delIncome(el) { if (!confirm('Delete this income source? Logged pay stays in your transactions.')) return; await safe(() => saveIncomes(incomes().filter(x => x.id !== el.dataset.id))); closeModal(); render(); },
  logIncome: el => {
    const i = incomes().find(x => x.id === el.dataset.id); if (!i) return;
    const c = catsOf('income').find(c => /salary|pay|wage|freelance|work/i.test(c.name)) || catsOf('income')[0];
    txForm({ kind: 'income', amount: incInAcc(i) || null, account_id: i.account_id, date: el.dataset.date <= today() ? el.dataset.date : today(), note: i.name, category_id: c?.id, tag: i.tag || 'personal' }, { incomeId: i.id });
  },
  toggleHide: () => { S.settings.hideAmounts = !S.settings.hideAmounts; saveSettings(); render(); },
  quickCat: el => { if (!activeAccounts().length) return (toast('Add an account first'), accountForm()); txForm({ kind: 'expense', category_id: el.dataset.id }); },
  cardMenu: el => { if (window.__justDragged) return; if (el.closest('#wstack') && el !== el.parentElement.lastElementChild) return stackFront(el);
    if (el.closest('.cardmenu')) return;
    if (el.dataset.id.startsWith('g:')) return groupMenu(el.dataset.id.slice(2));
    acctMenu(el.dataset.id); },
  openAcct: el => acctMenu(el.dataset.id),
  sheetAll: el => acctMenu(el.dataset.id, true),
  qrPick: el => qrPick(el.dataset.id),
  qrDel: el => qrDel(el.dataset.id),
  qrShow: el => qrShow(el.dataset.id),
  qrClose: el => el.remove(),
  sheetHide: el => { S.settings.hideAmounts = !S.settings.hideAmounts; saveSettings(); render(); acctMenu(el.dataset.id); },
  sheetAdd: el => { const id = el.dataset.id, k = el.dataset.k; closeModal();
    if (k === 'transfer') return activeAccounts().length > 1 ? txForm({ kind: 'transfer', account_id: id }) : toast('Add two accounts first');
    txForm({ kind: k, account_id: id }); },
  cardActivityAll: el => { closeModal(); S.f.account = ''; S.f.q = el.dataset.q; location.hash = 'tx'; },
  cardActivity: el => { closeModal(); S.f.account = el.dataset.id; location.hash = 'tx'; },
  matchAccount: el => { closeModal(); matchForm(acc(el.dataset.id)); },
  matchShot: el => matchShot(el.dataset.id),
  saveMatch: el => saveMatch(el.dataset.id),
  scan: () => scanPick(),
  scanAgain: () => { closeModal(); scanPick(); },
  scanAddLines: () => scanAddLines(),
  scanAll: el => { const on = el.checked; document.querySelectorAll('#scanLines input[data-i]').forEach(c => { c.checked = on; }); },
  editBill: el => billForm(S.d.bills.find(b => b.id === el.dataset.id)),
  async saveBill(el) {
    const fromInbox = $('#billf')?.dataset.inbox || '';
    if (fromInbox) setTimeout(() => safe(() => DB.update('inbox', fromInbox, { status: 'done' })).then(render), 0);
    const v = form('#billf'); if (!v.name.trim()) return toast('Give the bill a name');
    const row = { name: v.name.trim(), amount: amt(v.amount), due_date: v.due_date, repeat: v.repeat, category_id: v.category_id || null, account_id: v.account_id || null, note: v.note || null, autopay: !!v.autopay, tag: segVal('tag') || 'personal', active: true };
    await safe(() => el.dataset.id ? DB.update('bills', el.dataset.id, row) : DB.insert('bills', row));
    closeModal(); render();
  },
  async delBill(el) { if (!confirm('Delete this bill? Past payments stay in your transactions.')) return; await safe(() => DB.remove('bills', el.dataset.id)); closeModal(); render(); },
  payBill: el => { if (!activeAccounts().length) return toast('Add an account first'); payForm(S.d.bills.find(b => b.id === el.dataset.id), el.dataset.date); },
  async confirmPay(el) {
    const b = S.d.bills.find(x => x.id === el.dataset.id), v = form('#payf'), amount = amt(v.amount), fee = amt(v.fee || '') || 0;
    if (!(amount > 0)) return toast('Enter an amount');
    LS.del(PAYING);
    await safe(async () => {
      const [t] = await DB.insert('transactions', { kind: 'expense', amount, date: v.date, account_id: v.account_id, category_id: b.category_id, note: b.name, tag: b.tag, bill_id: b.id });
      if (fee > 0) await DB.insert('transactions', { kind: 'expense', amount: fee, date: v.date, account_id: v.account_id, category_id: await catFor('expense', 'Fees', '🧾'), note: `${b.name} fee`, tag: b.tag });
      // The bank's own notification for this payment may already be waiting in To review: close it so it isn't logged twice.
      const it = newInbox().find(i => { const c = inboxCheck(i); return c.a?.id === v.account_id && c.p.kind === 'expense' && c.p.amount != null && Math.abs(c.p.amount - (amount + fee)) < 0.005 && Math.abs(daysBetween(c.date, v.date)) <= 2; });
      if (it && t) await DB.update('inbox', it.id, { status: 'done', transaction_id: t.id });
      if (t) setTimeout(autoLinkPaid, 0);
      const nd = nextDate(el.dataset.date, b.repeat);
      await DB.update('bills', b.id, nd ? { due_date: nd, last_paid: v.date } : { active: false, last_paid: v.date });
    });
    closeModal(); render(); toast(`${b.name} paid`);
  },
  addCat: () => catForm(),
  editCat: el => catForm(cat(el.dataset.id)),
  async saveCat(el) {
    const v = form('#catf'); if (!v.name.trim()) return;
    await safe(() => el.dataset.id ? DB.update('categories', el.dataset.id, { name: v.name.trim(), icon: v.icon || null })
      : DB.insert('categories', { name: v.name.trim(), icon: v.icon || null, kind: v.kind, sort: S.d.categories.length + 1 }));
    closeModal(); render();
  },
  async archiveCat(el) { await safe(() => DB.update('categories', el.dataset.id, { archived: true })); closeModal(); render(); },
  async copyBudget() {
    const prev = shiftMonth(S.month, -1), rows = S.d.budgets.filter(b => b.month.startsWith(prev));
    if (!rows.length) return toast('Nothing budgeted last month');
    await safe(async () => { for (const r of rows) await setBudget(r.category_id, num(r.amount)); });
    render(); toast('Copied ' + monthName(prev) + "'s budget");
  },
  // review tray
  async acceptInbox(el) { await acceptOne(S.d.inbox.find(i => i.id === el.dataset.id)); render(); toast('Approved and added'); },
  async acceptAll() { let n = 0; for (const it of newInbox()) if (inboxCheck(it).ready) { await acceptOne(it); n++; } render(); toast(`Approved ${n}`); },
  editInbox(el) {
    const it0 = S.d.inbox.find(i => i.id === el.dataset.id);
    if (it0 && sourceOf(it0) !== 'bank') {
      const { p, bill } = inboxCheck(it0), raw = [it0.title, it0.body].filter(Boolean).join(' · '), date = iso(new Date(it0.received_at));
      if (p.kind === 'billdue' || !p.ok) {
        return billForm(bill ? { ...bill, amount: p.amount ?? bill.amount, due_date: p.due || bill.due_date } : { name: p.party || 'Bill', amount: p.amount, due_date: p.due || today(), repeat: 'monthly', category_id: guessCategory(p.party || '', 'expense') || catByName('Phone & internet') || null }, it0.id);
      }
      const note = p.party ? `${p.party} bill` : (it0.title || 'Bill payment');
      return txForm({ kind: 'expense', amount: p.amount, date, note, category_id: bill?.category_id || guessCategory(p.party || note, 'expense') || (/pldt|globe|smart|converge|dito|sky/i.test(p.party || '') ? catByName('Phone & internet') : /meralco|maynilad|water/i.test(p.party || '') ? catByName('Utilities') : null), tag: bill?.tag || 'personal' }, { inboxId: it0.id, raw });
    }
    const it = S.d.inbox.find(i => i.id === el.dataset.id), { p, a, xfer } = inboxCheck(it);
    const raw = [it.title, it.body].filter(Boolean).join(' · '), date = iso(new Date(it.received_at));
    if (xfer) return txForm({ kind: 'transfer', amount: p.amount, account_id: xfer.from?.id, to_account_id: xfer.to?.id, date, note: 'Transfer', tag: 'personal' }, { inboxId: it.id, raw });
    const kind = p.kind || 'expense', note = p.party || (it.title || '').slice(0, 60);
    txForm({ kind, amount: p.amount, account_id: a?.id, date, note, category_id: guessCategory(note, kind), tag: 'personal' },
      { inboxId: it.id, raw });
  },
  async ignoreInbox(el) { await safe(() => DB.update('inbox', el.dataset.id, { status: 'ignored' })); if ($('.modal')) { txCtx = null; closeModal(); } render(); toast('Dismissed. Its text is cleared.'); },
  simulate() {
    const bank = $('#simApp').value, text = $('#simText').value.trim(); if (!text) return;
    const item = { app: BANKS[bank].name, package: bank, title: '', body: text }, s = screenNotification(item);
    if (!s.keep) { $('#simOut').innerHTML = `<span class="badge risk">Would be dropped</span> ${esc(s.why)}. Nothing would be stored.`; A._sim = null; return; }
    const p = parseNotif({ ...item, body: s.body });
    $('#simOut').innerHTML = `<div><span class="badge ok">Would be kept</span> stored as: <span class="mono xs">“${esc(s.body)}”</span></div>
      <div style="margin-top:6px">${p.ok ? `Reader: ${p.kind === 'income' ? 'money in' : 'money out'} · <b>${money(p.amount, p.currency)}</b>${p.party ? ' · ' + esc(p.party) : ''} · category guess: ${esc(cat(guessCategory(p.party || text, p.kind))?.name || 'none')}` : `<span class="warn">Reader couldn't tell ${p.amount == null ? 'the amount' : 'if this is money in or out'}.</span>`}
      ${isDemo() ? ' <button class="btn sm" data-a="simToInbox">Add to the demo tray</button>' : ''}</div>`;
    A._sim = { ...item, received_at: new Date().toISOString() };
  },
  async simToInbox() {
    if (!A._sim) return;
    const out = await safe(() => DB.insert('inbox', { ...A._sim, status: 'new' }));
    if (!out.length) return toast('Already in the tray (same text today)');
    location.hash = 'home'; toast('Added to To review');
  },
  async makeKey() {
    if (!confirm('Create a new phone key? Any old key stops working immediately.')) return;
    const { data, error } = await S.sb.rpc('create_ingest_key'); if (error) return toast(error.message);
    await loadKeyStatus(); render();
    $('#keybox').innerHTML = `<div class="callout"><div class="xs">Your phone key. It's shown only this once: put it in MacroDroid, then leave this page. Don't paste it in chats or screenshots.</div>
      <div class="row" style="margin-top:8px"><code>${esc(data)}</code><button class="btn sm" data-a="copyKey" data-v="${esc(data)}">Copy</button></div></div>`;
  },
  async revokeKey() {
    if (!confirm('Revoke the phone key? The phone stops sending until you make a new one.')) return;
    const { error } = await S.sb.rpc('revoke_ingest_key'); if (error) return toast(error.message);
    await loadKeyStatus(); render(); toast('Phone key revoked');
  },
  copyKey: el => { navigator.clipboard?.writeText(el.dataset.v).then(() => toast('Copied'), () => toast('Copy failed, select it by hand')); },
  import: () => activeAccounts().length ? importForm() : toast('Add an account first'),
  async doImport() {
    const [, ...rows] = imp.rows, fresh = rowsToTx(rows).filter(t => !t.err && !isDupTx(t));
    if (fresh.length) await safe(() => DB.insert('transactions', fresh));
    closeModal(); render(); toast(`Imported ${fresh.length}`);
  },
  exportCsv() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['date', 'kind', 'amount', 'currency', 'account', 'to_account', 'category', 'note', 'tag'].join(',')].concat([...S.d.transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.kind, t.amount, curOf(t.account_id), acc(t.account_id)?.name, acc(t.to_account_id)?.name, cat(t.category_id)?.name, t.note, t.tag].map(q).join(',')));
    download(`money-transactions-${today()}.csv`, lines.join('\n'), 'text/csv');
  },
  exportJson() { download(`money-backup-${today()}.json`, JSON.stringify(S.d, null, 1), 'application/json'); },
  async signOut() { await S.sb.auth.signOut(); location.reload(); },
  async disconnect() { if (!confirm(isDemo() ? 'Leave demo mode?' : 'Forget the Supabase connection in this browser? Your data stays in Supabase.')) return; LS.del('money-cfg'); if (S.sb) await S.sb.auth.signOut(); location.reload(); },
  resetDemo() { if (!confirm('Wipe the demo data and start the demo fresh?')) return; LS.del('money-demo-db'); S.settings.hideBanner = false; saveSettings(); location.reload(); },
  startDemo() { LS.set('money-cfg', { mode: 'demo' }); location.reload(); },
  connect() {
    const url = $('#cfgUrl').value.trim().replace(/\/+$/, ''), key = $('#cfgKey').value.trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return toast('That URL should look like https://abcd.supabase.co');
    if (key.length < 30) return toast('Paste the anon public key');
    LS.set('money-cfg', { mode: 'supa', url, key }); location.reload();
  },
  async signIn(el) {
    const email = $('#lgEmail').value.trim(), password = $('#lgPass').value;
    const { data, error } = el.dataset.v === 'up' ? await S.sb.auth.signUp({ email, password }) : await S.sb.auth.signInWithPassword({ email, password });
    if (error) return toast(error.message);
    if (!data.session) return toast('Check your email to confirm, then sign in');
    location.reload();
  },
};
async function acceptOne(it) {
  const { p, a, date, xfer, ready, split } = inboxCheck(it); if (!p.ok || !a || !ready) return;
  const note = p.party || it.title || BANKS[bankOf(it)]?.name;
  if (!xfer && (p.cashback || split)) return safe(async () => {
    let first;
    if (p.cashback) {
      [first] = await DB.insert('transactions', { kind: 'income', amount: p.amount, date, account_id: a.id, note: `${BANKS[bankOf(it)]?.name || ''} cashback`.trim(), category_id: await catFor('income', 'Cashback', '🎁'), tag: 'personal', inbox_id: it.id });
    } else {
      const b = split.bill;
      [first] = await DB.insert('transactions', { kind: 'expense', amount: split.base, date, account_id: a.id, note: b ? b.name : note, category_id: b?.category_id || guessCategory(note, 'expense'), tag: b?.tag || 'personal', inbox_id: it.id, bill_id: b?.id || null });
      await DB.insert('transactions', { kind: 'expense', amount: split.fee, date, account_id: a.id, note: `${b ? b.name : note} fee`, category_id: await catFor('expense', 'Fees', '🧾'), tag: b?.tag || 'personal' });
      if (b) await DB.update('bills', b.id, b.repeat === 'none' ? { active: false, last_paid: date } : { due_date: nextDate(b.due_date, b.repeat) || b.due_date, last_paid: date });
    }
    await DB.update('inbox', it.id, { status: 'done', transaction_id: first.id });
  });
  await safe(async () => {
    const row = xfer
      ? { kind: 'transfer', amount: p.amount, date, account_id: xfer.from.id, to_account_id: xfer.to.id, note: `Transfer to ${xfer.to.name}`, tag: 'personal', inbox_id: it.id }
      : { kind: p.kind, amount: p.amount, date, account_id: a.id, note, category_id: guessCategory(note, p.kind), tag: 'personal', inbox_id: it.id };
    const src = !xfer && p.payer ? incomes().find(x => norm(x.name).includes(norm(p.payer))) : null;
    if (src) { row.note = src.name; row.category_id = row.category_id || (catsOf('income').find(c => /salary|pay|wage|freelance|work/i.test(c.name)) || {}).id || null; row.tag = src.tag || 'personal'; }
    const [t] = await DB.insert('transactions', row);
    await DB.update('inbox', it.id, { status: 'done', transaction_id: t.id });
    if (src && src.next <= addDays(date, 3)) {
      let d = src.next; do { d = nextPayday(d, src.every); } while (d && d <= date);
      await saveIncomes(incomes().map(x => x.id === src.id ? { ...x, next: d || x.next } : x));
    }
  });
}
async function setBudget(cid, amount) {
  const ex = budgetFor(S.month, cid);
  if (ex) return DB.update('budgets', ex.id, { amount });
  if (amount) return DB.insert('budgets', { month: S.month + '-01', category_id: cid, amount });
}
async function loadKeyStatus() {
  if (isDemo()) return;
  try { const { data } = await S.sb.rpc('ingest_key_status'); S.keyStatus = data?.[0] || null; } catch { S.keyStatus = null; }
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- events ----------
document.addEventListener('click', async ev => {
  const segBtn = ev.target.closest('[data-seg] button');
  if (segBtn) {
    const seg = segBtn.parentElement; seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === segBtn));
    if (seg.dataset.seg === 'kind') {
      const f = $('#txf'); f.dataset.kind = segBtn.dataset.v;
      if (segBtn.dataset.v !== 'transfer') f.category_id.innerHTML = catOptions(segBtn.dataset.v, f.category_id.value);
      syncTxForm();
    }
    return;
  }
  const el = ev.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  ev.stopPropagation();
  if (el.tagName === 'A' || el.tagName === 'BUTTON') ev.preventDefault();
  try { await fn(el, ev); } catch (e) { console.error(e); }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') return closeModal();
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target.id === 'pennyIn') { ev.preventDefault(); return pennySend(ev.target.value); }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role="button"][data-a]')) { ev.preventDefault(); ev.target.click(); }
});
let qTimer;
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset.c === 'fq') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.f.q = el.value; const pos = el.selectionStart; render(); const n = $('[data-c="fq"]'); n.focus(); n.setSelectionRange(pos, pos); }, 250); }
  const f = $('#txf');
  if (el.name === 'real' && $('#matchf')) syncMatch();
  if (f && el.name === 'note' && f.dataset.kind !== 'transfer') {
    const g = guessCategory(el.value, f.dataset.kind);
    if (g && (!f.category_id.value || f.dataset.guessed === f.category_id.value)) { f.category_id.value = g; f.dataset.guessed = g; $('#guessHint').textContent = `Guessed from the note: ${cat(g)?.name}. Tap another to change.`; syncTxForm(); }
  }
});
document.addEventListener('change', async ev => {
  const el = ev.target, c = el.dataset.c;
  if (c === 'faccount') { S.f.account = el.value; render(); }
  else if (c === 'fcategory') { S.f.category = el.value; render(); }
  else if (c === 'budget') { await safe(() => setBudget(el.dataset.id, amt(el.value))); render(); }
  else if (c === 'ownNames') {
    const v = el.value.trim();
    if (isDemo()) { S.settings.ownNames = v; saveSettings(); return toast('Saved'); }
    const { data, error } = await S.sb.auth.updateUser({ data: { own_names: v } });
    if (error) return toast('Could not save: ' + error.message);
    S.user = data.user; render(); toast('Saved to your Scry profile');
  }
  else if (c === 'rate') { const v = num(el.value); if (v > 0) S.settings.rates[el.dataset.cur] = v; else delete S.settings.rates[el.dataset.cur]; saveSettings(); }
  else if ($('#txf') && (el.name === 'account_id' || el.name === 'to_account_id' || el.name === 'category_id')) syncTxForm();
  else if (el.id === 'impFile' && el.files[0]) { const text = await el.files[0].text(); imp.rows = parseCSV(text.replace(/^﻿/, '')); imp.map = null; imp.file = el.files[0].name; if (imp.rows.length < 2) { imp.rows = null; return toast('That file looks empty'); } renderImport(); }
  else if (el.dataset.imp) { imp.map[el.dataset.imp] = el.dataset.imp === 'fmt' ? el.value : Number(el.value); renderImport(); }
  else if (el.id === 'impAcc') { imp.acc = el.value; if (imp.rows) renderImport(); }
});
window.addEventListener('hashchange', () => {
  if (!S.mode || !$('#main')) return;
  const v = location.hash.slice(1) || 'home';
  if (v !== 'tx') S.f.account = '';
  S.view = v; closeModal(); render(); window.scrollTo(0, 0);
});

// ---------- gate screens & boot ----------
function gate(html) {
  $('#root').innerHTML = `<div class="gate"><div class="card"><div class="gate-hero"><img src="brand/scry-mark.svg" alt="Scry: a scrying crystal finding a spot on a map">
    <div class="gate-word">Scry</div><div class="gate-tag">Find where your money went.</div></div>${html}</div></div>`;
}
function showSetup() {
  gate(`<p class="muted">Your money, budgets and bills in one place.</p>
    <button class="btn pri" data-a="startDemo" style="width:100%;justify-content:center;margin:8px 0 6px">Try the demo</button>
    <p class="xs faint" style="margin:0 0 20px">Sample data only, kept in this browser. Nothing is sent anywhere.</p>
    <details><summary>Connect my own Supabase project</summary><div class="form" style="margin-top:12px">
    <label class="f">Project URL<input id="cfgUrl" placeholder="https://abcd1234.supabase.co"></label>
    <label class="f">anon public key<input id="cfgKey" placeholder="eyJhbGciOi…"></label>
    <div class="xs faint">The anon key is designed to be public. Never paste the service_role key here.</div>
    <button class="btn" data-a="connect">Connect</button></div></details>`);
}
function showLogin() {
  gate(`<p class="muted">Sign in to your money.</p><div class="form">
    <label class="f">Email<input id="lgEmail" type="email" autocomplete="username"></label>
    <label class="f">Password<input id="lgPass" type="password" autocomplete="current-password"></label>
    <div class="row"><button class="btn pri grow" style="justify-content:center" data-a="signIn" data-v="in">Sign in</button><button class="btn" data-a="signIn" data-v="up">Create account</button></div>
    <a href="#" class="xs" data-a="disconnect">Use a different Supabase project</a></div>`);
}
async function boot() {
  S.view = location.hash.slice(1) || 'home';
  const cfg = LS.get('money-cfg', null) || (window.MONEY_CONFIG ? { mode: 'supa', ...window.MONEY_CONFIG } : null);
  if (!cfg) return showSetup();
  if (cfg.mode === 'demo') S.mode = 'demo';
  else {
    if (!window.supabase) return gate('<p class="warn">Could not load the Supabase library. Check your internet connection and reload.</p>');
    S.mode = 'supa'; S.sb = window.supabase.createClient(cfg.url, cfg.key);
    const { data: { session } } = await S.sb.auth.getSession();
    if (!session) return showLogin();
    S.user = session.user;
    try { const { data } = await S.sb.auth.getUser(); if (data?.user) S.user = data.user; } catch { /* offline: keep the saved copy */ }   // fresh profile (paydays, names)
    S.sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') showLogin(); });
  }
  try { await DB.load(); await seedIfEmpty(); await loadKeyStatus(); }
  catch (e) { console.error(e); return gate(`<p class="warn">Could not load your data: ${esc(e.message || e)}</p><p class="xs muted">If this is a new project, run schema.sql in the Supabase SQL editor first.</p><button class="btn" data-a="disconnect">Back</button>`); }
  render(); checkPaying();
  autoLinkPaid();
  if (!isDemo()) setInterval(async () => {
    if (document.hidden || $('#modal-root').innerHTML) return;
    try { const before = newInbox().length; S.d.inbox = await fetchAll('inbox'); await autoLinkPaid(); if (newInbox().length !== before) render(); } catch { /* offline */ }
  }, 60000);
}
// Auto-update: phones keep an old copy of the page for a while. On open (and when the app comes back
// to the foreground) fetch index.html fresh; if it names a newer app.js version, reload once.
async function checkForUpdate() {
  if (S.pennyBusy || S.scanBusy) return;
  try {
    const mine = (document.querySelector('script[src^="app.js"]')?.getAttribute('src') || '').split('v=')[1];
    const html = await fetch('index.html?check=' + Date.now(), { cache: 'no-store' }).then(r => r.text());
    const latest = (html.match(/app\.js\?v=(\d+)/) || [])[1];
    if (mine && latest && latest !== mine && !sessionStorage.getItem('scry-updated-to-' + latest)) {
      sessionStorage.setItem('scry-updated-to-' + latest, '1');
      location.replace(location.pathname + '?v=' + latest + location.hash);
    }
  } catch { /* offline or blocked: keep running the current version */ }
}
// Back on the tab: pick up anything changed on another device (approved on the phone, bills moved…).
let lastSync = Date.now();
async function resync() {
  if (isDemo() || !S.sb || !S.user || Date.now() - lastSync < 20000 || $('#modal-root').innerHTML) return;
  lastSync = Date.now();
  try { for (const t of TABLES) S.d[t] = await fetchAll(t); render(); } catch { /* offline: keep what's on screen */ }
}
// Exchange rates: the daily market rate (European Central Bank, via Frankfurter), at most every 6 hours.
async function refreshRates() {
  if (Date.now() - (S.settings.ratesAt || 0) < 6 * 3600e3) return;
  try {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=PHP,CAD,SGD,EUR,GBP,AUD').then(x => x.json());
    const php = num(r?.rates?.PHP); if (!(php > 0)) return;
    const rates = { USD: Math.round(php * 10000) / 10000 };
    for (const c of ['CAD', 'SGD', 'EUR', 'GBP', 'AUD']) if (num(r.rates[c]) > 0) rates[c] = Math.round(php / num(r.rates[c]) * 10000) / 10000;
    Object.assign(S.settings, { rates, ratesDate: r.date, ratesAt: Date.now() }); saveSettings();
    if (S.mode) render();
  } catch { /* offline: keep the last rate */ }
}
refreshRates();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkForUpdate(); setTimeout(checkPaying, 400); resync(); refreshRates(); } });
window.addEventListener('focus', resync);
checkForUpdate();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { /* still works without it */ });
boot();

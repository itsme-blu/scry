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
const CODE_WORDS = /otp|one[- ]?time|verif|authenticat|passcode|pass code|password|\bpin\b|mpin|security code|log[- ]?in|sign[- ]?in|access code|confirmation code|activation|new device|do not share|don't share|never share|huwag (mo )?(ibigay|ibahagi|i-share)|wag (mo )?(ibigay|ibahagi)/i;
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
  if (!/(gcash|wise|transferwise|mari ?bank|maribank|gotyme|go ?tyme)/i.test(`${item.app || ''} ${item.package || ''}`)) return { keep: false, why: 'not one of your four bank apps' };
  if (looksLikeCode(raw)) return { keep: false, why: 'looks like a login or verification code' };
  if (!hasMoney(raw)) return { keep: false, why: 'no money amount in it' };
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
function worth() {
  const b = balances(); let own = 0, owe = 0; const missing = new Set();
  for (const a of activeAccounts()) {
    const r = rate(a.currency); if (r == null) { missing.add(a.currency); continue; }
    const v = b[a.id] * r; if (v >= 0) own += v; else owe += v;
  }
  return { own, owe, net: own + owe, missing: [...missing] };
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
function bankOf(item) {
  const s = `${item.app || ''} ${item.package || ''}`;
  for (const [k, v] of Object.entries(BANKS)) if (v.re.test(s)) return k;
  return null;
}
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
  const outRe = /you(?:'ve| have)? sent|\bsent to\b|you paid|payment (?:to|of|for)|\bpaid\b|purchase|debited|withdr[ae]w|cash[- ]?out|transferred to|\bspent\b|charged|deducted|money out|card (?:payment|transaction)/i;
  let kind = null;
  if (/sent you|has sent you/i.test(text)) kind = 'income';
  else if (/\btransfer of\b.{1,40}?\bto\b/i.test(text)) kind = 'expense';   // MariBank: "An InstaPay transfer of PHP 50.00 to GCash …"
  else if (/\btransfer of\b.{1,40}?\bfrom\b/i.test(text)) kind = 'income';
  else if (outRe.test(text)) kind = 'expense';
  else if (inRe.test(text)) kind = 'income';
  const pq = text.match(/\b(?:from|to|at)\s+["“']([^"”']{1,40})["”']/);   // a quoted name: from "JUAN & CO"
  // A full stop ends the name only at a sentence end, so initials like "B. H. R. AUSTRIA" stay whole.
  const pm = pq || text.match(/\b(?:from|to|at)\s+([A-Z0-9][A-Za-z0-9&'.\- ]{1,40}?)(?=\s+(?:on|with|via|using|ref|reference|has|is|was|and|for)\b|\s*[,!(•]|\.(?:\s+[a-z]|\s*$)|$)/);
  const rm = text.match(/(?:ref(?:erence)?(?:\s*(?:no|number|#))?\.?|txn(?: id)?|transaction id)[:\s#]*([A-Z0-9-]{5,})/i);
  return { amount, currency, kind, party: pm ? pm[1].trim() : null, ref: rm ? rm[1] : null, ok: amount != null && kind != null };
}
function possibleDuplicate(accountId, amount, date) {
  return S.d.transactions.find(t => t.account_id === accountId && Math.abs(num(t.amount) - amount) < 0.005 && Math.abs(daysBetween(t.date, date)) <= 2);
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
  return { p, a, date, dup, curMismatch, ready: p.ok && a && !dup && !curMismatch };
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
S.penny = (() => { try { return JSON.parse(sessionStorage.getItem('scry-penny') || '[]'); } catch { return []; } })();
const savePenny = () => { try { sessionStorage.setItem('scry-penny', JSON.stringify(S.penny.slice(-30))); } catch { /* ignore */ } };
const PENNY_STARTERS = ['How am I doing this month?', 'Where can I cut back?', 'Suggest budgets for next month', 'What bills are coming up?', 'Am I mixing Daybreak and personal money?'];
function pennyText(t) {
  // Safe mini-markdown: escape first, then **bold**, bullet lines and line breaks.
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .split('\n').map(l => /^\s*[-•]\s+/.test(l) ? `<li>${l.replace(/^\s*[-•]\s+/, '')}</li>` : l).join('\n')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, m => `<ul>${m.replace(/\n/g, '')}</ul>`)
    .replace(/\n/g, '<br>');
}
function vPenny() {
  const msgs = S.penny.map((m, i) => m.role === 'user'
    ? `<div class="pm me"><div class="bubble">${m.photo ? `<span class="photo-tag">${IC('camera', 'sm')} Photo</span> ` : ''}${esc(m.content)}</div></div>`
    : `<div class="pm her"><span class="penny-dot lg" aria-hidden="true">P</span><div class="bubble ${m.error ? 'err' : ''}">${pennyText(m.content)}${pennySaveBtn(m, i)}</div></div>`).join('');
  const intro = `<div class="pm her"><span class="penny-dot lg" aria-hidden="true">P</span><div class="bubble">Hi Blu, I'm <b>Penny</b>, your accountant here in Scry. I can see your accounts, spending, budgets and bills, and I'll keep Daybreak's money separate from yours. Ask me anything about your finances.${isDemo() ? '<br><br><span class="warn">In demo mode I\'m asleep: I only work with your live data.</span>' : ''}</div></div>`;
  return ph('AI accountant', 'Ask Penny', 'Money questions only. She reads your Scry data and never changes it.',
      S.penny.length ? '<button class="btn ghost sm" data-a="pennyClear">New conversation</button>' : '')
  + `<section class="card penny-card"><div class="penny-log" id="pennyLog" aria-live="polite">${intro}${msgs}${S.pennyBusy ? '<div class="pm her"><span class="penny-dot lg" aria-hidden="true">P</span><div class="bubble typing">Penny is looking at your numbers…</div></div>' : ''}</div>
    ${S.penny.length ? '' : `<div class="catpick starters">${PENNY_STARTERS.map(q => `<button data-a="pennyAsk" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
    <form class="penny-form" onsubmit="return false"><textarea id="pennyIn" rows="2" placeholder="Ask about your money… e.g. Can I afford a ₱5,000 phone this month?" ${S.pennyBusy || isDemo() ? 'disabled' : ''}></textarea>
      <button type="button" class="btn cam" data-a="pennyScan" aria-label="Show Penny a photo of a bill or receipt" title="Scan a bill or receipt" ${S.pennyBusy || isDemo() ? 'disabled' : ''}>${IC('camera')}</button>
      <button class="btn pri" data-a="pennySend" ${S.pennyBusy || isDemo() ? 'disabled' : ''}>Ask</button></form>
    <div class="xs faint" style="margin-top:8px">Penny uses Claude (Anthropic). Your question and a summary of your Scry data are sent to Claude to answer. She's not a licensed financial adviser.</div></section>`;
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
    const history = S.penny.filter(m => !m.error).map(({ role, content, photo }) => ({ role, content: photo ? `[Blu showed you a photo here] ${content}` : content }));
    const { data, error } = await S.sb.functions.invoke('penny', {
      body: { messages: history, image: image || undefined, today: today(), rates: S.settings.rates },
    });
    let msg = data?.reply, isErr = false;
    if (error) {
      isErr = true;
      try { msg = (await error.context?.json?.())?.error; } catch { /* no body */ }
      msg ||= 'Penny couldn\'t answer right now. Try again in a moment.';
    }
    const scan = await scanP;
    S.penny.push({ role: 'assistant', content: msg || 'No answer came back.', error: isErr, scan: !isErr && scan && !scan.error ? scan : undefined });
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
    <div class="main"><div class="t">${esc(title)}${dbBadge(t.tag)}</div><div class="s">${sub}</div></div>
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
    <div class="main"><div class="t">${esc(b.name)}${dbBadge(b.tag)}</div><div class="s">${esc(b.repeat === 'none' ? 'One-off' : b.repeat[0].toUpperCase() + b.repeat.slice(1))}${b.autopay ? ' · auto-pay' : ''}${b.account_id && acc(b.account_id) ? ' · ' + esc(acc(b.account_id).name) : ''}</div></div>
    ${when}<div class="amt">${money(num(b.amount))}</div>${withPay ? `<button class="btn sm" data-a="payBill" data-id="${b.id}" data-date="${o.date}" aria-label="Log payment for ${esc(b.name)}">Pay</button>` : ''}</div>`;
}

// ---------- review tray ----------
// One review row: logo | what + status | amount | actions. Raw text lives only in the review sheet.
function reviewRow(it) {
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
// One account as a bank card. Brand colours come from the bank; no card numbers, real or fake.
function bankCard(a, bal) {
  const brand = a.bank || (a.type === 'cash' ? 'cash' : a.type === 'credit' ? 'credit' : 'other');
  const logo = (a.bank && BANK_LOGO[a.bank]) || null;
  return `<div class="bcard" data-brand="${brand}" data-a="cardMenu" data-id="${a.id}" role="button" tabindex="0" aria-label="${esc(a.name)}, ${money(bal, a.currency)}">
    ${logo ? `<img class="wm" src="${logo}" alt="">` : ''}
    <div class="top"><span class="lg">${accIcon(a, 30)}</span><span class="nm">${esc(a.name)}</span></div>
    <span class="chip" aria-hidden="true"></span>
    <div class="bot"><div class="k">Balance</div><div class="m ${bal < 0 ? 'neg' : ''}">${money(bal, a.currency)}</div></div></div>`;
}
function vHome() {
  const w = worth(), mt = monthTotals(thisMonth()), up = upcoming(45), b = balances();
  const nm = String(S.user?.user_metadata?.own_names || '').split(',')[0].trim().split(' ')[0] || 'Blu';
  const hidden = !!S.settings.hideAmounts;
  const whole = hidden ? money(w.net) : money(w.net).replace(/\.\d\d$/, ''), cents = hidden ? '' : money(w.net).slice(-3);
  const accAll = activeAccounts().slice().sort((x, y) => (b[x.id] * (rate(x.currency) ?? 0)) - (b[y.id] * (rate(y.currency) ?? 0)));
  const accs = accAll.some(a => Math.abs(b[a.id]) > 0.004) ? accAll.filter(a => Math.abs(b[a.id]) > 0.004) : accAll;   // smallest first, biggest in front
  const recent = S.d.transactions.filter(tagOK).sort((x, y) => y.date.localeCompare(x.date) || (y.created_at || '').localeCompare(x.created_at || '')).slice(0, 4);
  const mtx = txInMonth(thisMonth()).filter(tagOK), nIn = mtx.filter(t => t.kind === 'income').length, nOut = mtx.filter(t => t.kind === 'expense').length;
  const tot = mt.inc + mt.out, pIn = tot ? Math.round(mt.inc / tot * 100) : 0, pOut = tot ? 100 - pIn : 0;
  const nBud = S.d.budgets.filter(x => x.month.startsWith(thisMonth()) && num(x.amount) > 0).length;
  const quick = topCats('expense', 4);
  const plural = (n, w1) => `${n} ${w1}${n === 1 ? '' : 's'}`;
  return `<div class="hello only-desk"><div class="hi cap">${new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</div><div class="nm">Hello, ${esc(nm)}!</div></div>`
  + (isDemo() && !S.settings.hideBanner ? `<div class="demo-banner" role="note"><span><b>You're looking at demo data.</b> Every number and notification here is a made-up sample, stored only in this browser.</span><button data-a="hideBanner" aria-label="Hide this note">${IC('x', 'sm')}</button></div>` : '')
  + `<div class="hg">
    <section class="card hero balance c7" style="--o:1">
      <div class="bh"><span class="cap k">Total balance</span><span class="grow"></span>
        <button class="eye" data-a="toggleHide" aria-label="${hidden ? 'Show amounts' : 'Hide amounts'}" aria-pressed="${hidden}">${IC(hidden ? 'eye-off' : 'eye', 'sm')}</button></div>
      <div class="v ${w.net < 0 ? 'neg' : ''}">${whole}<small>${cents}</small></div>
      <div class="bfoot">${w.owe < 0 ? `<span class="chip owe">${IC('trending-down', 'sm')} You owe ${money(-w.owe)}</span>` : `<span class="chip">${IC('shield-check', 'sm')} Nothing owed</span>`}${tagChips()}</div>
      ${w.missing.length ? `<div class="fine">Excludes ${w.missing.join(', ')} · <a href="#settings">set rate</a></div>` : ''}
      <div class="hq only-desk"><button class="btn pri" data-a="addTx">${IC('plus', 'sm')} Add</button><button class="btn" data-a="scan">${IC('scan-line', 'sm')} Scan</button><button class="btn" data-a="addTransfer">${IC('arrow-left-right', 'sm')} Transfer</button><a class="btn" href="#bills">${IC('receipt', 'sm')} Pay bill</a></div>
    </section>
    <section class="card summ c5" style="--o:5">
      <div class="sh"><b class="cap">Summary</b><span class="pill">This month</span><span class="grow"></span><a href="#tx" class="xs">Activity</a></div>
      <div class="sblk inc" style="flex:${Math.max(pIn, 30)}"><span class="ic">${IC('arrow-down-left')}</span>${tot ? `<span class="pct">${pIn}%</span>` : ''}<div class="k cap">Income</div><div class="v">${money(mt.inc)}</div><div class="n">${plural(nIn, 'transaction')}</div></div>
      <div class="sblk exp" style="flex:${Math.max(pOut, 30)}"><span class="ic">${IC('arrow-up-right')}</span>${tot ? `<span class="pct">${pOut}%</span>` : ''}<div class="k cap">Expenses</div><div class="v">${money(mt.out)}</div><div class="n">${plural(nOut, 'transaction')}</div></div>
      <div class="net"><div><div class="k cap">Net cash flow</div><div class="v ${mt.left < 0 ? 'neg' : 'pos'}">${money(mt.left)}</div></div></div>
    </section>
    ${newInbox().length ? `<div class="only-phone c12" style="--o:2">${reviewStrip()}</div><div class="only-desk c12">${tray(4)}</div>` : ''}
    <div class="c12 only-phone" style="--o:3">
      <div class="wstack">${accs.map(a => bankCard(a, b[a.id])).join('')}</div>
      <a class="wlink" href="#accounts">${accAll.length} account${accAll.length === 1 ? '' : 's'} in your wallet ${IC('chevron-right', 'sm')}</a>
    </div>
    <div class="c12 only-desk"><div class="sechead"><b class="cap">Wallet</b><a href="#accounts">See all</a></div>
      <div class="cardgrid">${accs.slice().reverse().map(a => bankCard(a, b[a.id])).join('')}</div></div>
    ${quick.length ? `<div class="qcats c12" style="--o:4">${quick.map(c => `<button data-a="quickCat" data-id="${c.id}"><span>${IC(catLucide(c))}</span><b>${esc(c.name.split(/[ &]/)[0])}</b></button>`).join('')}</div>` : ''}
    <a class="rowlink c12" style="--o:6" href="#budget"><span><b>${nBud ? 'Budgets' : 'Set budgets'}</b>${nBud ? `<small>${nBud} set for ${monthName(thisMonth()).split(' ')[0]}</small>` : '<small>Give every peso a job</small>'}</span>${IC('chevron-right')}</a>
    <div class="${recent.length ? 'c6' : 'c12'}" style="--o:7"><section class="card"><div class="sh"><b class="cap">Upcoming</b><span class="grow"></span><a href="#bills" class="xs">All bills</a></div>
      ${up.length ? `<div class="list">${up.slice(0, 4).map(o => billRow(o)).join('')}</div>` : '<div class="empty1">Nothing due in the next 45 days.</div>'}</section></div>
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
  return head + `<section class="card">${group('Overdue', late)}${group('Next 7 days', soon)}${group('Later', later)}${all.length ? '' : '<div class="empty">No bills yet. Add rent, Meralco, internet, subscriptions…</div>'}</section>
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
  const list = activeAccounts().slice().sort((x, y) => (b[y.id] * (rate(y.currency) ?? 0)) - (b[x.id] * (rate(x.currency) ?? 0)));
  return ph('Wallet', 'Wallet', 'Tap a card to see its activity or match it to your bank app', '<button class="btn pri" data-a="addAccount">+ Add account</button>')
  + `<section class="card hero networth mb"><div class="bh"><span class="cap k">Net worth</span><span class="grow"></span><button class="eye" data-a="toggleHide" aria-label="Hide or show amounts">${IC(S.settings.hideAmounts ? 'eye-off' : 'eye', 'sm')}</button></div>
    <div class="v">${money(w.net)}</div>
    <div class="nw2"><div><span>Assets</span><b>${money(w.own)}</b></div><div><span>Liabilities</span><b>${money(-w.owe)}</b></div></div>
    ${w.missing.length ? `<div class="fine">Not counted: ${w.missing.join(', ')} · <a href="#settings">set rate</a></div>` : ''}</section>
  <div class="cardgrid wallet">${list.map(a => bankCard(a, b[a.id])).join('')}
    <button class="bcard addcard" data-a="addAccount">${IC('plus', 'lg')}<span>Add account</span></button></div>`;
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
            <li><b>Required filter</b>, same screen: text content → <b>Matches</b>, tick <b>Regex</b>, paste:<br><code>(?is)^(?!.*(otp|one.?time|verif|passcode|password|\bpin\b|mpin|do not share)).*(PHP|₱|USD|CAD|SGD|\bP ?[0-9]).*$</code><br>Only money notifications without login words ever leave your phone.</li>
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

    <section class="card"><h2>Exchange rates <small>pesos per 1 unit</small></h2>
      <div class="grid g2" style="gap:8px 16px">${['USD', 'SGD', 'EUR', 'GBP', 'AUD', 'CAD'].map(c => `<label class="f" style="flex-direction:row;align-items:center;gap:10px"><span style="width:40px">${c}</span><input inputmode="decimal" value="${S.settings.rates[c] ?? ''}" placeholder="not set" data-c="rate" data-cur="${c}" style="width:100%"></label>`).join('')}</div>
      <p class="xs faint" style="margin:10px 0 0">USD starts at ₱62, the rate the Daybreak map uses. Update it to today's rate.</p></section>

    <section class="card"><h2>Categories <small><a href="#" data-a="addCat">+ Add</a></small></h2>
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
const accOptions = (sel, allowEmpty) => (allowEmpty ? '<option value="">—</option>' : '') + activeAccounts().map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}${a.currency !== 'PHP' ? ' (' + a.currency + ')' : ''}</option>`).join('');
const catOptions = (kind, sel) => '<option value="">Uncategorised</option>' + catsOf(kind).map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.name)}</option>`).join('');
const segTag = v => `<div class="seg" data-seg="tag" role="group" aria-label="Personal or Daybreak">${[['personal', 'Personal'], ['daybreak', 'Daybreak 🌅']].map(([k, l]) => `<button type="button" class="${v === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>`;
const amountField = (name, val, cur) => `<div class="amount-wrap"><span class="cur" data-cur>${SYM[cur] || cur}</span><input class="amount-in" name="${name}" inputmode="decimal" placeholder="0.00" value="${val != null ? num(val).toFixed(2) : ''}" autofocus aria-label="Amount"></div>`;

let txCtx = null;
function txForm(t = {}, ctx = {}) {
  txCtx = ctx;
  const kind = t.kind || 'expense', accId = t.account_id || activeAccounts()[0]?.id;
  modal(t.id ? 'Edit transaction' : ctx.inboxId ? 'Review notification' : 'Add transaction', `<form class="form" id="txf" data-kind="${kind}" onsubmit="return false">

    <div class="seg" data-seg="kind" role="group" aria-label="Type">${[['expense', 'Expense', 'e'], ['income', 'Income', 'i'], ['transfer', 'Transfer', 't']].map(([k, l, c]) => `<button type="button" class="${c} ${kind === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
    ${amountField('amount', t.amount, curOf(accId))}
    <div id="catBlock"><div class="lbl" style="margin-bottom:6px">Category</div><div class="catpick" id="catpick"></div>
      <select name="category_id" style="margin-top:8px;width:100%" aria-label="All categories">${catOptions(kind === 'transfer' ? 'expense' : kind, t.category_id)}</select>
      <div class="hint" id="guessHint" style="margin-top:4px"></div></div>
    <div class="two"><label class="f"><span id="accLbl">Account</span><select name="account_id">${accOptions(accId)}</select></label>
      <label class="f" id="toWrap">To account<select name="to_account_id">${accOptions(t.to_account_id, true)}</select></label></div>
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
  $('#saveTxBtn').textContent = txCtx?.inboxId ? 'Approve' : { expense: 'Save expense', income: 'Save income', transfer: 'Save transfer' }[kind];
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

function billForm(b = {}) {
  modal(b.id ? 'Edit bill' : 'Add bill', `<form class="form" id="billf" onsubmit="return false">
    <label class="f">Name<input name="name" value="${esc(b.name || '')}" placeholder="e.g. Meralco, PLDT, Rent" autofocus></label>
    <div class="two"><label class="f">Amount (₱)<input name="amount" inputmode="decimal" value="${b.amount != null ? num(b.amount).toFixed(2) : ''}"></label>
      <label class="f">Next due date<input type="date" name="due_date" value="${b.due_date || today()}"></label></div>
    <div class="two"><label class="f">Repeats<select name="repeat">${['monthly', 'weekly', 'quarterly', 'yearly', 'none'].map(r => `<option value="${r}" ${(b.repeat || 'monthly') === r ? 'selected' : ''}>${r === 'none' ? 'One-off' : r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select></label>
      <label class="f">Category<select name="category_id">${catOptions('expense', b.category_id)}</select></label></div>
    <label class="f">Usually paid from<select name="account_id">${accOptions(b.account_id, true)}</select></label>
    <label class="f">Note<input name="note" value="${esc(b.note || '')}"></label>
    <label class="row small muted" style="gap:8px"><input type="checkbox" name="autopay" ${b.autopay ? 'checked' : ''}> Auto-pay (charged automatically)</label>
    ${segTag(b.tag || 'personal')}
  </form>`, `${b.id ? `<button class="btn danger left" data-a="delBill" data-id="${b.id}">Delete</button>` : ''}<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="saveBill" data-id="${b.id || ''}">Save bill</button>`);
}

function payForm(b, date) {
  const accId = b.account_id || activeAccounts()[0]?.id, cur = curOf(accId), r = rate(cur);
  const amt0 = cur === 'PHP' || !r ? num(b.amount) : num(b.amount) / r;
  modal('Pay ' + b.name, `<form class="form" id="payf" onsubmit="return false">
    ${amountField('amount', amt0, cur)}
    <div class="two"><label class="f">Paid from<select name="account_id">${accOptions(accId)}</select></label><label class="f">Date paid<input type="date" name="date" value="${today()}"></label></div>
    <div class="callout">${b.repeat === 'none' ? 'This one-off bill will be marked paid.' : `Next due date moves to <b>${shortDate(nextDate(date, b.repeat))}</b>.`}${b.note ? `<div class="xs faint" style="margin-top:6px">${esc(b.note)}</div>` : ''}</div>
  </form>`, `<button class="btn ghost" data-a="close">Cancel</button><button class="btn pri" data-a="confirmPay" data-id="${b.id}" data-date="${date}">Log payment</button>`);
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
  pennySend: () => pennySend($('#pennyIn')?.value),
  pennyScan: () => pennyScan(),
  pennySave: el => { const m = S.penny[Number(el.dataset.i)]; if (!m?.scan) return; scanResult = m.scan; m.saved = true; savePenny(); showScan(m.scan); },
  pennyClear: () => { S.penny = []; savePenny(); render(); },
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
      <button data-a="addTransfer"><span class="b">${IC('arrow-left-right')}</span><b>Transfer</b><small>Between your accounts</small></button>
      <button data-a="scanFromSheet"><span class="b gold">${IC('scan-line')}</span><b>Scan</b><small>Receipt, bill or statement</small></button>
      <a href="#bills" data-a="close" class="wide"><span class="b">${IC('receipt')}</span><b>Pay a bill</b><small>Log a bill payment</small></a>
    </div>`),
  addKind: el => { closeModal(); if (!activeAccounts().length) return (toast('Add an account first'), accountForm()); txForm({ kind: el.dataset.v }); },
  scanFromSheet: () => { closeModal(); scanPick(); },
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
  toggleHide: () => { S.settings.hideAmounts = !S.settings.hideAmounts; saveSettings(); render(); },
  quickCat: el => { if (!activeAccounts().length) return (toast('Add an account first'), accountForm()); txForm({ kind: 'expense', category_id: el.dataset.id }); },
  cardMenu: el => { const a = acc(el.dataset.id), bal = balances()[a.id]; modal(a.name, `<div class="cardmenu">${bankCard(a, bal)}<div class="xs faint" style="text-align:center;margin:10px 0 4px">${matchedLabel(a.id)}</div>
      <div class="addgrid"><button data-a="cardActivity" data-id="${a.id}"><span class="b">${IC('activity')}</span><b>Activity</b><small>Everything in ${esc(a.name)}</small></button>
      <button data-a="matchAccount" data-id="${a.id}"><span class="b gold">${IC('scale')}</span><b>Match balance</b><small>Line up with your bank app</small></button>
      <button data-a="editAccount" data-id="${a.id}" class="wide"><span class="b">${IC('pencil')}</span><b>Edit account</b><small>Name, type, auto-detect</small></button></div></div>`); },
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
    const v = form('#billf'); if (!v.name.trim()) return toast('Give the bill a name');
    const row = { name: v.name.trim(), amount: amt(v.amount), due_date: v.due_date, repeat: v.repeat, category_id: v.category_id || null, account_id: v.account_id || null, note: v.note || null, autopay: !!v.autopay, tag: segVal('tag') || 'personal', active: true };
    await safe(() => el.dataset.id ? DB.update('bills', el.dataset.id, row) : DB.insert('bills', row));
    closeModal(); render();
  },
  async delBill(el) { if (!confirm('Delete this bill? Past payments stay in your transactions.')) return; await safe(() => DB.remove('bills', el.dataset.id)); closeModal(); render(); },
  payBill: el => { if (!activeAccounts().length) return toast('Add an account first'); payForm(S.d.bills.find(b => b.id === el.dataset.id), el.dataset.date); },
  async confirmPay(el) {
    const b = S.d.bills.find(x => x.id === el.dataset.id), v = form('#payf'), amount = amt(v.amount);
    if (!(amount > 0)) return toast('Enter an amount');
    await safe(async () => {
      await DB.insert('transactions', { kind: 'expense', amount, date: v.date, account_id: v.account_id, category_id: b.category_id, note: b.name, tag: b.tag, bill_id: b.id });
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
  const { p, a, date, xfer, ready } = inboxCheck(it); if (!p.ok || !a || !ready) return;
  const note = p.party || it.title || BANKS[bankOf(it)]?.name;
  await safe(async () => {
    const row = xfer
      ? { kind: 'transfer', amount: p.amount, date, account_id: xfer.from.id, to_account_id: xfer.to.id, note: `Transfer to ${xfer.to.name}`, tag: 'personal', inbox_id: it.id }
      : { kind: p.kind, amount: p.amount, date, account_id: a.id, note, category_id: guessCategory(note, p.kind), tag: 'personal', inbox_id: it.id };
    const [t] = await DB.insert('transactions', row);
    await DB.update('inbox', it.id, { status: 'done', transaction_id: t.id });
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
    S.sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') showLogin(); });
  }
  try { await DB.load(); await seedIfEmpty(); await loadKeyStatus(); }
  catch (e) { console.error(e); return gate(`<p class="warn">Could not load your data: ${esc(e.message || e)}</p><p class="xs muted">If this is a new project, run schema.sql in the Supabase SQL editor first.</p><button class="btn" data-a="disconnect">Back</button>`); }
  render();
  if (!isDemo()) setInterval(async () => {
    if (document.hidden || $('#modal-root').innerHTML) return;
    try { const before = newInbox().length; S.d.inbox = await fetchAll('inbox'); if (newInbox().length !== before) render(); } catch { /* offline */ }
  }, 60000);
}
// Auto-update: phones keep an old copy of the page for a while. On open (and when the app comes back
// to the foreground) fetch index.html fresh; if it names a newer app.js version, reload once.
async function checkForUpdate() {
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
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
checkForUpdate();
boot();

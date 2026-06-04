const CATEGORIES = [
  { id: 'vivienda',         label: 'Vivienda',          emoji: '🏠' },
  { id: 'alimentación',     label: 'Alimentación',       emoji: '🛒' },
  { id: 'transporte',       label: 'Transporte',         emoji: '🚗' },
  { id: 'salud',            label: 'Salud',              emoji: '💊' },
  { id: 'educación',        label: 'Educación',          emoji: '📚' },
  { id: 'entretenimiento',  label: 'Entretenimiento',    emoji: '🎬' },
  { id: 'ropa',             label: 'Ropa',               emoji: '👕' },
  { id: 'servicios_basicos',label: 'Servicios Básicos',  emoji: '💡' },
  { id: 'ahorro',           label: 'Ahorro',             emoji: '💰' },
  { id: 'ingreso_laboral',  label: 'Ingreso Laboral',    emoji: '💼' },
  { id: 'ingreso_extra',    label: 'Ingreso Extra',       emoji: '💵' },
  { id: 'otro',             label: 'Otro',               emoji: '📦' },
];

const EXPENSE_CATEGORIES = CATEGORIES.filter(c =>
  !['ingreso_laboral','ingreso_extra'].includes(c.id)
);

const CHART_COLORS = [
  '#58a6ff','#2ea043','#f85149','#d29922','#a371f7',
  '#ff7b72','#79c0ff','#56d364','#ffa657','#e3b341'
];

let currentPhone = '';
let currentMonth = '';
let transactions = [];
let budgets = [];
let donutChart = null;
let lineChart = null;

// ===================== UTILITIES =====================

function formatCLP(amount) {
  return `$${Number(amount).toLocaleString('es-CL')}`;
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const date = new Date(+y, +m - 1, 1);
  return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

function getCurrentMonthYear() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }).substring(0, 7);
}

function todayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.toLocaleDateString('en-CA').substring(0, 7);
}

function normalizePhone(input) {
  let p = input.replace(/\s/g, '');
  if (!p.startsWith('whatsapp:')) {
    if (!p.startsWith('+')) p = '+' + p;
    p = 'whatsapp:' + p;
  }
  return p;
}

function catInfo(id) {
  return CATEGORIES.find(c => c.id === id) || { label: id, emoji: '📦' };
}

// ===================== TOAST =====================

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ===================== LOGIN =====================

function init() {
  const saved = localStorage.getItem('cf_phone');
  if (saved) {
    currentPhone = saved;
    showApp();
  }

  document.getElementById('login-btn').addEventListener('click', () => {
    const input = document.getElementById('phone-input').value.trim();
    if (!input) return toast('Ingresa tu número de teléfono', 'error');
    currentPhone = normalizePhone(input);
    localStorage.setItem('cf_phone', currentPhone);
    showApp();
  });

  document.getElementById('phone-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('prev-month').addEventListener('click', () => setMonth(shiftMonth(currentMonth, -1)));
  document.getElementById('next-month').addEventListener('click', () => setMonth(shiftMonth(currentMonth, 1)));
  document.getElementById('refresh-btn').addEventListener('click', loadAll);

  document.getElementById('filter-type').addEventListener('change', renderTransactions);
  document.getElementById('filter-category').addEventListener('change', renderTransactions);
  document.getElementById('add-transaction-btn').addEventListener('click', openAddModal);
  document.getElementById('save-budgets-btn').addEventListener('click', saveBudgets);

  document.getElementById('edit-cancel-btn').addEventListener('click', closeModals);
  document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
  document.getElementById('add-cancel-btn').addEventListener('click', closeModals);
  document.getElementById('add-save-btn').addEventListener('click', saveAdd);

  [document.getElementById('edit-modal'), document.getElementById('add-modal')].forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) closeModals(); });
  });

  populateCategorySelects();
  populateFilterCategories();
}

function showApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-phone-badge').textContent = currentPhone;
  currentMonth = getCurrentMonthYear();
  updateMonthLabel();
  loadAll();
}

function logout() {
  localStorage.removeItem('cf_phone');
  currentPhone = '';
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('phone-input').value = '';
}

function setMonth(ym) {
  currentMonth = ym;
  updateMonthLabel();
  loadAll();
}

function updateMonthLabel() {
  document.getElementById('current-month-label').textContent = formatMonth(currentMonth);
}

// ===================== DATA LOADING =====================

async function loadAll() {
  try {
    const [txData, budgetData, summaryData, monthlyData] = await Promise.all([
      apiFetch(`/api/transactions?phone=${enc(currentPhone)}&month=${currentMonth}`),
      apiFetch(`/api/budgets?phone=${enc(currentPhone)}&month=${currentMonth}`),
      apiFetch(`/api/summary?phone=${enc(currentPhone)}&month=${currentMonth}`),
      apiFetch(`/api/monthly-totals?phone=${enc(currentPhone)}`)
    ]);

    transactions = txData;
    budgets = budgetData;

    renderSummaryCards(summaryData);
    renderTransactions();
    renderBudgetTable(summaryData);
    renderBudgetForm();
    renderDonutChart(summaryData);
    renderLineChart(monthlyData);
  } catch (err) {
    toast('Error cargando datos: ' + err.message, 'error');
  }
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function enc(s) { return encodeURIComponent(s); }

// ===================== RENDER =====================

function renderSummaryCards(summary) {
  document.getElementById('total-ingresos').textContent = formatCLP(summary.ingresos || 0);
  document.getElementById('total-gastos').textContent = formatCLP(summary.gastos || 0);

  const balance = summary.balance || 0;
  const balEl = document.getElementById('total-balance');
  balEl.textContent = formatCLP(balance);
  balEl.style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';

  const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const pctEl = document.getElementById('budget-pct');
  if (totalBudget > 0) {
    const pct = Math.round((summary.gastos / totalBudget) * 100);
    pctEl.textContent = `${pct}%`;
    pctEl.style.color = pct < 80 ? 'var(--green)' : pct < 100 ? 'var(--yellow)' : 'var(--red)';
  } else {
    pctEl.textContent = '—';
    pctEl.style.color = '';
  }
}

function renderBudgetTable(summary) {
  const tbody = document.getElementById('budget-tbody');
  if (!budgets.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Sin presupuestos configurados</td></tr>';
    return;
  }

  const byCategory = summary.by_category || {};

  tbody.innerHTML = budgets.map(b => {
    const gastado = (byCategory[b.category]?.gasto) || 0;
    const diff = b.monthly_limit - gastado;
    const pct = Math.round((gastado / b.monthly_limit) * 100);
    const cls = pct < 80 ? 'ok' : pct < 100 ? 'warn' : 'over';
    const cat = catInfo(b.category);
    const fillPct = Math.min(pct, 100);

    return `<tr>
      <td>${cat.emoji} ${cat.label}</td>
      <td class="num">${formatCLP(b.monthly_limit)}</td>
      <td class="num">${formatCLP(gastado)}</td>
      <td class="num ${diff >= 0 ? 'diff-positive' : 'diff-negative'}">${formatCLP(diff)}</td>
      <td class="num">
        <div class="progress-bar-wrap">
          <div class="progress-bar"><div class="progress-fill fill-${cls}" style="width:${fillPct}%"></div></div>
          <span class="status-${cls}">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  const typeFilter = document.getElementById('filter-type').value;
  const catFilter = document.getElementById('filter-category').value;

  const filtered = transactions.filter(t =>
    (!typeFilter || t.type === typeFilter) &&
    (!catFilter || t.category === catFilter)
  );

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Sin transacciones</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const cat = catInfo(t.category);
    const amtClass = t.type === 'ingreso' ? 'amount-income' : 'amount-expense';
    const sign = t.type === 'ingreso' ? '+' : '-';
    return `<tr>
      <td>${t.transaction_date}</td>
      <td>${cat.emoji} <strong>${t.description || ''}</strong>
        <span style="color:var(--text-muted);font-size:11px;"> · ${cat.label}</span>
      </td>
      <td class="num ${amtClass}">${sign}${formatCLP(t.amount)}</td>
      <td>
        <button class="btn-edit" onclick="openEditModal('${t.id}')" title="Editar">✏️</button>
        <button class="btn-delete" onclick="confirmDelete('${t.id}')" title="Eliminar">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function renderBudgetForm() {
  const grid = document.getElementById('budget-form-grid');
  const budgetMap = {};
  budgets.forEach(b => { budgetMap[b.category] = b.monthly_limit; });

  grid.innerHTML = EXPENSE_CATEGORIES.map(cat => `
    <div class="budget-form-item">
      <label>
        <div class="budget-label-row">${cat.emoji} ${cat.label}</div>
      </label>
      <input
        type="number"
        class="budget-input"
        data-category="${cat.id}"
        placeholder="0"
        value="${budgetMap[cat.id] || ''}"
        min="0"
      />
    </div>
  `).join('');
}

function renderDonutChart(summary) {
  const byCategory = summary.by_category || {};
  const labels = [];
  const data = [];
  const colors = [];
  let ci = 0;

  Object.entries(byCategory)
    .filter(([, v]) => v.gasto > 0)
    .sort((a, b) => b[1].gasto - a[1].gasto)
    .forEach(([cat, v]) => {
      const c = catInfo(cat);
      labels.push(`${c.emoji} ${c.label}`);
      data.push(v.gasto);
      colors.push(CHART_COLORS[ci++ % CHART_COLORS.length]);
    });

  const ctx = document.getElementById('donut-chart').getContext('2d');
  if (donutChart) donutChart.destroy();

  if (!data.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#161b22' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#e6edf3', font: { size: 12 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCLP(ctx.parsed)}`
          }
        }
      }
    }
  });
}

function renderLineChart(monthlyData) {
  const labels = monthlyData.map(m => {
    const [y, mo] = m.month.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
  });

  const ctx = document.getElementById('line-chart').getContext('2d');
  if (lineChart) lineChart.destroy();

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: monthlyData.map(m => m.ingresos),
          borderColor: '#2ea043', backgroundColor: 'rgba(46,160,67,0.1)',
          tension: 0.3, fill: true, pointRadius: 4
        },
        {
          label: 'Gastos',
          data: monthlyData.map(m => m.gastos),
          borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)',
          tension: 0.3, fill: true, pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e6edf3', font: { size: 12 } } },
        tooltip: {
          callbacks: { label: ctx => ` ${formatCLP(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
        y: { ticks: { color: '#8b949e', callback: v => formatCLP(v) }, grid: { color: '#30363d' } }
      }
    }
  });
}

// ===================== CATEGORY SELECTS =====================

function populateCategorySelects() {
  ['edit-category', 'add-category'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = CATEGORIES.map(c =>
      `<option value="${c.id}">${c.emoji} ${c.label}</option>`
    ).join('');
  });
}

function populateFilterCategories() {
  const sel = document.getElementById('filter-category');
  const options = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.emoji} ${c.label}</option>`
  ).join('');
  sel.innerHTML = '<option value="">Todas las categorías</option>' + options;
}

// ===================== MODALS =====================

function openEditModal(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  document.getElementById('edit-id').value = t.id;
  document.getElementById('edit-description').value = t.description || '';
  document.getElementById('edit-amount').value = t.amount;
  document.getElementById('edit-type').value = t.type;
  document.getElementById('edit-category').value = t.category;
  document.getElementById('edit-date').value = t.transaction_date;

  document.getElementById('edit-modal').classList.remove('hidden');
}

function openAddModal() {
  document.getElementById('add-description').value = '';
  document.getElementById('add-amount').value = '';
  document.getElementById('add-type').value = 'gasto';
  document.getElementById('add-category').value = 'alimentación';
  document.getElementById('add-date').value = todayDate();

  document.getElementById('add-modal').classList.remove('hidden');
}

function closeModals() {
  document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('add-modal').classList.add('hidden');
}

async function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const description = document.getElementById('edit-description').value.trim();
  const amount = parseInt(document.getElementById('edit-amount').value);
  const type = document.getElementById('edit-type').value;
  const category = document.getElementById('edit-category').value;
  const transaction_date = document.getElementById('edit-date').value;

  if (!description || !amount || !transaction_date) return toast('Completa todos los campos', 'error');

  try {
    await apiFetch(`/api/transactions/${id}?phone=${enc(currentPhone)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount, type, category, transaction_date })
    });
    closeModals();
    toast('Transacción actualizada', 'success');
    await loadAll();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function saveAdd() {
  const description = document.getElementById('add-description').value.trim();
  const amount = parseInt(document.getElementById('add-amount').value);
  const type = document.getElementById('add-type').value;
  const category = document.getElementById('add-category').value;
  const transaction_date = document.getElementById('add-date').value;

  if (!description || !amount || !transaction_date) return toast('Completa todos los campos', 'error');

  try {
    await apiFetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_phone: currentPhone,
        description, amount, type, category, transaction_date,
        month_year: transaction_date.substring(0, 7)
      })
    });
    closeModals();
    toast('Transacción agregada', 'success');
    await loadAll();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function confirmDelete(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;
  if (!confirm(`¿Eliminar "${t.description}" (${formatCLP(t.amount)})?`)) return;

  try {
    await apiFetch(`/api/transactions/${id}?phone=${enc(currentPhone)}`, { method: 'DELETE' });
    toast('Transacción eliminada', 'success');
    await loadAll();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function saveBudgets() {
  const inputs = document.querySelectorAll('.budget-input');
  const promises = [];

  inputs.forEach(input => {
    const value = parseInt(input.value);
    if (value > 0) {
      promises.push(apiFetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_phone: currentPhone,
          category: input.dataset.category,
          monthly_limit: value,
          month_year: currentMonth
        })
      }));
    }
  });

  if (!promises.length) return toast('Ingresa al menos un monto de presupuesto', 'error');

  try {
    await Promise.all(promises);
    toast('Presupuestos guardados y notificados por WhatsApp', 'success');
    await loadAll();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ===================== BOOT =====================

document.addEventListener('DOMContentLoaded', init);

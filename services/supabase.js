const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getTransactions(userPhone, monthYear = null, limit = null) {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_phone', userPhone)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (monthYear) query = query.eq('month_year', monthYear);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createTransaction(data) {
  const { data: result, error } = await supabase
    .from('transactions')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

async function updateTransaction(id, data) {
  const { data: result, error } = await supabase
    .from('transactions')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

async function getLastTransaction(userPhone) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_phone', userPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getTransactionById(id) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function getBudgets(userPhone, monthYear = null) {
  let query = supabase.from('budgets').select('*').eq('user_phone', userPhone);
  if (monthYear) query = query.eq('month_year', monthYear);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function upsertBudget(data) {
  const { data: result, error } = await supabase
    .from('budgets')
    .upsert(data, { onConflict: 'user_phone,category,month_year' })
    .select()
    .single();
  if (error) throw error;
  return result;
}

async function getSummary(userPhone, monthYear) {
  const transactions = await getTransactions(userPhone, monthYear);

  const ingresos = transactions
    .filter(t => t.type === 'ingreso')
    .reduce((sum, t) => sum + t.amount, 0);
  const gastos = transactions
    .filter(t => t.type === 'gasto')
    .reduce((sum, t) => sum + t.amount, 0);

  const by_category = {};
  transactions.forEach(t => {
    if (!by_category[t.category]) by_category[t.category] = { ingreso: 0, gasto: 0 };
    by_category[t.category][t.type] += t.amount;
  });

  return { ingresos, gastos, balance: ingresos - gastos, by_category, transaction_count: transactions.length };
}

async function getMonthlyTotals(userPhone) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }).substring(0, 7));
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('month_year, type, amount')
    .eq('user_phone', userPhone)
    .gte('month_year', months[0])
    .lte('month_year', months[months.length - 1]);

  if (error) throw error;

  return months.map(m => {
    const mt = (data || []).filter(t => t.month_year === m);
    const ingresos = mt.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
    const gastos = mt.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
    return { month: m, ingresos, gastos };
  });
}

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getLastTransaction,
  getTransactionById,
  getBudgets,
  upsertBudget,
  getSummary,
  getMonthlyTotals
};

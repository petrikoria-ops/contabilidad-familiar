const express = require('express');
const router = express.Router();
const db = require('../services/supabase');

function formatCLP(n) { return '$' + n.toLocaleString('es-CL'); }

router.get('/transactions', async (req, res) => {
  try {
    const data = await db.getTransactions(req.query.phone, req.query.month || null);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/transactions', async (req, res) => {
  try {
    const d = { ...req.body };
    if (d.transaction_date && !d.month_year) d.month_year = d.transaction_date.substring(0,7);
    res.status(201).json(await db.createTransaction(d));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/transactions/:id', async (req, res) => {
  try {
    const d = { ...req.body };
    if (d.transaction_date) d.month_year = d.transaction_date.substring(0,7);
    res.json(await db.updateTransaction(req.params.id, d));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    await db.deleteTransaction(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/budgets', async (req, res) => {
  try {
    res.json(await db.getBudgets(req.query.phone, req.query.month || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/budgets', async (req, res) => {
  try {
    res.status(201).json(await db.upsertBudget(req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    res.json(await db.getSummary(req.query.phone, req.query.month || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/monthly-totals', async (req, res) => {
  try {
    res.json(await db.getMonthlyTotals(req.query.phone));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
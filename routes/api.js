const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
  getBudgets,
  upsertBudget,
  getSummary,
  getMonthlyTotals
} = require('../services/supabase');
const { sendWhatsApp } = require('../services/twilio');

function formatCLP(amount) {
  return `$${amount.toLocaleString('es-CL')}`;
}

// GET /api/transactions?phone=&month=
router.get('/transactions', async (req, res) => {
  try {
    const { phone, month } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone requerido' });
    const data = await getTransactions(phone, month || null);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/transactions', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.transaction_date && !data.month_year) {
      data.month_year = data.transaction_date.substring(0, 7);
    }
    const result = await createTransaction(data);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/transactions/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.transaction_date) {
      data.month_year = data.transaction_date.substring(0, 7);
    }
    const result = await updateTransaction(req.params.id, data);

    if (req.query.phone) {
      sendWhatsApp(
        req.query.phone,
        `✏️ Transacción editada: ${result.description} → ${formatCLP(result.amount)}`
      ).catch(console.error);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id?phone=
router.delete('/transactions/:id', async (req, res) => {
  try {
    const transaction = await getTransactionById(req.params.id);
    await deleteTransaction(req.params.id);

    if (req.query.phone) {
      sendWhatsApp(
        req.query.phone,
        `🗑️ Transacción eliminada: ${transaction.description} ${formatCLP(transaction.amount)}`
      ).catch(console.error);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets?phone=&month=
router.get('/budgets', async (req, res) => {
  try {
    const { phone, month } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone requerido' });
    const data = await getBudgets(phone, month || null);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets
router.post('/budgets', async (req, res) => {
  try {
    const result = await upsertBudget(req.body);

    if (req.body.user_phone) {
      sendWhatsApp(
        req.body.user_phone,
        `📊 Presupuesto actualizado: ${req.body.category} → ${formatCLP(req.body.monthly_limit)}/mes`
      ).catch(console.error);
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summary?phone=&month=
router.get('/summary', async (req, res) => {
  try {
    const { phone, month } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone requerido' });
    const data = await getSummary(phone, month || null);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monthly-totals?phone=
router.get('/monthly-totals', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone requerido' });
    const data = await getMonthlyTotals(phone);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports = router; 

const express = require('express');
const router = express.Router();
const { classifyMessage } = require('../services/gemini');
const {
  createTransaction,
  getTransactions,
  getLastTransaction,
  deleteTransaction,
  getBudgets
} = require('../services/supabase');

const CATEGORY_EMOJIS = {
  vivienda: '🏠', alimentación: '🛒', transporte: '🚗',
  salud: '💊', educación: '📚', entretenimiento: '🎬',
  ropa: '👕', servicios_basicos: '💡', ahorro: '💰',
  ingreso_laboral: '💼', ingreso_extra: '💵', otro: '📦'
};

function formatCLP(amount) {
  return `$${amount.toLocaleString('es-CL')}`;
}

function getCurrentDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function getCurrentMonthYear() {
  return getCurrentDate().substring(0, 7);
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function twimlReply(res, message) {
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`);
}

router.post('/', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body?.trim();

  if (!from || !body) {
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  let reply = '';

  try {
    const classified = await classifyMessage(body, getCurrentDate());

    if (classified.es_comando) {
      const monthYear = classified.mes_consulta || getCurrentMonthYear();
      switch (classified.comando) {
        case 'resumen':    reply = await handleResumen(from, monthYear); break;
        case 'presupuesto': reply = await handlePresupuesto(from, monthYear); break;
        case 'historial':  reply = await handleHistorial(from); break;
        case 'ayuda':      reply = getAyuda(); break;
        case 'borrar':     reply = await handleBorrar(from); break;
        default:           reply = '❓ Comando no reconocido. Escribe *ayuda* para ver las opciones.';
      }
    } else if (classified.tipo && classified.monto) {
      const fecha = classified.fecha || getCurrentDate();
      const monthYear = fecha.substring(0, 7);

      const transaction = await createTransaction({
        user_phone: from,
        type: classified.tipo,
        amount: classified.monto,
        category: classified.categoria || 'otro',
        description: classified.descripcion || body,
        transaction_date: fecha,
        month_year: monthYear
      });

      const emoji = classified.tipo === 'ingreso' ? '💚' : '❤️';
      const catEmoji = CATEGORY_EMOJIS[classified.categoria] || '📦';
      reply = `${emoji} *${classified.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado*\n${catEmoji} ${transaction.description}\n💵 ${formatCLP(classified.monto)}\n📅 ${fecha}`;

      if (classified.tipo === 'gasto') {
        const [budgets, transactions] = await Promise.all([
          getBudgets(from, monthYear),
          getTransactions(from, monthYear)
        ]);
        const b = budgets.find(b => b.category === classified.categoria);
        if (b) {
          const spent = transactions
            .filter(t => t.type === 'gasto' && t.category === classified.categoria)
            .reduce((s, t) => s + t.amount, 0);
          if (spent > b.monthly_limit) {
            reply += `\n\n⚠️ *Presupuesto excedido* en ${classified.categoria} por ${formatCLP(spent - b.monthly_limit)}`;
          } else if (spent / b.monthly_limit >= 0.8) {
            reply += `\n\n⚠️ *Alerta:* llevas el ${Math.round(spent / b.monthly_limit * 100)}% del presupuesto de ${classified.categoria}`;
          }
        }
      }
    } else {
      reply = '❓ No pude procesar tu mensaje. Intenta con: "pagué 5000 de almuerzo" o escribe *ayuda*.';
    }
  } catch (err) {
    console.error('Webhook error:', err);
    reply = '😔 Ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.';
  }

  twimlReply(res, reply);
});

async function handleResumen(phone, monthYear) {
  const transactions = await getTransactions(phone, monthYear);
  if (transactions.length === 0) return `📊 Sin transacciones para ${monthYear}.`;

  const ingresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const gastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
  const balance = ingresos - gastos;

  const gastosCat = {};
  transactions.filter(t => t.type === 'gasto').forEach(t => {
    gastosCat[t.category] = (gastosCat[t.category] || 0) + t.amount;
  });

  let msg = `📊 *Resumen ${monthYear}*\n\n`;
  msg += `💚 Ingresos: ${formatCLP(ingresos)}\n`;
  msg += `❤️ Gastos:   ${formatCLP(gastos)}\n`;
  msg += `${balance >= 0 ? '✅' : '⚠️'} Balance:  ${formatCLP(balance)}\n`;

  if (Object.keys(gastosCat).length > 0) {
    msg += `\n*Gastos por categoría:*\n`;
    Object.entries(gastosCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, total]) => {
        msg += `${CATEGORY_EMOJIS[cat] || '📦'} ${cat}: ${formatCLP(total)}\n`;
      });
  }
  return msg;
}

async function handlePresupuesto(phone, monthYear) {
  const [budgets, transactions] = await Promise.all([
    getBudgets(phone, monthYear),
    getTransactions(phone, monthYear)
  ]);

  if (budgets.length === 0) {
    return '📋 No tienes presupuestos configurados. Configúralos desde el dashboard web.';
  }

  const gastosCat = {};
  transactions.filter(t => t.type === 'gasto').forEach(t => {
    gastosCat[t.category] = (gastosCat[t.category] || 0) + t.amount;
  });

  let msg = `📋 *Presupuesto ${monthYear}*\n\n`;
  budgets.forEach(b => {
    const gastado = gastosCat[b.category] || 0;
    const pct = Math.round((gastado / b.monthly_limit) * 100);
    const emoji = pct < 80 ? '✅' : pct < 100 ? '⚠️' : '🚨';
    msg += `${emoji} ${CATEGORY_EMOJIS[b.category] || '📦'} ${b.category}\n`;
    msg += `   ${formatCLP(gastado)} / ${formatCLP(b.monthly_limit)} (${pct}%)\n`;
  });
  return msg;
}

async function handleHistorial(phone) {
  const transactions = await getTransactions(phone, null, 10);
  if (transactions.length === 0) return '📝 No hay transacciones registradas.';

  let msg = `📝 *Últimas ${transactions.length} transacciones*\n\n`;
  transactions.forEach(t => {
    const emoji = t.type === 'ingreso' ? '💚' : '❤️';
    msg += `${emoji} ${t.transaction_date} — ${t.description}: ${formatCLP(t.amount)}\n`;
  });
  return msg;
}

function getAyuda() {
  return `🤖 *Contabilidad Familiar*\n\n` +
    `*Registrar transacciones:*\n` +
    `• "pagué 5000 de almuerzo"\n` +
    `• "gasté 45.000 en supermercado"\n` +
    `• "recibí sueldo 1.200.000"\n` +
    `• "bencina 18000"\n\n` +
    `*Consultas:*\n` +
    `• "resumen" — resumen del mes actual\n` +
    `• "resumen junio" — resumen de un mes\n` +
    `• "presupuesto" — presupuesto vs real\n` +
    `• "historial" — últimas 10 transacciones\n\n` +
    `*Editar:*\n` +
    `• "borrar último" — elimina última transacción\n\n` +
    `💻 Dashboard web disponible en la URL del servidor.`;
}

async function handleBorrar(phone) {
  const last = await getLastTransaction(phone);
  if (!last) return '❌ No hay transacciones para eliminar.';
  await deleteTransaction(last.id);
  return `🗑️ Eliminado: ${last.description} — ${formatCLP(last.amount)} (${last.transaction_date})`;
}

module.exports = router;

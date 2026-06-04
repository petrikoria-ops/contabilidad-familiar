require('dotenv').config();
const express = require('express');
const path = require('path');

const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

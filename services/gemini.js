const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyMessage(message, currentDate) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Eres un asistente de contabilidad personal chilena. Analiza este mensaje y responde ÚNICAMENTE con JSON válido, sin markdown, sin bloques de código, sin texto adicional.

Mensaje: "${message}"
Fecha actual: ${currentDate}

JSON de respuesta (exactamente este formato):
{
  "tipo": "ingreso" o "gasto" o null,
  "monto": número entero en CLP o null,
  "categoria": una de [vivienda, alimentación, transporte, salud, educación, entretenimiento, ropa, servicios_basicos, ahorro, ingreso_laboral, ingreso_extra, otro] o null,
  "descripcion": "texto descriptivo limpio" o null,
  "fecha": "YYYY-MM-DD",
  "es_comando": true o false,
  "comando": "resumen" o "presupuesto" o "historial" o "ayuda" o "borrar" o "editar" o null,
  "mes_consulta": "YYYY-MM" o null,
  "texto_edicion": "instrucción de edición" o null
}

Reglas:
- Montos en CLP: "1.200.000" = 1200000, "45k" = 45000, "mil" = 1000
- Si es transacción, es_comando = false
- Si es resumen/presupuesto/historial/ayuda/borrar/editar, es_comando = true
- "resumen junio" → mes_consulta = "${currentDate.substring(0, 4)}-06"
- "alimentación" incluye supermercado, comida, restaurantes, cafetería
- "ingreso_laboral" para sueldos y salarios
- "servicios_basicos" para luz, agua, gas, internet, teléfono
- Usa la fecha actual si no se especifica otra`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { classifyMessage };

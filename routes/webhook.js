const CATEGORY_KEYWORDS = {
  alimentacion: ['supermercado','jumbo','lider','unimarc','santa isabel','walmart','tottus','acuenta','mayorista','almacen','feria','verduleria','carniceria','panaderia','pasteleria','rotiseria','comida','restaurant','restaurante','cafe','cafeteria','mcdonald','burger king','pizza','sushi','delivery','rappi','pedidosya','uber eats','ifood','sandwich','empanada','almuerzo','once','desayuno','cena','mercado'],
  transporte: ['bencina','combustible','gasolina','copec','shell','esso','petrobras','bp','uber','cabify','didi','beat','metro','bus','micro','taxi','taxibus','estacionamiento','parquimetro','peaje','autobus','pasaje','locomocion','tag','autopista','movil','transfer'],
  servicios_basicos: ['luz','electricidad','agua','gas','internet','telefono','celular','movil','plan','movistar','entel','claro','wom','vtr','cge','enel','metrogas','essal','aguas andinas','essbio','chilectra','frontel','arriendo web','hosting','dominio'],
  vivienda: ['arriendo','renta','dividendo','hipoteca','condominio','gastos comunes','administracion','cuota edificio','mantención','reparacion','plomero','gasfiter','electricista','pintura','mueble','ikea','sodimac','homecenter','easy'],
  salud: ['farmacia','medicamento','remedio','medico','doctor','clinica','hospital','consulta','examen','dentista','optica','lente','cruz verde','salcobrand','ahumada','isapre','fonasa','copago','bono','urgencia','enfermedad','vacuna','fisioterapeuta','kinesiologo','psicologo','psiquiatra'],
  educacion: ['colegio','universidad','instituto','curso','libro','cuaderno','lapiz','matricula','mensualidad','academia','taller','capacitacion','certificacion','udemy','coursera','jardin','kinder','preescolar','guarderia'],
  entretenimiento: ['cine','cinema','netflix','spotify','hbo','disney','amazon prime','youtube premium','juego','videojuego','steam','playstation','xbox','deporte','gimnasio','gym','natacion','futbol','tenis','teatro','concierto','evento','entrada','bar','discoteca','disco','karaoke','bowling','paseo','excursion','turismo','hotel','airbnb'],
  ropa: ['ropa','vestimenta','zapato','zapatilla','tenis','polera','pantalon','falda','vestido','camisa','chaqueta','abrigo','calcetines','ropa interior','falabella','ripley','paris','h&m','zara','forever21','calzado','moda'],
  ahorro: ['ahorro','ahorré','inversión','inversion','deposito','fondo','afp','cuenta ahorro','plazo fijo','acciones','cripto','bitcoin'],
  ingreso_laboral: ['sueldo','salario','remuneracion','liquidacion','pago quincena','honorario','boleta','factura cobrada','me pagaron','pago trabajo','recibí pago'],
  ingreso_extra: ['venta','vendí','vendi','freelance','extra','bono','aguinaldo','devolucion','reembolso','transferencia recibida','regalo','prestamo recibido','dividendo recibido'],
};

const INGRESO_TRIGGERS = ['recibí','recibi','cobré','cobre','me pagaron','gané','gane','vendí','vendi','ingresó','ingreso','depositaron','transferencia recibida','llegó pago','llego pago','sueldo','salario','honorario'];
const GASTO_TRIGGERS = ['pagué','pague','gasté','gaste','compré','compre','fui a','comí','comi','tomé','tome','saqué','saque','transferí','transferi','mandé','mande','envié','envie','cancelé','cancele','abonée','abone','pagamos'];

const MESES = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 };

const COMANDOS_MAP = {
  'resumen': 'resumen', 'summary': 'resumen',
  'presupuesto': 'presupuesto', 'budget': 'presupuesto',
  'historial': 'historial', 'historia': 'historial', 'movimientos': 'historial',
  'ayuda': 'ayuda', 'help': 'ayuda', 'comandos': 'ayuda',
  'borrar': 'borrar', 'eliminar': 'borrar', 'borrar último': 'borrar', 'borrar ultimo': 'borrar',
};

function detectarCategoria(texto) {
  const t = texto.toLowerCase();
  for (const [cat, palabras] of Object.entries(CATEGORY_KEYWORDS)) {
    if (palabras.some(p => t.includes(p))) return cat;
  }
  return null;
}

function extraerMonto(texto) {
  // Patrones: $1.200.000 | 1200000 | 1.200 | 1,200 | 1.2k | 1.2m
  const patterns = [
    /\$\s?(\d{1,3}(?:[.,]\d{3})+)/,   // $1.200.000 o $1,200,000
    /(\d{1,3}(?:[.,]\d{3})+)/,         // 1.200.000
    /(\d+(?:[.,]\d+)?)\s*k\b/i,        // 20k
    /(\d+(?:[.,]\d+)?)\s*m(?:il)?\b/i, // 2mil o 2m
    /\$\s?(\d+)/,                       // $5000
    /(\d{4,})/,                         // 5000+
    /(\d{1,3})/,                        // 500
  ];
  
  for (const pat of patterns) {
    const m = texto.match(pat);
    if (m) {
      let val = m[1].replace(/\./g, '').replace(',', '.');
      if (pat.source.includes('k')) val = parseFloat(val) * 1000;
      else if (pat.source.includes('m(?:il)')) val = parseFloat(val) * 1000;
      else val = parseFloat(val);
      if (val > 0) return Math.round(val);
    }
  }
  return null;
}

function detectarTipo(texto, categoria) {
  const t = texto.toLowerCase();
  if (INGRESO_TRIGGERS.some(p => t.includes(p))) return 'ingreso';
  if (GASTO_TRIGGERS.some(p => t.includes(p))) return 'gasto';
  if (categoria && ['ingreso_laboral','ingreso_extra','ahorro'].includes(categoria)) return 'ingreso';
  return 'gasto'; // default
}

function extraerFecha(texto) {
  const t = texto.toLowerCase();
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  
  if (t.includes('ayer')) {
    hoy.setDate(hoy.getDate() - 1);
    return hoy.toLocaleDateString('en-CA');
  }
  if (t.includes('antier') || t.includes('anteayer')) {
    hoy.setDate(hoy.getDate() - 2);
    return hoy.toLocaleDateString('en-CA');
  }
  
  // "el 15" o "el día 15"
  const diaMatch = t.match(/el\s+(?:d[ií]a\s+)?(\d{1,2})/);
  if (diaMatch) {
    const dia = parseInt(diaMatch[1]);
    if (dia >= 1 && dia <= 31) {
      return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    }
  }
  
  return hoy.toLocaleDateString('en-CA');
}

function extraerDescripcion(texto, monto, categoria) {
  let desc = texto
    .replace(/\$\s?\d{1,3}(?:[.,]\d{3})*/g, '')
    .replace(/\d+(?:[.,]\d+)?\s*k\b/gi, '')
    .replace(/\d{4,}/g, '')
    .replace(/pagué|pague|gasté|gaste|compré|compre|recibi|recibí|cobré|cobre|me pagaron|gané|gane|vendí|vendi|ingresó|fui a/gi, '')
    .replace(/ayer|hoy|antier|anteayer/gi, '')
    .replace(/el\s+d[ií]a\s+\d{1,2}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  return desc || categoria || 'sin descripción';
}

function detectarComando(texto) {
  const t = texto.toLowerCase().trim();
  
  // Exacto
  if (COMANDOS_MAP[t]) return { comando: COMANDOS_MAP[t], mes_consulta: null };
  
  // Resumen con mes
  const resumenMes = t.match(/resumen\s+(?:de\s+)?(\w+)/);
  if (resumenMes) {
    const mesNombre = resumenMes[1].toLowerCase();
    const mesNum = MESES[mesNombre];
    if (mesNum) {
      const año = new Date().getFullYear();
      const mesStr = `${año}-${String(mesNum).padStart(2,'0')}`;
      return { comando: 'resumen', mes_consulta: mesStr };
    }
  }
  
  // Borrar variantes
  if (t.includes('borrar') || t.includes('eliminar') || t.includes('borra el último') || t.includes('quita el ultimo')) {
    return { comando: 'borrar', mes_consulta: null };
  }
  
  // Comandos que empiezan con keyword
  for (const [key, cmd] of Object.entries(COMANDOS_MAP)) {
    if (t.startsWith(key)) return { comando: cmd, mes_consulta: null };
  }
  
  return null;
}

async function classifyMessage(mensaje, fechaActual) {
  const texto = mensaje.trim();
  const t = texto.toLowerCase();

  // 1. Detectar comando
  const cmd = detectarComando(t);
  if (cmd) return { es_comando: true, ...cmd, texto_original: texto };

  // 2. Extraer monto
  const monto = extraerMonto(texto);
  if (!monto || monto <= 0) {
    // Sin monto — puede ser comando no reconocido o texto libre
    return { es_comando: true, comando: 'no_entendido', texto_original: texto };
  }

  // 3. Clasificar
  const categoria = detectarCategoria(texto) || 'otro';
  const tipo = detectarTipo(texto, categoria);
  const fecha = extraerFecha(texto);
  const descripcion = extraerDescripcion(texto, monto, categoria);

  return {
    es_comando: false,
    tipo,
    monto,
    categoria,
    descripcion,
    fecha,
  };
}

module.exports = { classifyMessage };
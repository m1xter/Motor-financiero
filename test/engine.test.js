/* ============================================================
   engine.test.js — Pruebas del motor de cálculo (sin navegador)
   Ejecución:  node test/engine.test.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
const sandbox = { window: {}, console, localStorage: { getItem: () => null, setItem: () => {} }, document: { addEventListener: () => {} } };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

['js/sample-data.js', 'js/csv-parser.js', 'js/classifier.js', 'js/statements.js', 'js/ratios.js', 'js/discriminant.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), sandbox, { filename: f }));

const { CsvParser, Classifier, Statements, Ratios, Discriminant, SampleData } = sandbox.window;

let fallos = 0, total = 0;
function check(nombre, condicion, detalle = '') {
  total++;
  if (condicion) { console.log(`  ✔ ${nombre}`); }
  else { fallos++; console.log(`  ✘ ${nombre} ${detalle}`); }
}
const cerca = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

function motor(csv, opciones = {}) {
  const parsed = CsvParser.parse(csv);
  const cuentas = Classifier.procesar(parsed.entries);
  const estados = Statements.construir(cuentas, opciones);
  const ratios = Ratios.calcular(estados, cuentas);
  const modelo = Discriminant.evaluar(estados, ratios);
  return { parsed, cuentas, estados, ratios, modelo };
}

/* ---------------- 1. Parser de montos ---------------- */
console.log('\n1) Normalización de montos');
check('formato latino 1.234.567,89', cerca(CsvParser.parseAmount('1.234.567,89'), 1234567.89, 0.001));
check('formato anglosajón 1,234,567.89', cerca(CsvParser.parseAmount('1,234,567.89'), 1234567.89, 0.001));
check('decimal con coma 1500,50', cerca(CsvParser.parseAmount('1500,50'), 1500.5, 0.001));
check('miles con punto 18.500', cerca(CsvParser.parseAmount('18.500'), 18500, 0.001));
check('paréntesis como negativo (2.400,00)', cerca(CsvParser.parseAmount('(2.400,00)'), -2400, 0.001));
check('con símbolo de moneda Bs 45.000,00', cerca(CsvParser.parseAmount('Bs 45.000,00'), 45000, 0.001));
check('valor no numérico devuelve null', CsvParser.parseAmount('n/a') === null);

/* ---------------- 2. Detección de delimitadores ---------------- */
console.log('\n2) Detección de delimitadores y encabezados');
[[';', SampleData.solida.csv], [',', SampleData.riesgo.csv], ['|', SampleData.desordenado.csv]].forEach(([d, csv]) => {
  check(`delimitador «${d}» detectado`, CsvParser.parse(csv).delimiter === d);
});
check('fila TOTAL ACTIVO ignorada', !CsvParser.parse(SampleData.desordenado.csv).entries.some(e => /total/i.test(e.nombre)));

/* Archivo del enunciado: id_cuenta, descripcion_cuenta, tipo_saldo, monto, vida_util_anios */
const enun = CsvParser.parse(SampleData.enunciado.csv);
check('columna id_cuenta descartada como nombre', enun.mapa.cuenta === 'descripcion_cuenta');
check('columna monto reconocida como saldo', enun.mapa.saldo === 'monto');
check('columna tipo_saldo reconocida como categoría', enun.mapa.categoria === 'tipo_saldo');
check('columna vida_util_anios reconocida como vida útil', enun.mapa.vidaUtil === 'vida_util_anios');
check('las 14 cuentas del enunciado se leyeron', enun.entries.length === 14, `leídas ${enun.entries.length}`);
const enunciado = motor(SampleData.enunciado.csv);
const gEnun = nombre => enunciado.cuentas.find(c => CsvParser.normalize(c.nombre).includes(nombre)).grupo;
check('categoría Liquidez → Activo Corriente', gEnun('efectivo en caja') === 'ACTIVO_CORRIENTE');
check('categoría Almacen → Activo Corriente', gEnun('inventario de componentes') === 'ACTIVO_CORRIENTE');
check('categoría Derecho_Cobro → Activo Corriente', gEnun('cuentas por cobrar') === 'ACTIVO_CORRIENTE');
check('categoría Inversion → Activo No Corriente', gEnun('maquinaria y equipos') === 'ACTIVO_NO_CORRIENTE');
check('categoría Deuda_Corto → Pasivo Corriente', gEnun('prestamo bancario a 6 meses') === 'PASIVO_CORRIENTE');
check('categoría Deuda_Largo → Pasivo No Corriente', gEnun('hipoteca') === 'PASIVO_NO_CORRIENTE');
check('categoría Propietarios → Patrimonio', gEnun('capital social aportado') === 'PATRIMONIO');
check('Egreso + nombre "Costo de Ventas" → Costo (gana el diccionario)', gEnun('costo de ventas') === 'COSTO');
check('Egreso genérico → Gastos Operativos', gEnun('gastos generales') === 'GASTO_OPERATIVO');
check('ninguna cuenta del enunciado sin clasificar', !enunciado.cuentas.some(c => c.grupo === 'SIN_CLASIFICAR'));
const terrenoEnun = enunciado.cuentas.find(c => c.esTerreno);
check('Terreno (Sede Principal) no se deprecia', terrenoEnun.depreciacionAnual === 0 && terrenoEnun.depreciacionAcumulada === 0);
check('Maquinaria del enunciado: 80000/10 = 8000 anual',
  cerca(enunciado.cuentas.find(c => /maquinaria/i.test(c.nombre)).depreciacionAnual, 8000));
check('activo total del enunciado = 300000', cerca(enunciado.estados.balance.activoTotal, 300000));
check('pasivo total del enunciado = 120000', cerca(enunciado.estados.balance.pasivoTotal, 120000));
check('el enunciado no cuadra y se reporta el descuadre', !enunciado.estados.validacion.cuadra);

/* ---------------- 3. Clasificación ---------------- */
console.log('\n3) Clasificación por liquidez y exigibilidad');
const solida = motor(SampleData.solida.csv);
const grupoDe = nombre => solida.cuentas.find(c => c.nombre.toLowerCase().includes(nombre)).grupo;
check('Bancos → Activo Corriente', grupoDe('bancos') === 'ACTIVO_CORRIENTE');
check('Inventario → Activo Corriente', grupoDe('inventario') === 'ACTIVO_CORRIENTE');
check('Terreno → Activo No Corriente', grupoDe('terreno') === 'ACTIVO_NO_CORRIENTE');
check('Proveedores → Pasivo Corriente', grupoDe('proveedores') === 'PASIVO_CORRIENTE');
check('Hipoteca → Pasivo No Corriente', grupoDe('hipoteca') === 'PASIVO_NO_CORRIENTE');
check('Prestaciones sociales → Pasivo No Corriente', grupoDe('prestaciones') === 'PASIVO_NO_CORRIENTE');
check('Capital social → Patrimonio', grupoDe('capital social') === 'PATRIMONIO');
check('Ventas → Ingresos', solida.cuentas.find(c => c.nombre === 'Ventas').grupo === 'INGRESO');
check('Costo de ventas → Costo', grupoDe('costo de ventas') === 'COSTO');
check('Gastos financieros → Gasto Financiero', grupoDe('gastos financieros') === 'GASTO_FINANCIERO');
check('Provisión para incobrables es cuenta de valuación',
  solida.cuentas.find(c => /incobrables/i.test(c.nombre)).contra === true);
check('ninguna cuenta quedó sin clasificar',
  solida.cuentas.every(c => c.grupo !== 'SIN_CLASIFICAR'),
  JSON.stringify(solida.cuentas.filter(c => c.grupo === 'SIN_CLASIFICAR').map(c => c.nombre)));
check('préstamo bancario a largo plazo se reubica por plazo',
  solida.cuentas.find(c => /prestamo bancario a largo plazo/i.test(c.nombre)).grupo === 'PASIVO_NO_CORRIENTE');

/* ---------------- 4. Depreciación en línea recta ---------------- */
console.log('\n4) Depreciación por línea recta');
const terreno = solida.cuentas.find(c => /^terreno/i.test(c.nombre));
check('el Terreno NO se deprecia', terreno.depreciacionAnual === 0 && terreno.depreciacionAcumulada === 0);
check('el Terreno conserva su valor neto', cerca(terreno.valorNeto, 480000));
const edificio = solida.cuentas.find(c => /edificio/i.test(c.nombre));
check('cuota anual del edificio = (760000-60000)/20 = 35000', cerca(edificio.depreciacionAnual, 35000));
check('acumulada del edificio con 6 años = 210000', cerca(edificio.depreciacionAcumulada, 210000));
check('valor neto del edificio = 550000', cerca(edificio.valorNeto, 550000));
const computo = solida.cuentas.find(c => /computacion/i.test(c.nombre));
check('equipo de computación: (54000-6000)/3 años = 16000', cerca(computo.depreciacionAnual, 16000));
check('la acumulada nunca excede el monto depreciable',
  solida.cuentas.every(c => c.depreciacionAcumulada <= Math.abs(c.saldo) - (c.valorResidual || 0) + 0.01));
check('software (intangible) no se deprecia en línea recta',
  solida.cuentas.find(c => /software/i.test(c.nombre)).depreciacionAnual === 0);

/* ---------------- 5. Ecuación de equilibrio ---------------- */
console.log('\n5) Validación de la ecuación contable');
check('empresa sólida: el balance cuadra', solida.estados.validacion.cuadra,
  `descuadre = ${solida.estados.validacion.descuadre}`);
check('Activo = Pasivo + Patrimonio',
  cerca(solida.estados.balance.activoTotal, solida.estados.balance.pasivoMasPatrimonio));
const desordenado = motor(SampleData.desordenado.csv);
check('CSV con descuadre: se captura el error', !desordenado.estados.validacion.cuadra &&
  desordenado.estados.errores.some(e => e.tipo === 'ECUACION_DESBALANCEADA'));
check('el error incluye la diferencia y una sugerencia', (() => {
  const e = desordenado.estados.errores.find(x => x.tipo === 'ECUACION_DESBALANCEADA');
  return typeof e.diferencia === 'number' && !!e.sugerencia;
})());
check('no se duplica la depreciación cuando el CSV ya trae la acumulada',
  desordenado.estados.depreciacion.aplicada === false);

/* ---------------- 6. Razones financieras ---------------- */
console.log('\n6) Motor de razones financieras');
const b = solida.estados.balance, r = solida.estados.resultados, k = solida.ratios.clave;
check('cuatro grupos de razones generados', solida.ratios.grupos.length === 4 &&
  solida.ratios.grupos.every(g => g.indicadores.length >= 5));
check('razón circulante = AC / PC', cerca(k.razonCirculante, b.activoCorriente / b.pasivoCorriente, 1e-6));
check('prueba ácida excluye inventarios y anticipados',
  cerca(solida.ratios.grupos[0].indicadores[1].valor,
    (b.activoCorriente - solida.ratios.componentes.inventarios - solida.ratios.componentes.gastosAnticipados) / b.pasivoCorriente, 1e-6));
check('razón de endeudamiento = Pasivo / Activo', cerca(k.razonEndeudamiento, b.pasivoTotal / b.activoTotal, 1e-6));
check('apalancamiento interno = Patrimonio / Pasivo', cerca(k.apalancamientoInterno, b.patrimonio / b.pasivoTotal, 1e-6));
check('margen neto = Utilidad Neta / Ventas Netas', cerca(k.margenNeto, r.utilidadNeta / r.ventasNetas, 1e-6));
check('ROE = Utilidad Neta / Patrimonio', cerca(k.roe ?? 0, r.utilidadNeta / b.patrimonio, 1e-6) ||
  cerca(solida.ratios.grupos[3].indicadores.find(i => i.clave === 'roe').valor, r.utilidadNeta / b.patrimonio, 1e-6));
check('indicadores no calculables devuelven null en vez de Infinity',
  Ratios.calcular({ balance: { ...b, pasivoCorriente: 0, pasivoTotal: 0 }, resultados: r }, solida.cuentas)
    .clave.razonCirculante === null);

/* ---------------- 7. Recálculo en tiempo real ---------------- */
console.log('\n7) Recálculo ante variaciones del CSV');
const modificado = SampleData.solida.csv.replace('Inventario de mercancias;312.700,00', 'Inventario de mercancias;512.700,00');
const solida2 = motor(modificado);
check('un cambio en el CSV altera el activo corriente',
  cerca(solida2.estados.balance.activoCorriente - solida.estados.balance.activoCorriente, 200000));
check('un cambio en el CSV altera la razón circulante',
  solida2.ratios.clave.razonCirculante > solida.ratios.clave.razonCirculante);
check('un cambio en el CSV altera el puntaje Z', solida2.modelo.z > solida.modelo.z);

/* ---------------- 8. Análisis discriminante ---------------- */
console.log('\n8) Modelo discriminante Z = 0.4·X₁ + 0.6·X₂');
const m = solida.modelo;
check('X₁ es la razón circulante', cerca(m.x1, k.razonCirculante, 1e-9));
check('X₂ es la razón de apalancamiento interno', cerca(m.x2, k.apalancamientoInterno, 1e-9));
check('Z = 0.4·X₁ + 0.6·X₂', cerca(m.z, 0.4 * m.x1 + 0.6 * m.x2, 1e-9));
check('empresa sólida obtiene "Crédito excelente"', m.categoria.clave === 'EXCELENTE', `Z=${m.z.toFixed(4)}`);
const riesgo = motor(SampleData.riesgo.csv);
check('empresa en riesgo NO obtiene crédito excelente', riesgo.modelo.categoria.clave !== 'EXCELENTE',
  `Z=${riesgo.modelo.z.toFixed(4)} → ${riesgo.modelo.categoria.dictamen}`);
check('umbral superior: Z = 1.41 → excelente', Discriminant.clasificar(1.41).clave === 'EXCELENTE');
check('umbral: Z = 1.40 → riesgo normal', Discriminant.clasificar(1.40).clave === 'NORMAL');
check('umbral: Z = 0.66 → riesgo normal', Discriminant.clasificar(0.66).clave === 'NORMAL');
check('umbral: Z = 0.659 → crédito malo', Discriminant.clasificar(0.659).clave === 'MALO');
check('el dictamen incluye recomendación financiera', m.categoria.recomendacion.length > 40);
check('memoria de cálculo con 4 pasos', m.memoriaCalculo.length === 4);
check('sensibilidad calcula el faltante hacia el corte', typeof m.sensibilidad.faltanteZ === 'number');

console.log(`\nResultado: ${total - fallos}/${total} pruebas aprobadas.`);
if (fallos) { console.log(`${fallos} prueba(s) fallida(s).`); process.exit(1); }

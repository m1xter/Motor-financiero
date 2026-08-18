/* Diagnóstico rápido de un juego de datos: node test/diagnostico.js [solida|riesgo|desordenado|ruta.csv] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..');
const s = { window: {}, console };
vm.createContext(s);
['js/sample-data.js', 'js/csv-parser.js', 'js/classifier.js', 'js/statements.js', 'js/ratios.js', 'js/discriminant.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), s, { filename: f }));
const W = s.window;

const arg = process.argv[2] || 'solida';
const csv = W.SampleData[arg] ? W.SampleData[arg].csv : fs.readFileSync(arg, 'utf8');

const parsed = W.CsvParser.parse(csv);
const cuentas = W.Classifier.procesar(parsed.entries);
const estados = W.Statements.construir(cuentas, {});
const ratios = W.Ratios.calcular(estados, cuentas);
const modelo = W.Discriminant.evaluar(estados, ratios);
const b = estados.balance;

const n = v => (v === null || v === undefined ? 'N/D' : v.toFixed(2));
console.log(`\nJuego de datos: ${arg}`);
console.log(`Activo corriente        ${n(b.activoCorriente)}`);
console.log(`Activo no corriente     ${n(b.activoNoCorriente)} (bruto ${n(b.activoNoCorrienteCsv)})`);
console.log(`ACTIVO TOTAL            ${n(b.activoTotal)}`);
console.log(`Pasivo corriente        ${n(b.pasivoCorriente)}`);
console.log(`Pasivo no corriente     ${n(b.pasivoNoCorriente)}`);
console.log(`PASIVO TOTAL            ${n(b.pasivoTotal)}`);
console.log(`Patrimonio CSV          ${n(b.patrimonioCsv)}  (− deprec. anterior ${n(b.depreciacionAnterior)})`);
console.log(`PATRIMONIO              ${n(b.patrimonio)}`);
console.log(`Utilidad neta           ${n(estados.resultados.utilidadNeta)}`);
console.log(`Descuadre               ${n(estados.validacion.descuadre)}  cuadra=${estados.validacion.cuadra}`);
console.log(`Patrimonio CSV requerido para cuadrar: ${n(b.patrimonioCsv - estados.validacion.descuadre)}`);
console.log(`X1=${n(modelo.x1)}  X2=${n(modelo.x2)}  Z=${modelo.calculable ? modelo.z.toFixed(4) : 'N/D'} → ${modelo.calculable ? modelo.categoria.dictamen : '—'}`);
console.log('Sin clasificar:', cuentas.filter(c => c.grupo === 'SIN_CLASIFICAR').map(c => c.nombre));

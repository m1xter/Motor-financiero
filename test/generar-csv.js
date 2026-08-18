/* Escribe los CSV de ejemplo de data/ a partir de js/sample-data.js: node test/generar-csv.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..');
const s = { window: {}, console };
vm.createContext(s);
vm.runInContext(fs.readFileSync(path.join(raiz, 'js/sample-data.js'), 'utf8'), s);

const archivos = {
  solida: 'ejemplo_balance.csv',
  intermedia: 'ejemplo_intermedia.csv',
  riesgo: 'ejemplo_riesgo.csv',
  desordenado: 'ejemplo_desordenado.csv'
};
fs.mkdirSync(path.join(raiz, 'data'), { recursive: true });
Object.entries(archivos).forEach(([clave, archivo]) => {
  fs.writeFileSync(path.join(raiz, 'data', archivo), s.window.SampleData[clave].csv + '\n', 'utf8');
  console.log(`data/${archivo}`);
});

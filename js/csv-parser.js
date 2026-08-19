/* ============================================================
   csv-parser.js — Lectura y normalización de archivos CSV
   Motor Computacional de Análisis Financiero y Predicción de Riesgo
   ============================================================
   Objetivo: aceptar archivos CSV "crudos" y desordenados, con
   nombres de columnas variables, separadores distintos (, ; tab |)
   y montos escritos en formato latino (1.234.567,89) o anglosajón
   (1,234,567.89).
   ============================================================ */

const CsvParser = (() => {

  const DELIMITERS = [',', ';', '\t', '|'];

  /* ---------- Detección del delimitador dominante ---------- */
  function detectDelimiter(text) {
    const sample = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
    let best = ',', bestScore = -1;
    for (const d of DELIMITERS) {
      const counts = sample.map(l => splitLine(l, d).length);
      const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
      // Se premia mayor número de columnas y consistencia entre filas
      const consistent = counts.every(c => c === counts[0]) ? 1 : 0;
      const score = avg + consistent;
      if (avg > 1 && score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  /* ---------- Split respetando comillas dobles ---------- */
  function splitLine(line, delimiter) {
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  /* ---------- Normalización de texto (sin acentos, minúsculas) ---------- */
  function normalize(str) {
    return String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* ---------- Conversión de montos a número ---------- */
  function parseAmount(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (!s) return null;

    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }     // (1.500) => -1500
    s = s.replace(/[^0-9.,\-+]/g, '');                                    // quita Bs, $, espacios
    if (!s) return null;
    if (s.includes('-')) { negative = negative || s.trim().startsWith('-'); s = s.replace(/-/g, ''); }
    s = s.replace(/\+/g, '');

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
      // El separador decimal es el que aparece más a la derecha
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma > -1) {
      const decimals = s.length - lastComma - 1;
      // "1,50" => decimal ; "1,500" o "1,234,567" => miles
      s = (decimals === 3 && /,\d{3}(,|$)/.test(s)) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (lastDot > -1) {
      const decimals = s.length - lastDot - 1;
      if (decimals === 3 && /\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, '');
    }

    const n = Number(s);
    if (!isFinite(n)) return null;
    return negative ? -n : n;
  }

  /* ---------- Reconocimiento de encabezados ----------
     Se evalúan en orden: el primer patrón que coincide decide el rol de la
     columna. Los patrones específicos van antes que los genéricos para que
     "tipo_saldo" se lea como categoría (y no como saldo) y "id_cuenta" se
     descarte en lugar de tomarse como nombre de la cuenta. */
  const HEADER_PATTERNS = [
    { key: null, re: /^(id|ids|codigo|cod|nro|num|numero|no|linea|fila|ref|orden)\b/ },
    { key: 'categoria', re: /(categoria|clasificacion|tipo|grupo|naturaleza|clase)/ },
    { key: 'vidaUtil', re: /vida/ },
    { key: 'residual', re: /(residual|salvamento|desecho|rescate)/ },
    { key: 'antiguedad', re: /(anos? de uso|anos? uso|antiguedad|anos? transcurridos|periodos depreciados|edad|uso acumulado)/ },
    { key: 'saldo', re: /(saldo|monto|importe|valor|costo|debe|cantidad|total|balance|bs|usd)/ },
    { key: 'cuenta', re: /(cuenta|descripcion|nombre|concepto|partida|detalle|rubro|item|glosa)/ }
  ];

  function matchHeader(header) {
    const h = normalize(header).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!h) return null;
    for (const { key, re } of HEADER_PATTERNS) {
      if (re.test(h)) return key;   // key null => columna descartada (identificadores)
    }
    return null;
  }

  /* ---------- Parseo principal ---------- */
  function parse(text) {
    const clean = String(text).replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(clean);
    const rawRows = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
    if (!rawRows.length) throw new Error('El archivo CSV está vacío.');

    const rows = rawRows.map(l => splitLine(l, delimiter));
    const warnings = [];

    /* Detección del encabezado: primera fila cuyas celdas no sean montos */
    let headerIndex = -1, map = {};
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const candidate = rows[i];
      const found = {};
      candidate.forEach((cell, idx) => {
        const key = matchHeader(cell);
        if (key && found[key] === undefined) found[key] = idx;
      });
      if (found.cuenta !== undefined && found.saldo !== undefined) {
        headerIndex = i; map = found; break;
      }
    }

    /* Verificación contra los datos: la columna de saldo debe contener
       montos y la de cuenta texto. Si el encabezado engañó al mapeo, se
       corrige observando el contenido real de las filas. */
    if (headerIndex >= 0) {
      const datos = rows.slice(headerIndex + 1).filter(r => r.length > 1);
      const ancho = Math.max(...[rows[headerIndex], ...datos].map(r => r.length));
      const proporcionNumerica = idx => {
        if (idx === undefined) return 0;
        const vals = datos.map(r => (r[idx] || '').trim()).filter(v => v);
        if (!vals.length) return 0;
        return vals.filter(v => parseAmount(v) !== null).length / vals.length;
      };
      const ocupadas = omitir => new Set(
        Object.entries(map).filter(([k]) => k !== omitir).map(([, v]) => v)
      );

      if (proporcionNumerica(map.saldo) < 0.6) {
        let mejor = -1, mejorProp = 0;
        const usadas = ocupadas('saldo');
        for (let c = 0; c < ancho; c++) {
          if (usadas.has(c)) continue;
          const p = proporcionNumerica(c);
          if (p > mejorProp) { mejorProp = p; mejor = c; }
        }
        if (mejor >= 0 && mejorProp >= 0.6) {
          const antes = rows[headerIndex][map.saldo];
          if (map.categoria === undefined && map.saldo !== undefined) map.categoria = map.saldo;
          map.saldo = mejor;
          warnings.push(`La columna "${antes}" no contiene montos; se usó "${rows[headerIndex][mejor]}" como saldo.`);
        }
      }

      if (proporcionNumerica(map.cuenta) > 0.8) {
        let mejor = -1, mejorProp = 1;
        const usadas = ocupadas('cuenta');
        for (let c = 0; c < ancho; c++) {
          if (usadas.has(c)) continue;
          const p = proporcionNumerica(c);
          const conTexto = datos.some(r => (r[c] || '').trim());
          if (conTexto && p < mejorProp) { mejorProp = p; mejor = c; }
        }
        if (mejor >= 0 && mejorProp < 0.5) {
          const antes = rows[headerIndex][map.cuenta];
          map.cuenta = mejor;
          warnings.push(`La columna "${antes}" contiene identificadores; se usó "${rows[headerIndex][mejor]}" como nombre de la cuenta.`);
        }
      }

      if (map.cuenta === undefined || map.saldo === undefined) headerIndex = -1;
    }

    /* Si no hay encabezado reconocible se asume: col 0 = cuenta, última numérica = saldo */
    if (headerIndex === -1) {
      warnings.push('No se detectó una fila de encabezados válida; se asumió que la primera columna es la cuenta y la columna numérica es el saldo.');
      const probe = rows.find(r => r.length > 1 && parseAmount(r[r.length - 1]) !== null) || rows[0];
      const amountIdx = probe.findIndex((c, i) => i > 0 && parseAmount(c) !== null);
      map = { cuenta: 0, saldo: amountIdx > 0 ? amountIdx : probe.length - 1 };
      headerIndex = -1;
    }

    const entries = [];
    const skipped = [];
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[map.cuenta] || '').trim();
      const amount = parseAmount(r[map.saldo]);
      if (!name) continue;
      // Se ignoran filas de totales del archivo original (se recalculan internamente)
      if (/^(total|totales|sumas?|suma total|balance)\b/i.test(normalize(name))) { skipped.push(name); continue; }
      if (amount === null) { skipped.push(name); continue; }

      entries.push({
        id: `acc-${i}-${Math.random().toString(36).slice(2, 7)}`,
        nombre: name,
        saldo: amount,
        categoriaCsv: map.categoria !== undefined ? (r[map.categoria] || '').trim() : '',
        vidaUtil: map.vidaUtil !== undefined ? parseAmount(r[map.vidaUtil]) : null,
        valorResidual: map.residual !== undefined ? parseAmount(r[map.residual]) : null,
        anosUso: map.antiguedad !== undefined ? parseAmount(r[map.antiguedad]) : null
      });
    }

    if (!entries.length) throw new Error('No se encontraron cuentas con saldos numéricos en el archivo.');
    if (skipped.length) warnings.push(`Filas ignoradas (totales o saldos no numéricos): ${skipped.slice(0, 6).join(', ')}${skipped.length > 6 ? '…' : ''}.`);

    return {
      delimiter,
      mapa: headerIndex >= 0
        ? Object.fromEntries(Object.entries(map).map(([k, i]) => [k, rows[headerIndex][i]]))
        : {},
      columnas: Object.keys(map),
      entries,
      warnings
    };
  }

  return { parse, parseAmount, normalize, detectDelimiter, splitLine };
})();

window.CsvParser = CsvParser;

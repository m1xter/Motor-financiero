/* ============================================================
   app.js — Controlador de la aplicación
   ============================================================
   Orquesta el flujo de datos completo:
   CSV → clasificación → estados financieros → razones → modelo Z
   y mantiene el dashboard sincronizado en tiempo real.
   ============================================================ */

const App = (() => {

  const state = {
    archivo: '',
    entries: [],        // partidas crudas del CSV
    overrides: {},      // ajustes manuales por cuenta
    opciones: {},       // aplicarDepreciacion / incluirUtilidad (undefined = automático)
    cuentas: [],
    estados: null,
    ratios: null,
    modelo: null,
    avisosArchivo: []
  };

  const $ = sel => document.querySelector(sel);
  const el = id => document.getElementById(id);

  /* ---------------- Formatos ---------------- */
  const fmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formato = n => (n === null || n === undefined || !isFinite(n)) ? '—' : fmt.format(n);
  const formatoCorto = n => {
    if (n === null || !isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1) + ' MM';
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + ' M';
    if (abs >= 1e3) return (n / 1e3).toFixed(0) + ' k';
    return n.toFixed(0);
  };

  function valorIndicador(i) {
    if (i.valor === null || !isFinite(i.valor)) return 'N/D';
    switch (i.unidad) {
      case 'porcentaje': return (i.valor * 100).toFixed(2) + ' %';
      case 'veces': return i.valor.toFixed(2) + ' ×';
      case 'dias': return i.valor.toFixed(1) + ' días';
      default: return formato(i.valor);
    }
  }

  const BADGES = {
    ACTIVO_CORRIENTE: 'badge-ac', ACTIVO_NO_CORRIENTE: 'badge-anc',
    PASIVO_CORRIENTE: 'badge-pc', PASIVO_NO_CORRIENTE: 'badge-pnc',
    PATRIMONIO: 'badge-pat', INGRESO: 'badge-res', COSTO: 'badge-res',
    GASTO_OPERATIVO: 'badge-res', GASTO_FINANCIERO: 'badge-res', IMPUESTO: 'badge-res',
    SIN_CLASIFICAR: 'badge-sin'
  };

  /* ---------------- Pipeline de cálculo ---------------- */
  function construirCuentas() {
    return state.entries.map(entry => {
      const ov = state.overrides[entry.id] || {};
      const base = {
        ...entry,
        saldo: ov.saldo !== undefined ? ov.saldo : entry.saldo,
        vidaUtil: ov.vidaUtil !== undefined ? ov.vidaUtil : entry.vidaUtil,
        valorResidual: ov.valorResidual !== undefined ? ov.valorResidual : entry.valorResidual,
        anosUso: ov.anosUso !== undefined ? ov.anosUso : entry.anosUso
      };

      let cuenta = Classifier.clasificar(base);

      if (ov.grupo && ov.grupo !== cuenta.grupo) {
        cuenta = {
          ...cuenta,
          grupo: ov.grupo,
          grupoNombre: Classifier.GRUPOS[ov.grupo],
          origenClasificacion: 'reclasificación manual',
          depreciable: ov.grupo === 'ACTIVO_NO_CORRIENTE' && !cuenta.esTerreno && cuenta.vidaUtil > 0
        };
      }
      if (ov.vidaUtil !== undefined && cuenta.grupo === 'ACTIVO_NO_CORRIENTE' && !cuenta.esTerreno) {
        cuenta.depreciable = ov.vidaUtil > 0;
        cuenta.vidaUtil = ov.vidaUtil;
        cuenta.vidaPorDefecto = false;
      }
      return Classifier.depreciar(cuenta);
    });
  }

  function recalcular() {
    state.cuentas = construirCuentas();
    state.estados = Statements.construir(state.cuentas, state.opciones);
    state.ratios = Ratios.calcular(state.estados, state.cuentas);
    state.modelo = Discriminant.evaluar(state.estados, state.ratios);
    render();
  }

  /* ---------------- Carga de datos ---------------- */
  function cargarTexto(texto, nombreArchivo) {
    try {
      const parsed = CsvParser.parse(texto);
      state.archivo = nombreArchivo || 'datos.csv';
      state.entries = parsed.entries;
      state.overrides = {};
      state.opciones = {};
      state.avisosArchivo = parsed.warnings.slice();
      state.avisosArchivo.unshift(`Archivo "${state.archivo}" procesado: ${parsed.entries.length} partidas leídas (delimitador «${parsed.delimiter === '\t' ? 'tab' : parsed.delimiter}»).`);
      mostrarInterfaz();
      recalcular();
    } catch (err) {
      state.avisosArchivo = [];
      alertaFatal(err.message);
    }
  }

  function alertaFatal(mensaje) {
    const cont = el('alertas');
    cont.classList.remove('hidden');
    cont.innerHTML = `<div class="alerta error"><div class="alerta-icono">⛔</div>
      <div><h4>No se pudo procesar el archivo</h4><p>${mensaje}</p></div></div>`;
  }

  function leerArchivo(file) {
    const reader = new FileReader();
    reader.onload = e => cargarTexto(e.target.result, file.name);
    reader.onerror = () => alertaFatal('Error de lectura del archivo.');
    reader.readAsText(file, 'UTF-8');
  }

  function mostrarInterfaz() {
    el('zona-carga').classList.add('hidden');
    ['resumen', 'tabs', 'alertas'].forEach(id => el(id).classList.remove('hidden'));
    el('btn-exportar').disabled = false;
    cambiarTab(tabActiva);
  }

  /* ---------------- Render principal ---------------- */
  function render() {
    renderAlertas();
    renderResumen();
    renderPartidas();
    renderDepreciacion();
    renderBalance();
    renderResultados();
    renderIndices();
    renderModelo();
    Charts.refrescarTodo(state.estados, state.ratios);
    sincronizarSwitches();
  }

  function sincronizarSwitches() {
    el('opt-depreciacion').checked = state.estados.depreciacion.aplicada;
    el('opt-utilidad').checked = state.estados.validacion.incluirUtilidad;
  }

  /* ---------------- Alertas ---------------- */
  function renderAlertas() {
    const { errores, notas, validacion } = state.estados;
    const bloques = [];

    if (validacion.cuadra) {
      bloques.push(alerta('ok', '✔', 'Ecuación contable validada',
        `Activo = Pasivo + Patrimonio → ${formato(state.estados.balance.activoTotal)} = ${formato(state.estados.balance.pasivoMasPatrimonio)} (diferencia ${formato(validacion.descuadre)}).`));
    }
    errores.forEach(e => {
      const detalle = e.cuentas ? `${e.cuentas.join(', ')}. ` : '';
      bloques.push(alerta(e.tipo === 'ECUACION_DESBALANCEADA' ? 'error' : '', '⚠',
        e.tipo === 'ECUACION_DESBALANCEADA' ? 'Descuadre detectado en el Balance General' : 'Partidas sin clasificar',
        `${e.mensaje} ${detalle}${e.sugerencia || ''}`));
    });
    state.avisosArchivo.forEach(a => bloques.push(alerta('info', 'ℹ', 'Lectura del archivo', a)));
    notas.forEach(n => bloques.push(alerta('info', '⚙', 'Ajuste aplicado por el motor', n)));

    el('alertas').innerHTML = bloques.join('');
  }

  const alerta = (clase, icono, titulo, texto) =>
    `<div class="alerta ${clase}"><div class="alerta-icono">${icono}</div><div><h4>${titulo}</h4><p>${texto}</p></div></div>`;

  /* ---------------- Resumen (KPIs) ---------------- */
  function renderResumen() {
    const b = state.estados.balance, r = state.estados.resultados, m = state.modelo;
    const dictamen = m.calculable ? m.categoria : null;

    el('resumen').innerHTML = `
      ${kpi('Activo Total', formato(b.activoTotal), `Corriente ${formatoCorto(b.activoCorriente)} · No corriente ${formatoCorto(b.activoNoCorriente)}`)}
      ${kpi('Pasivo Total', formato(b.pasivoTotal), `Endeudamiento ${porcentaje(state.ratios.clave.razonEndeudamiento)}`)}
      ${kpi('Patrimonio', formato(b.patrimonio), `Autonomía ${porcentaje(b.activoTotal ? b.patrimonio / b.activoTotal : null)}`)}
      ${kpi('Utilidad Neta', r.hayEstadoResultados ? formato(r.utilidadNeta) : 'N/D', r.hayEstadoResultados ? `Margen neto ${porcentaje(state.ratios.clave.margenNeto)}` : 'Sin cuentas de resultados en el CSV')}
      ${kpi('Puntaje Z', m.calculable ? m.z.toFixed(4) : 'N/D', dictamen ? dictamen.dictamen : 'No calculable', true, dictamen ? dictamen.color : null)}
    `;
  }

  const porcentaje = v => (v === null || !isFinite(v)) ? 'N/D' : (v * 100).toFixed(1) + ' %';

  function kpi(label, valor, nota, destacado = false, color = null) {
    return `<div class="kpi ${destacado ? 'destacado' : ''}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-valor" ${color ? `style="color:${color}"` : ''}>${valor}</div>
      <div class="kpi-nota">${nota}</div>
    </div>`;
  }

  /* ---------------- Fase 1: partidas ---------------- */
  function renderPartidas() {
    const opciones = Object.entries(Classifier.GRUPOS)
      .map(([k, v]) => ({ k, v }));

    const filas = state.cuentas.map(c => `
      <tr>
        <td>${c.nombre}</td>
        <td class="num"><input class="input-celda" type="number" step="0.01" data-campo="saldo" data-id="${c.id}" value="${c.saldo}"></td>
        <td><select class="input-celda" data-campo="grupo" data-id="${c.id}">
          ${opciones.map(o => `<option value="${o.k}" ${o.k === c.grupo ? 'selected' : ''}>${o.v}</option>`).join('')}
        </select></td>
        <td><span class="badge ${BADGES[c.grupo]}">${c.grupoNombre}</span></td>
        <td class="small muted">${c.origenClasificacion}${c.contra ? ' · cuenta de valuación' : ''}</td>
      </tr>`).join('');

    el('tabla-partidas').innerHTML = `
      <thead><tr>
        <th>Cuenta del CSV</th><th class="num">Saldo</th><th>Clasificación</th><th>Grupo</th><th>Origen</th>
      </tr></thead>
      <tbody>${filas}</tbody>`;
  }

  function renderDepreciacion() {
    const dep = state.estados.depreciacion;
    const filasDep = dep.detalle.map(d => `<tr>
        <td>${d.nombre}</td>
        <td class="num">${formato(d.costo)}</td>
        <td class="num"><input class="input-celda corta" type="number" min="0" step="1" data-campo="vidaUtil" data-id="${d.id}" value="${d.vidaUtil ?? ''}"></td>
        <td class="num"><input class="input-celda corta" type="number" min="0" step="0.01" data-campo="valorResidual" data-id="${d.id}" value="${d.residual || 0}"></td>
        <td class="num"><input class="input-celda corta" type="number" min="0" step="1" data-campo="anosUso" data-id="${d.id}" value="${d.anosUso || 0}"></td>
        <td class="num">${formato(d.anual)}</td>
        <td class="num">${formato(d.acumulada)}</td>
        <td class="num">${formato(d.valorNeto)}</td>
      </tr>`).join('');

    const filasNo = dep.noDepreciables.map(d => `<tr>
        <td>${d.nombre}</td><td class="num">${formato(d.monto)}</td>
        <td colspan="5" class="small muted">${d.nota}</td>
        <td class="num">${formato(d.monto)}</td>
      </tr>`).join('');

    const total = `<tr class="fila-total">
        <td>Total depreciación${dep.aplicada ? '' : ' (no aplicada al balance)'}</td>
        <td class="num"></td><td colspan="3"></td>
        <td class="num">${formato(dep.anual)}</td>
        <td class="num">${formato(dep.acumulada)}</td><td class="num"></td>
      </tr>`;

    el('tabla-depreciacion').innerHTML = `
      <thead><tr>
        <th>Activo fijo</th><th class="num">Costo</th><th class="num">Vida útil</th>
        <th class="num">Residual</th><th class="num">Años uso</th>
        <th class="num">Cuota anual</th><th class="num">Deprec. acumulada</th><th class="num">Valor neto</th>
      </tr></thead>
      <tbody>${filasDep}${filasNo}${total}</tbody>`;
  }

  /* ---------------- Fase 1: balance ---------------- */
  function renderBalance() {
    const b = state.estados.balance, v = state.estados.validacion;
    const linea = (c, extra = '') => `<div class="linea ${c.contra ? 'contra' : ''} ${extra}">
        <span>${c.nombre}</span><span>${c.contra ? '(' + formato(Math.abs(c.saldo)) + ')' : formato(Math.abs(c.saldo))}</span></div>`;

    const depCalculada = state.estados.depreciacion.aplicada && state.estados.depreciacion.acumulada > 0
      ? `<div class="linea contra"><span>Depreciación acumulada (calculada por el motor)</span><span>(${formato(state.estados.depreciacion.acumulada)})</span></div>` : '';

    const ecuacion = `<div class="ecuacion ${v.cuadra ? 'cuadra' : 'descuadra'}">
        <span>ACTIVO <span class="val">${formato(b.activoTotal)}</span></span>
        <span class="op">${v.cuadra ? '=' : '≠'}</span>
        <span>PASIVO <span class="val">${formato(b.pasivoTotal)}</span></span>
        <span class="op">+</span>
        <span>PATRIMONIO <span class="val">${formato(b.patrimonio)}</span></span>
        <span class="op">→</span>
        <span>${v.cuadra ? 'Balance validado' : 'Descuadre ' + formato(v.descuadre)}</span>
      </div>`;

    el('balance-contenido').innerHTML = `
      ${ecuacion}
      <div class="card balance-col">
        <h3><span>ACTIVO</span><span class="mono">${formato(b.activoTotal)}</span></h3>
        <div class="grupo-titulo">Activo Corriente (mayor liquidez primero)</div>
        ${ordenar(b.listas.acLista).map(c => linea(c)).join('')}
        <div class="linea subtotal"><span>Total Activo Corriente</span><span>${formato(b.activoCorriente)}</span></div>
        <div class="grupo-titulo">Activo No Corriente</div>
        ${ordenar(b.listas.ancLista).map(c => linea(c)).join('')}
        ${depCalculada}
        <div class="linea subtotal"><span>Total Activo No Corriente</span><span>${formato(b.activoNoCorriente)}</span></div>
        <div class="linea total"><span>TOTAL ACTIVO</span><span>${formato(b.activoTotal)}</span></div>
      </div>
      <div class="card balance-col">
        <h3><span>PASIVO Y PATRIMONIO</span><span class="mono">${formato(b.pasivoMasPatrimonio)}</span></h3>
        <div class="grupo-titulo">Pasivo Corriente (mayor exigibilidad primero)</div>
        ${ordenar(b.listas.pcLista).map(c => linea(c)).join('')}
        <div class="linea subtotal"><span>Total Pasivo Corriente</span><span>${formato(b.pasivoCorriente)}</span></div>
        <div class="grupo-titulo">Pasivo No Corriente</div>
        ${ordenar(b.listas.pncLista).map(c => linea(c)).join('')}
        <div class="linea subtotal"><span>Total Pasivo No Corriente</span><span>${formato(b.pasivoNoCorriente)}</span></div>
        <div class="linea subtotal"><span>TOTAL PASIVO</span><span>${formato(b.pasivoTotal)}</span></div>
        <div class="grupo-titulo">Patrimonio</div>
        ${ordenar(b.listas.patLista).map(c => linea(c)).join('')}
        ${v.incluirUtilidad ? `<div class="linea"><span>Resultado del ejercicio</span><span>${formato(state.estados.resultados.utilidadNeta)}</span></div>` : ''}
        <div class="linea subtotal"><span>Total Patrimonio</span><span>${formato(b.patrimonio)}</span></div>
        <div class="linea total"><span>TOTAL PASIVO + PATRIMONIO</span><span>${formato(b.pasivoMasPatrimonio)}</span></div>
      </div>`;
  }

  const ordenar = lista => [...lista].sort((a, b) => (a.liquidez ?? 99) - (b.liquidez ?? 99));

  /* ---------------- Fase 1: estado de resultados ---------------- */
  function renderResultados() {
    const r = state.estados.resultados;
    if (!r.hayEstadoResultados) {
      el('resultados-contenido').innerHTML = `<div class="card"><p class="muted">
        El archivo cargado no contiene cuentas de ingresos, costos ni gastos, por lo que no es posible construir el
        Estado de Resultados. Las razones de actividad y rentabilidad quedarán como no disponibles.</p></div>`;
      return;
    }
    const l = (nombre, valor, clase = '') => `<div class="linea ${clase}"><span>${nombre}</span><span>${formato(valor)}</span></div>`;

    el('resultados-contenido').innerHTML = `<div class="card">
      ${l('Ventas brutas', r.ventasBrutas)}
      ${r.devoluciones ? `<div class="linea contra"><span>Devoluciones y descuentos en ventas</span><span>(${formato(r.devoluciones)})</span></div>` : ''}
      ${l('Ventas netas', r.ventasNetas, 'subtotal')}
      <div class="linea contra"><span>Costo de ventas</span><span>(${formato(r.costoVentas)})</span></div>
      ${l('Utilidad bruta', r.utilidadBruta, 'subtotal')}
      <div class="linea contra"><span>Gastos operativos${r.depreciacionEnGastos ? ' (incluye depreciación calculada ' + formato(r.depreciacionEnGastos) + ')' : ''}</span><span>(${formato(r.gastosOperativos)})</span></div>
      ${r.otrosIngresos ? l('Otros ingresos', r.otrosIngresos) : ''}
      ${l('Utilidad operativa', r.utilidadOperativa, 'subtotal')}
      <div class="linea contra"><span>Gastos financieros</span><span>(${formato(r.gastosFinancieros)})</span></div>
      ${l('Utilidad antes de impuestos', r.utilidadAntesImpuestos, 'subtotal')}
      <div class="linea contra"><span>Impuesto sobre la renta</span><span>(${formato(r.impuestos)})</span></div>
      ${l('UTILIDAD NETA DEL EJERCICIO', r.utilidadNeta, 'total')}
    </div>`;
  }

  /* ---------------- Fase 2: índices ---------------- */
  function renderIndices() {
    el('indices-contenido').innerHTML = state.ratios.grupos.map(g => `
      <div class="grupo-indices">
        <h3><span>${g.icono}</span> Razones de ${g.nombre}</h3>
        <div class="indice-grid">
          ${g.indicadores.map(i => `
            <div class="indice ${i.estado}">
              <div class="indice-nombre">${i.nombre}</div>
              <div class="indice-valor">${valorIndicador(i)}</div>
              <div class="indice-formula">${i.formula}</div>
              <div class="indice-desc">${i.descripcion}</div>
            </div>`).join('')}
        </div>
      </div>`).join('');
  }

  /* ---------------- Fase 3: modelo discriminante ---------------- */
  function renderModelo() {
    const m = state.modelo;
    const cont = el('modelo-contenido');

    if (!m.calculable) {
      cont.innerHTML = `<div class="card"><h3>Modelo no calculable</h3>
        <p class="muted">${m.advertencias.join(' ')}</p></div>`;
      return;
    }

    const cat = m.categoria;
    const pos = Math.max(0, Math.min(100, (m.z / 2.5) * 100));

    cont.innerHTML = `
      <div class="modelo-grid">
        <div class="card dictamen">
          <div class="kpi-label">Puntaje discriminante</div>
          <div class="dictamen-z" style="color:${cat.color}">${m.z.toFixed(4)}</div>
          <div class="dictamen-etiqueta" style="color:${cat.color}">${cat.dictamen}</div>
          <div class="dictamen-criterio">Criterio: ${cat.criterio}</div>
          <div class="escala">
            <div class="escala-barra"><div class="escala-marcador" style="left:calc(${pos}% - 2px)"></div></div>
            <div class="escala-labels"><span>0.00</span><span>0.66</span><span>1.40</span><span>2.50</span></div>
          </div>
          <p class="dictamen-reco"><strong>Recomendación financiera:</strong> ${cat.recomendacion}</p>
        </div>
        <div class="card">
          <h3>Variables del modelo</h3>
          <div class="variables">
            <div class="variable">
              <div class="variable-clave">X₁ · Razón Circulante</div>
              <div class="variable-valor">${m.x1.toFixed(4)}</div>
              <div class="variable-desc">Aporte al puntaje: 0.4 × ${m.x1.toFixed(4)} = <strong>${m.aportes.x1.toFixed(4)}</strong>
                (${(m.aportes.pesoX1 * 100).toFixed(1)} % de Z)</div>
            </div>
            <div class="variable">
              <div class="variable-clave">X₂ · Apalancamiento Interno</div>
              <div class="variable-valor">${m.x2.toFixed(4)}</div>
              <div class="variable-desc">Aporte al puntaje: 0.6 × ${m.x2.toFixed(4)} = <strong>${m.aportes.x2.toFixed(4)}</strong>
                (${(m.aportes.pesoX2 * 100).toFixed(1)} % de Z)</div>
            </div>
          </div>
          <h3>Memoria de cálculo</h3>
          <ul class="memoria">${m.memoriaCalculo.map(l => `<li>${l}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="chart-row">
        <div class="card">
          <h3>Escala de dictamen</h3>
          ${Object.values(Discriminant.CATEGORIAS).map(c => `
            <div class="linea ${c.clave === cat.clave ? 'subtotal' : ''}">
              <span style="color:${c.color}">${c.dictamen}</span><span>${c.criterio}</span></div>`).join('')}
          <p class="small muted" style="margin-top:12px">
            El modelo pondera con mayor peso (0.6) el respaldo patrimonial frente a la deuda, por lo que la
            capitalización afecta el dictamen más que la liquidez de corto plazo.</p>
        </div>
        <div class="card">
          <h3>Sensibilidad del dictamen</h3>
          ${m.sensibilidad.faltanteZ > 0 ? `
            <div class="linea"><span>Puntos de Z faltantes para "${m.sensibilidad.objetivo === 1.4 ? 'Crédito excelente' : 'Crédito de riesgo normal'}"</span><span>${m.sensibilidad.faltanteZ.toFixed(4)}</span></div>
            <div class="linea"><span>Aumento requerido en X₁ (razón circulante)</span><span>${m.sensibilidad.deltaX1.toFixed(4)} ×</span></div>
            <div class="linea"><span>Aumento requerido en X₂ (apalancamiento interno)</span><span>${m.sensibilidad.deltaX2.toFixed(4)} ×</span></div>
            <div class="linea"><span>Equivale a más activo corriente por</span><span>${formato(m.sensibilidad.activoCorrienteRequerido)}</span></div>
            <div class="linea"><span>o a capitalizar patrimonio por</span><span>${formato(m.sensibilidad.patrimonioRequerido)}</span></div>`
          : `<p class="muted">La empresa ya supera el umbral máximo del modelo (Z &gt; 1.4). El excedente sobre el
             corte superior es de ${Math.abs(m.sensibilidad.faltanteZ).toFixed(4)} puntos, margen disponible antes de
             degradar su categoría de crédito.</p>`}
        </div>
      </div>`;
  }

  /* ---------------- Navegación ---------------- */
  let tabActiva = 'partidas';
  const PANELES = ['partidas', 'balance', 'resultados', 'indices', 'modelo'];

  function cambiarTab(tab) {
    tabActiva = tab;
    PANELES.forEach(p => el('panel-' + p).classList.toggle('hidden', p !== tab));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('tab-active', b.dataset.tab === tab));
    if (state.estados) Charts.refrescarTodo(state.estados, state.ratios);
  }

  /* ---------------- Exportación del informe ---------------- */
  function exportar() {
    const b = state.estados.balance, r = state.estados.resultados, m = state.modelo;
    const filasRatios = state.ratios.grupos.map(g =>
      `<h3>${g.nombre}</h3><table>${g.indicadores.map(i =>
        `<tr><td>${i.nombre}</td><td>${i.formula}</td><td style="text-align:right">${valorIndicador(i)}</td></tr>`).join('')}</table>`).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
      <title>Informe financiero — ${state.archivo}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;margin:36px;color:#16202e}
      h1{font-size:20px}h2{font-size:16px;margin-top:26px;border-bottom:2px solid #4c8dff;padding-bottom:4px}
      h3{font-size:13px;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}
      td,th{padding:5px 7px;border-bottom:1px solid #d8e0ec}.tot{font-weight:bold;background:#f2f5fa}
      .dict{padding:14px;border:2px solid ${m.calculable ? m.categoria.color : '#999'};border-radius:8px;margin-top:10px}</style>
      </head><body>
      <h1>Informe de Análisis Financiero y Predicción de Riesgo</h1>
      <p>Archivo procesado: <strong>${state.archivo}</strong> · Generado el ${new Date().toLocaleString('es-VE')}</p>
      <h2>1. Balance General</h2>
      <table>
        <tr><td>Activo Corriente</td><td style="text-align:right">${formato(b.activoCorriente)}</td></tr>
        <tr><td>Activo No Corriente (neto de depreciación)</td><td style="text-align:right">${formato(b.activoNoCorriente)}</td></tr>
        <tr class="tot"><td>Total Activo</td><td style="text-align:right">${formato(b.activoTotal)}</td></tr>
        <tr><td>Pasivo Corriente</td><td style="text-align:right">${formato(b.pasivoCorriente)}</td></tr>
        <tr><td>Pasivo No Corriente</td><td style="text-align:right">${formato(b.pasivoNoCorriente)}</td></tr>
        <tr><td>Patrimonio</td><td style="text-align:right">${formato(b.patrimonio)}</td></tr>
        <tr class="tot"><td>Total Pasivo + Patrimonio</td><td style="text-align:right">${formato(b.pasivoMasPatrimonio)}</td></tr>
        <tr><td>Validación de la ecuación contable</td><td style="text-align:right">${state.estados.validacion.cuadra ? 'CUADRA' : 'DESCUADRE ' + formato(state.estados.validacion.descuadre)}</td></tr>
      </table>
      <h2>2. Estado de Resultados</h2>
      ${r.hayEstadoResultados ? `<table>
        <tr><td>Ventas netas</td><td style="text-align:right">${formato(r.ventasNetas)}</td></tr>
        <tr><td>Costo de ventas</td><td style="text-align:right">(${formato(r.costoVentas)})</td></tr>
        <tr><td>Utilidad bruta</td><td style="text-align:right">${formato(r.utilidadBruta)}</td></tr>
        <tr><td>Gastos operativos</td><td style="text-align:right">(${formato(r.gastosOperativos)})</td></tr>
        <tr><td>Utilidad operativa</td><td style="text-align:right">${formato(r.utilidadOperativa)}</td></tr>
        <tr><td>Gastos financieros</td><td style="text-align:right">(${formato(r.gastosFinancieros)})</td></tr>
        <tr><td>Impuesto sobre la renta</td><td style="text-align:right">(${formato(r.impuestos)})</td></tr>
        <tr class="tot"><td>Utilidad neta</td><td style="text-align:right">${formato(r.utilidadNeta)}</td></tr>
      </table>` : '<p>El archivo no contiene cuentas de resultados.</p>'}
      <h2>3. Cédula de depreciación (línea recta)</h2>
      <table><tr><th>Activo</th><th>Costo</th><th>Vida útil</th><th>Cuota anual</th><th>Acumulada</th><th>Valor neto</th></tr>
      ${state.estados.depreciacion.detalle.map(d => `<tr><td>${d.nombre}</td><td style="text-align:right">${formato(d.costo)}</td>
        <td style="text-align:right">${d.vidaUtil}</td><td style="text-align:right">${formato(d.anual)}</td>
        <td style="text-align:right">${formato(d.acumulada)}</td><td style="text-align:right">${formato(d.valorNeto)}</td></tr>`).join('')}
      ${state.estados.depreciacion.noDepreciables.map(d => `<tr><td>${d.nombre}</td><td style="text-align:right">${formato(d.monto)}</td>
        <td colspan="3">${d.nota}</td><td style="text-align:right">${formato(d.monto)}</td></tr>`).join('')}
      </table>
      <h2>4. Razones financieras</h2>${filasRatios}
      <h2>5. Análisis discriminante</h2>
      ${m.calculable ? `<table>${m.memoriaCalculo.map(l => `<tr><td>${l}</td></tr>`).join('')}</table>
        <div class="dict"><strong>Dictamen: ${m.categoria.dictamen}</strong> (${m.categoria.criterio})<br>${m.categoria.recomendacion}</div>`
        : `<p>${m.advertencias.join(' ')}</p>`}
      </body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `informe-financiero-${state.archivo.replace(/\.[^.]+$/, '')}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- Eventos ---------------- */
  function inicializar() {
    el('btn-cargar').addEventListener('click', () => el('input-csv').click());
    el('input-csv').addEventListener('change', e => { if (e.target.files[0]) leerArchivo(e.target.files[0]); });
    el('sel-demo').addEventListener('change', e => {
      const juego = SampleData[e.target.value];
      if (juego) cargarTexto(juego.csv, juego.nombre + '.csv');
    });
    el('btn-exportar').addEventListener('click', exportar);
    el('btn-tema').addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem('mf-tema', document.body.classList.contains('light') ? 'light' : 'dark');
      if (state.estados) Charts.refrescarTodo(state.estados, state.ratios);
    });
    if (localStorage.getItem('mf-tema') === 'light') document.body.classList.add('light');

    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => cambiarTab(b.dataset.tab)));

    el('opt-depreciacion').addEventListener('change', e => { state.opciones.aplicarDepreciacion = e.target.checked; recalcular(); });
    el('opt-utilidad').addEventListener('change', e => { state.opciones.incluirUtilidad = e.target.checked; recalcular(); });

    /* Edición en vivo de saldos y parámetros de depreciación */
    document.addEventListener('change', e => {
      const campo = e.target.dataset && e.target.dataset.campo;
      if (!campo) return;
      const id = e.target.dataset.id;
      state.overrides[id] = state.overrides[id] || {};
      if (campo === 'grupo') state.overrides[id].grupo = e.target.value;
      else {
        const num = Number(e.target.value);
        state.overrides[id][campo] = isFinite(num) ? num : 0;
      }
      recalcular();
    });

    /* Arrastrar y soltar */
    const zona = el('zona-carga');
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('dragging'); }));
    zona.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) leerArchivo(f); });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f && /\.(csv|txt)$/i.test(f.name)) leerArchivo(f);
    });
  }

  document.addEventListener('DOMContentLoaded', inicializar);

  return { formato, formatoCorto, cargarTexto, recalcular, state, valorIndicador };
})();

window.App = App;

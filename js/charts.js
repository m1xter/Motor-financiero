/* ============================================================
   charts.js — Visualizaciones del dashboard (Chart.js)
   ============================================================ */

const Charts = (() => {

  const instancias = {};
  const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();

  function base() {
    Chart.defaults.color = css('--text-dim');
    Chart.defaults.borderColor = css('--border');
    Chart.defaults.font.family = "'Inter', sans-serif";
  }

  function pintar(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    base();
    if (instancias[id]) instancias[id].destroy();
    instancias[id] = new Chart(canvas, config);
  }

  const PALETA = ['#4c8dff', '#7c5cff', '#22b8cf', '#12b886', '#f2a20c', '#ff922b', '#f06595', '#b197fc'];

  /* ---------- Estructura del activo ---------- */
  function estructuraActivo(estados, comp) {
    const b = estados.balance;
    const otrosCorrientes = b.activoCorriente - comp.efectivo - comp.valoresNegociables - comp.cuentasPorCobrar - comp.inventarios;
    const datos = [
      ['Efectivo y bancos', comp.efectivo],
      ['Valores negociables', comp.valoresNegociables],
      ['Cuentas por cobrar', comp.cuentasPorCobrar],
      ['Inventarios', comp.inventarios],
      ['Otros activos corrientes', otrosCorrientes],
      ['Activo no corriente (neto)', b.activoNoCorriente]
    ].filter(([, v]) => Math.abs(v) > 0.01);

    pintar('chart-activo', {
      type: 'doughnut',
      data: {
        labels: datos.map(d => d[0]),
        datasets: [{ data: datos.map(d => d[1]), backgroundColor: PALETA, borderWidth: 2, borderColor: css('--panel') }]
      },
      options: {
        maintainAspectRatio: false, cutout: '58%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } }
      }
    });
  }

  /* ---------- Financiamiento ---------- */
  function financiamiento(estados) {
    const b = estados.balance;
    pintar('chart-financiamiento', {
      type: 'bar',
      data: {
        labels: ['Pasivo Corriente', 'Pasivo No Corriente', 'Patrimonio'],
        datasets: [{
          label: 'Monto',
          data: [b.pasivoCorriente, b.pasivoNoCorriente, b.patrimonio],
          backgroundColor: ['#ff922b', '#f06595', '#12b886'], borderRadius: 8
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => App.formatoCorto(v) } } }
      }
    });
  }

  /* ---------- Razones en "veces" ---------- */
  function razones(ratios) {
    const buscar = clave => {
      for (const g of ratios.grupos) {
        const i = g.indicadores.find(x => x.clave === clave);
        if (i) return i.valor === null ? 0 : i.valor;
      }
      return 0;
    };
    pintar('chart-ratios', {
      type: 'bar',
      data: {
        labels: ['Razón\nCirculante', 'Prueba\nÁcida', 'Razón de\nEfectivo', 'Apalanc.\nInterno', 'Deuda /\nPatrimonio', 'Rotación\nActivos'],
        datasets: [{
          label: 'Veces',
          data: [buscar('razonCirculante'), buscar('pruebaAcida'), buscar('razonEfectivo'),
                 buscar('apalancamientoInterno'), buscar('deudaPatrimonio'), buscar('rotacionActivos')],
          backgroundColor: PALETA, borderRadius: 8
        }]
      },
      options: {
        maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
  }

  /* ---------- Márgenes y rendimientos ---------- */
  function rentabilidad(ratios) {
    const grupo = ratios.grupos.find(g => g.clave === 'rentabilidad');
    const items = grupo.indicadores.filter(i => i.unidad === 'porcentaje');
    pintar('chart-rentabilidad', {
      type: 'radar',
      data: {
        labels: items.map(i => i.nombre.split('—')[0].replace('Margen de ', '').trim()),
        datasets: [{
          label: '%',
          data: items.map(i => (i.valor === null ? 0 : i.valor * 100)),
          backgroundColor: 'rgba(76,141,255,.22)', borderColor: '#4c8dff',
          pointBackgroundColor: '#7c5cff', borderWidth: 2
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { angleLines: { color: css('--border') }, grid: { color: css('--border') }, ticks: { backdropColor: 'transparent' } } }
      }
    });
  }

  function refrescarTodo(estados, ratios) {
    estructuraActivo(estados, ratios.componentes);
    financiamiento(estados);
    razones(ratios);
    rentabilidad(ratios);
  }

  return { refrescarTodo, estructuraActivo, financiamiento, razones, rentabilidad };
})();

window.Charts = Charts;

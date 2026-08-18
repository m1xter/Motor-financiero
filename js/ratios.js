/* ============================================================
   ratios.js — Motor de cálculo de índices financieros (Fase 2)
   ============================================================
   Genera los cuatro grandes grupos de razones financieras:
   liquidez, apalancamiento, actividad y rentabilidad.
   Todo el cálculo es automático: cualquier variación en el CSV
   (o edición de un saldo en la interfaz) recalcula el panel.
   ============================================================ */

const Ratios = (() => {

  const N = s => CsvParser.normalize(s);
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  /* División segura: null indica indicador no calculable */
  const div = (a, b) => (Math.abs(b) < 1e-9 ? null : a / b);

  const PATRONES = {
    efectivo: /caja|efectivo|banco|equivalentes de efectivo|fondo fijo/,
    valoresNegociables: /valores negociables|inversiones temporales|inversiones a corto plazo|titulos negociables/,
    cuentasPorCobrar: /cuentas por cobrar|clientes|efectos por cobrar|documentos por cobrar|deudores comerciales|incobrables|provision para cuentas/,
    inventarios: /inventario|mercancia|materia prima|materias primas|productos en proceso|productos terminados|existencias/,
    gastosAnticipados: /anticipado|anticipados|prepagado|anticipos a proveedores/,
    proveedores: /proveedores|cuentas por pagar|efectos por pagar|documentos por pagar|acreedores comerciales/
  };

  /* Suma neta de las cuentas de un grupo que casan con un patrón */
  function bloque(cuentas, grupo, patron) {
    return sum(cuentas
      .filter(c => c.grupo === grupo && patron.test(N(c.nombre)))
      .map(c => (c.contra ? -1 : 1) * Math.abs(c.saldo)));
  }

  function componentes(cuentas) {
    return {
      efectivo: bloque(cuentas, 'ACTIVO_CORRIENTE', PATRONES.efectivo),
      valoresNegociables: bloque(cuentas, 'ACTIVO_CORRIENTE', PATRONES.valoresNegociables),
      cuentasPorCobrar: bloque(cuentas, 'ACTIVO_CORRIENTE', PATRONES.cuentasPorCobrar),
      inventarios: bloque(cuentas, 'ACTIVO_CORRIENTE', PATRONES.inventarios),
      gastosAnticipados: bloque(cuentas, 'ACTIVO_CORRIENTE', PATRONES.gastosAnticipados),
      proveedores: bloque(cuentas, 'PASIVO_CORRIENTE', PATRONES.proveedores)
    };
  }

  /* Escala de semáforo: 'bueno' | 'alerta' | 'critico' | 'neutro' */
  function semaforo(valor, { bueno, alerta }, mayorEsMejor = true) {
    if (valor === null || !isFinite(valor)) return 'neutro';
    if (mayorEsMejor) {
      if (valor >= bueno) return 'bueno';
      if (valor >= alerta) return 'alerta';
      return 'critico';
    }
    if (valor <= bueno) return 'bueno';
    if (valor <= alerta) return 'alerta';
    return 'critico';
  }

  function calcular(estados, cuentas) {
    const b = estados.balance;
    const r = estados.resultados;
    const comp = componentes(cuentas);

    const ac = b.activoCorriente, pc = b.pasivoCorriente;
    const activoTotal = b.activoTotal, pasivoTotal = b.pasivoTotal, patrimonio = b.patrimonio;

    /* ---------------- LIQUIDEZ ---------------- */
    const razonCirculante = div(ac, pc);
    const pruebaAcida = div(ac - comp.inventarios - comp.gastosAnticipados, pc);
    const razonEfectivo = div(comp.efectivo + comp.valoresNegociables, pc);
    const capitalTrabajo = ac - pc;
    const razonCapitalTrabajo = div(capitalTrabajo, activoTotal);

    const liquidez = [
      ind('razonCirculante', 'Razón Circulante', 'Activo Corriente ÷ Pasivo Corriente', razonCirculante, 'veces',
          semaforo(razonCirculante, { bueno: 2, alerta: 1 }),
          'Capacidad de cubrir deudas de corto plazo con activos corrientes. Referencia sana: ≥ 2.'),
      ind('pruebaAcida', 'Prueba Ácida', '(Activo Corriente − Inventarios − Gastos Anticipados) ÷ Pasivo Corriente', pruebaAcida, 'veces',
          semaforo(pruebaAcida, { bueno: 1, alerta: 0.7 }),
          'Liquidez inmediata sin depender de la venta de inventarios. Referencia: ≥ 1.'),
      ind('razonEfectivo', 'Razón de Efectivo', '(Efectivo + Valores Negociables) ÷ Pasivo Corriente', razonEfectivo, 'veces',
          semaforo(razonEfectivo, { bueno: 0.3, alerta: 0.1 }),
          'Porción de la deuda corriente pagable de inmediato con tesorería.'),
      ind('capitalTrabajo', 'Capital de Trabajo Neto', 'Activo Corriente − Pasivo Corriente', capitalTrabajo, 'moneda',
          capitalTrabajo > 0 ? 'bueno' : 'critico',
          'Colchón financiero disponible para la operación diaria.'),
      ind('razonCapitalTrabajo', 'Capital de Trabajo sobre Activos', 'Capital de Trabajo ÷ Activo Total', razonCapitalTrabajo, 'porcentaje',
          semaforo(razonCapitalTrabajo, { bueno: 0.2, alerta: 0.05 }),
          'Peso del capital de trabajo dentro de la estructura de activos.')
    ];

    /* ---------------- APALANCAMIENTO ---------------- */
    const razonEndeudamiento = div(pasivoTotal, activoTotal);
    const deudaPatrimonio = div(pasivoTotal, patrimonio);
    const apalancamientoInterno = div(patrimonio, pasivoTotal);
    const autonomiaFinanciera = div(patrimonio, activoTotal);
    const endeudamientoLP = div(b.pasivoNoCorriente, b.pasivoNoCorriente + patrimonio);
    const coberturaIntereses = div(r.utilidadOperativa, r.gastosFinancieros);
    const apalancamientoTotal = div(activoTotal, patrimonio);

    const apalancamiento = [
      ind('razonEndeudamiento', 'Razón de Endeudamiento', 'Pasivo Total ÷ Activo Total', razonEndeudamiento, 'porcentaje',
          semaforo(razonEndeudamiento, { bueno: 0.4, alerta: 0.6 }, false),
          'Proporción del activo financiada por terceros. Referencia prudente: ≤ 40 %.'),
      ind('apalancamientoInterno', 'Razón de Apalancamiento Interno (X₂)', 'Patrimonio ÷ Pasivo Total', apalancamientoInterno, 'veces',
          semaforo(apalancamientoInterno, { bueno: 1.5, alerta: 1 }),
          'Respaldo patrimonial frente a la deuda total. Variable X₂ del modelo discriminante.'),
      ind('deudaPatrimonio', 'Razón Deuda–Patrimonio', 'Pasivo Total ÷ Patrimonio', deudaPatrimonio, 'veces',
          semaforo(deudaPatrimonio, { bueno: 0.66, alerta: 1 }, false),
          'Bolívares de deuda por cada bolívar de patrimonio.'),
      ind('autonomiaFinanciera', 'Autonomía Financiera', 'Patrimonio ÷ Activo Total', autonomiaFinanciera, 'porcentaje',
          semaforo(autonomiaFinanciera, { bueno: 0.6, alerta: 0.4 }),
          'Independencia respecto al financiamiento externo.'),
      ind('endeudamientoLP', 'Endeudamiento a Largo Plazo', 'Pasivo No Corriente ÷ (Pasivo No Corriente + Patrimonio)', endeudamientoLP, 'porcentaje',
          semaforo(endeudamientoLP, { bueno: 0.3, alerta: 0.5 }, false),
          'Peso de la deuda estructural en el capital permanente.'),
      ind('coberturaIntereses', 'Cobertura de Intereses', 'Utilidad Operativa ÷ Gastos Financieros', coberturaIntereses, 'veces',
          semaforo(coberturaIntereses, { bueno: 3, alerta: 1.5 }),
          'Veces que la utilidad operativa cubre la carga de intereses.'),
      ind('apalancamientoTotal', 'Multiplicador del Capital', 'Activo Total ÷ Patrimonio', apalancamientoTotal, 'veces',
          semaforo(apalancamientoTotal, { bueno: 1.7, alerta: 2.5 }, false),
          'Grado de amplificación del patrimonio vía deuda.')
    ];

    /* ---------------- ACTIVIDAD ---------------- */
    const rotacionInventario = div(r.costoVentas, comp.inventarios);
    const diasInventario = rotacionInventario ? 365 / rotacionInventario : null;
    const rotacionCxC = div(r.ventasNetas, comp.cuentasPorCobrar);
    const periodoCobro = rotacionCxC ? 365 / rotacionCxC : null;
    const rotacionCxP = div(r.costoVentas, comp.proveedores);
    const periodoPago = rotacionCxP ? 365 / rotacionCxP : null;
    const rotacionActivos = div(r.ventasNetas, activoTotal);
    const rotacionActivoFijo = div(r.ventasNetas, b.activoNoCorriente);
    const cicloEfectivo = (diasInventario !== null && periodoCobro !== null)
      ? diasInventario + periodoCobro - (periodoPago || 0) : null;

    const actividad = [
      ind('rotacionInventario', 'Rotación de Inventario', 'Costo de Ventas ÷ Inventarios', rotacionInventario, 'veces',
          semaforo(rotacionInventario, { bueno: 6, alerta: 3 }),
          'Veces que el inventario se renueva en el ejercicio.'),
      ind('diasInventario', 'Días de Inventario', '365 ÷ Rotación de Inventario', diasInventario, 'dias',
          semaforo(diasInventario, { bueno: 60, alerta: 120 }, false),
          'Días promedio que la mercancía permanece en almacén.'),
      ind('rotacionCxC', 'Rotación de Cuentas por Cobrar', 'Ventas Netas ÷ Cuentas por Cobrar', rotacionCxC, 'veces',
          semaforo(rotacionCxC, { bueno: 8, alerta: 4 }),
          'Eficiencia en la recuperación de la cartera de clientes.'),
      ind('periodoCobro', 'Período Promedio de Cobro', '365 ÷ Rotación de Cuentas por Cobrar', periodoCobro, 'dias',
          semaforo(periodoCobro, { bueno: 45, alerta: 90 }, false),
          'Días que tarda la empresa en cobrar sus ventas a crédito.'),
      ind('periodoPago', 'Período Promedio de Pago', '365 ÷ (Costo de Ventas ÷ Proveedores)', periodoPago, 'dias',
          'neutro',
          'Días que la empresa tarda en pagar a sus proveedores.'),
      ind('cicloEfectivo', 'Ciclo de Conversión de Efectivo', 'Días de Inventario + Cobro − Pago', cicloEfectivo, 'dias',
          semaforo(cicloEfectivo, { bueno: 60, alerta: 120 }, false),
          'Días de financiamiento propio requeridos por el ciclo operativo.'),
      ind('rotacionActivos', 'Rotación de Activos Totales', 'Ventas Netas ÷ Activo Total', rotacionActivos, 'veces',
          semaforo(rotacionActivos, { bueno: 1.5, alerta: 0.8 }),
          'Ventas generadas por cada unidad monetaria invertida en activos.'),
      ind('rotacionActivoFijo', 'Rotación del Activo Fijo', 'Ventas Netas ÷ Activo No Corriente', rotacionActivoFijo, 'veces',
          semaforo(rotacionActivoFijo, { bueno: 2, alerta: 1 }),
          'Productividad de la inversión en propiedad, planta y equipo.')
    ];

    /* ---------------- RENTABILIDAD ---------------- */
    const margenBruto = div(r.utilidadBruta, r.ventasNetas);
    const margenOperativo = div(r.utilidadOperativa, r.ventasNetas);
    const margenNeto = div(r.utilidadNeta, r.ventasNetas);
    const roa = div(r.utilidadNeta, activoTotal);
    const roe = div(r.utilidadNeta, patrimonio);
    const roi = div(r.utilidadOperativa, activoTotal);

    const rentabilidad = [
      ind('margenBruto', 'Margen de Utilidad Bruta', 'Utilidad Bruta ÷ Ventas Netas', margenBruto, 'porcentaje',
          semaforo(margenBruto, { bueno: 0.35, alerta: 0.2 }),
          'Eficiencia en el control del costo de ventas.'),
      ind('margenOperativo', 'Margen Operativo', 'Utilidad Operativa ÷ Ventas Netas', margenOperativo, 'porcentaje',
          semaforo(margenOperativo, { bueno: 0.15, alerta: 0.05 }),
          'Rentabilidad del negocio antes de intereses e impuestos.'),
      ind('margenNeto', 'Margen de Utilidad Neta', 'Utilidad Neta ÷ Ventas Netas', margenNeto, 'porcentaje',
          semaforo(margenNeto, { bueno: 0.1, alerta: 0.03 }),
          'Utilidad final obtenida por cada unidad vendida.'),
      ind('roa', 'ROA — Rendimiento sobre Activos', 'Utilidad Neta ÷ Activo Total', roa, 'porcentaje',
          semaforo(roa, { bueno: 0.08, alerta: 0.03 }),
          'Capacidad de los activos para generar utilidades.'),
      ind('roe', 'ROE — Rendimiento sobre Patrimonio', 'Utilidad Neta ÷ Patrimonio', roe, 'porcentaje',
          semaforo(roe, { bueno: 0.15, alerta: 0.06 }),
          'Retorno obtenido por los accionistas.'),
      ind('roi', 'Rendimiento Operativo de la Inversión', 'Utilidad Operativa ÷ Activo Total', roi, 'porcentaje',
          semaforo(roi, { bueno: 0.1, alerta: 0.04 }),
          'Rendimiento del activo por la operación, sin efectos de financiamiento.')
    ];

    return {
      componentes: comp,
      grupos: [
        { clave: 'liquidez', nombre: 'Liquidez', icono: '💧', indicadores: liquidez },
        { clave: 'apalancamiento', nombre: 'Apalancamiento', icono: '⚖️', indicadores: apalancamiento },
        { clave: 'actividad', nombre: 'Actividad', icono: '🔄', indicadores: actividad },
        { clave: 'rentabilidad', nombre: 'Rentabilidad', icono: '📈', indicadores: rentabilidad }
      ],
      clave: {
        razonCirculante, pruebaAcida, razonEndeudamiento, apalancamientoInterno,
        margenNeto, roa, roe, rotacionActivos
      }
    };
  }

  function ind(clave, nombre, formula, valor, unidad, estado, descripcion) {
    return { clave, nombre, formula, valor, unidad, estado, descripcion };
  }

  return { calcular, componentes };
})();

window.Ratios = Ratios;

/* ============================================================
   statements.js — Estructuración de los estados financieros
   ============================================================
   Construye el Balance General y el Estado de Resultados a partir
   de las cuentas ya clasificadas, aplica la depreciación calculada
   y valida la ecuación de equilibrio contable:

        ACTIVO = PASIVO + PATRIMONIO

   Si existe descuadre, se captura el error y se reporta para que
   la interfaz muestre la alerta correspondiente.
   ============================================================ */

const Statements = (() => {

  const TOLERANCIA = 0.5;   // holgura por redondeo de decimales
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const N = s => CsvParser.normalize(s);

  const esOtroIngreso = c => /otros ingresos|ingresos financieros|ingreso financiero|ganancia en venta/.test(N(c.nombre));
  const esGastoDepreciacion = c => c.grupo === 'GASTO_OPERATIVO' && /depreciacion|amortizacion/.test(N(c.nombre));

  /* ---------- Construcción del Balance y el Estado de Resultados ---------- */
  function construir(cuentas, opciones = {}) {
    const errores = [];
    const notas = [];

    const de = g => cuentas.filter(c => c.grupo === g);
    const neto = lista => sum(lista.map(c => (c.contra ? -1 : 1) * Math.abs(c.saldo)));

    /* --- Depreciación calculada por el motor (línea recta) --- */
    const hayDepreciacionEnCsv = cuentas.some(c => c.contra && c.grupo === 'ACTIVO_NO_CORRIENTE');
    const hayGastoDepreciacionEnCsv = cuentas.some(esGastoDepreciacion);
    const aplicarDepreciacion = opciones.aplicarDepreciacion !== undefined
      ? !!opciones.aplicarDepreciacion
      : !hayDepreciacionEnCsv;   // evita duplicar si el CSV ya trae la acumulada

    const depreciables = cuentas.filter(c => c.depreciable && c.depreciacionAnual > 0);
    const depreciacionAnual = aplicarDepreciacion ? sum(depreciables.map(c => c.depreciacionAnual)) : 0;
    const depreciacionAcumuladaCalculada = aplicarDepreciacion ? sum(depreciables.map(c => c.depreciacionAcumulada)) : 0;
    /* La depreciación de ejercicios anteriores ya afectó resultados de años previos:
       por partida doble se carga contra el patrimonio, no contra el resultado actual. */
    const depreciacionAnterior = aplicarDepreciacion
      ? sum(depreciables.map(c => Math.max(c.depreciacionAcumulada - c.depreciacionAnual, 0)))
      : 0;

    if (hayDepreciacionEnCsv && aplicarDepreciacion) {
      notas.push('El CSV ya incluye depreciación acumulada; la depreciación calculada se está sumando por indicación manual.');
    }

    /* --- Balance General --- */
    const acLista = de('ACTIVO_CORRIENTE');
    const ancLista = de('ACTIVO_NO_CORRIENTE');
    const pcLista = de('PASIVO_CORRIENTE');
    const pncLista = de('PASIVO_NO_CORRIENTE');
    const patLista = de('PATRIMONIO');

    const activoCorriente = neto(acLista);
    const activoNoCorrienteCsv = neto(ancLista);
    const activoNoCorriente = activoNoCorrienteCsv - depreciacionAcumuladaCalculada;
    const activoTotal = activoCorriente + activoNoCorriente;

    const pasivoCorriente = neto(pcLista);
    const pasivoNoCorriente = neto(pncLista);
    const pasivoTotal = pasivoCorriente + pasivoNoCorriente;

    const patrimonioCsv = neto(patLista);
    const patrimonioAjustado = patrimonioCsv - depreciacionAnterior;

    /* --- Estado de Resultados --- */
    const ingresosLista = de('INGRESO');
    const ventasBrutas = sum(ingresosLista.filter(c => !c.contra && !esOtroIngreso(c)).map(c => Math.abs(c.saldo)));
    const devoluciones = sum(ingresosLista.filter(c => c.contra).map(c => Math.abs(c.saldo)));
    const otrosIngresos = sum(ingresosLista.filter(c => !c.contra && esOtroIngreso(c)).map(c => Math.abs(c.saldo)));
    const ventasNetas = ventasBrutas - devoluciones;

    const costoVentas = sum(de('COSTO').map(c => Math.abs(c.saldo)));
    const utilidadBruta = ventasNetas - costoVentas;

    const gastosOperativosCsv = sum(de('GASTO_OPERATIVO').map(c => Math.abs(c.saldo)));
    const depreciacionEnGastos = (aplicarDepreciacion && !hayGastoDepreciacionEnCsv) ? depreciacionAnual : 0;
    const gastosOperativos = gastosOperativosCsv + depreciacionEnGastos;
    if (depreciacionEnGastos > 0) {
      notas.push('La cuota anual de depreciación calculada se incorporó como gasto operativo del ejercicio.');
    }

    const utilidadOperativa = utilidadBruta - gastosOperativos + otrosIngresos;
    const gastosFinancieros = sum(de('GASTO_FINANCIERO').map(c => Math.abs(c.saldo)));
    const utilidadAntesImpuestos = utilidadOperativa - gastosFinancieros;
    const impuestos = sum(de('IMPUESTO').map(c => Math.abs(c.saldo)));
    const utilidadNeta = utilidadAntesImpuestos - impuestos;

    const hayEstadoResultados = ingresosLista.length > 0 || costoVentas > 0 || gastosOperativosCsv > 0;

    /* --- Utilidad del ejercicio dentro del patrimonio ---
       Si el patrimonio del CSV no incluye el resultado del ejercicio, el
       balance descuadra exactamente por esa utilidad; el motor lo detecta. */
    const patrimonioTraeResultado = patLista.some(c => /ejercicio|periodo/.test(N(c.nombre)));
    const descuadreSinUtilidad = activoTotal - (pasivoTotal + patrimonioAjustado);

    let incluirUtilidad;
    if (opciones.incluirUtilidad !== undefined) {
      incluirUtilidad = !!opciones.incluirUtilidad;
    } else {
      incluirUtilidad = hayEstadoResultados && !patrimonioTraeResultado &&
        Math.abs(descuadreSinUtilidad - utilidadNeta) <= TOLERANCIA;
    }

    const patrimonio = patrimonioAjustado + (incluirUtilidad ? utilidadNeta : 0);
    if (incluirUtilidad) {
      notas.push('El resultado del ejercicio se acumuló al patrimonio para cerrar la ecuación contable.');
    }
    if (depreciacionAnterior > 0) {
      notas.push(`La depreciación de ejercicios anteriores (${depreciacionAnterior.toFixed(2)}) se cargó contra los resultados acumulados del patrimonio, manteniendo la partida doble.`);
    }

    /* --- Validación matemática de la ecuación de equilibrio --- */
    const pasivoMasPatrimonio = pasivoTotal + patrimonio;
    const descuadre = activoTotal - pasivoMasPatrimonio;
    const cuadra = Math.abs(descuadre) <= TOLERANCIA;

    if (!cuadra) {
      errores.push({
        tipo: 'ECUACION_DESBALANCEADA',
        mensaje: `La ecuación contable no cuadra: Activo (${activoTotal.toFixed(2)}) ≠ Pasivo + Patrimonio (${pasivoMasPatrimonio.toFixed(2)}).`,
        diferencia: descuadre,
        sugerencia: sugerirCausa(descuadre, cuentas, utilidadNeta, incluirUtilidad)
      });
    }

    const sinClasificar = de('SIN_CLASIFICAR');
    if (sinClasificar.length) {
      errores.push({
        tipo: 'CUENTAS_SIN_CLASIFICAR',
        mensaje: `${sinClasificar.length} cuenta(s) no pudieron clasificarse automáticamente y quedaron fuera del balance.`,
        cuentas: sinClasificar.map(c => c.nombre),
        sugerencia: 'Reclasifíquelas manualmente en la tabla de partidas o agregue una columna "Categoría" al CSV.'
      });
    }

    return {
      balance: {
        activoCorriente, activoNoCorriente, activoNoCorrienteCsv, activoTotal,
        pasivoCorriente, pasivoNoCorriente, pasivoTotal,
        patrimonioCsv, patrimonioAjustado, depreciacionAnterior, patrimonio, pasivoMasPatrimonio,
        capitalTrabajo: activoCorriente - pasivoCorriente,
        listas: { acLista, ancLista, pcLista, pncLista, patLista }
      },
      resultados: {
        hayEstadoResultados, ventasBrutas, devoluciones, ventasNetas, costoVentas, utilidadBruta,
        gastosOperativosCsv, depreciacionEnGastos, gastosOperativos, otrosIngresos,
        utilidadOperativa, gastosFinancieros, utilidadAntesImpuestos, impuestos, utilidadNeta
      },
      depreciacion: {
        aplicada: aplicarDepreciacion,
        anual: depreciacionAnual,
        acumulada: depreciacionAcumuladaCalculada,
        ejerciciosAnteriores: depreciacionAnterior,
        detalle: depreciables.map(c => ({
          id: c.id, nombre: c.nombre, costo: Math.abs(c.saldo), vidaUtil: c.vidaUtil,
          residual: c.valorResidual, anosUso: c.anosUso,
          anual: c.depreciacionAnual, acumulada: c.depreciacionAcumulada, valorNeto: c.valorNeto,
          nota: c.notaDepreciacion
        })),
        noDepreciables: cuentas
          .filter(c => c.grupo === 'ACTIVO_NO_CORRIENTE' && !c.contra && !c.depreciable)
          .map(c => ({ id: c.id, nombre: c.nombre, monto: Math.abs(c.saldo), nota: c.notaDepreciacion }))
      },
      validacion: { cuadra, descuadre, tolerancia: TOLERANCIA, incluirUtilidad, patrimonioTraeResultado },
      errores,
      notas
    };
  }

  /* ---------- Diagnóstico del descuadre ---------- */
  function sugerirCausa(descuadre, cuentas, utilidadNeta, incluirUtilidad) {
    if (!incluirUtilidad && Math.abs(descuadre - utilidadNeta) <= TOLERANCIA && Math.abs(utilidadNeta) > TOLERANCIA) {
      return 'La diferencia equivale al resultado del ejercicio: active la opción "Acumular utilidad del ejercicio al patrimonio".';
    }
    const candidatas = cuentas
      .filter(c => Math.abs(Math.abs(c.saldo) - Math.abs(descuadre)) <= TOLERANCIA)
      .map(c => c.nombre);
    if (candidatas.length) {
      return `El monto del descuadre coincide con: ${candidatas.join(', ')}. Verifique su clasificación o su signo.`;
    }
    return descuadre > 0
      ? 'El activo excede al pasivo más patrimonio: revise pasivos u aportes de capital faltantes en el CSV.'
      : 'El pasivo más patrimonio excede al activo: revise activos faltantes o saldos con signo invertido.';
  }

  return { construir, TOLERANCIA };
})();

window.Statements = Statements;

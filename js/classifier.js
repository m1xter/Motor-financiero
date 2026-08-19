/* ============================================================
   classifier.js — Clasificación dinámica de partidas contables
   ============================================================
   Fase 1 del proyecto: clasificar cada cuenta del CSV según su
   grado de liquidez (activos) o exigibilidad (pasivos), separar
   patrimonio y cuentas de resultados, y calcular la depreciación
   por línea recta de los activos fijos (el Terreno NUNCA se
   deprecia).
   ============================================================ */

const Classifier = (() => {

  const N = s => CsvParser.normalize(s);

  /* Grupos manejados por el motor */
  const GRUPOS = {
    ACTIVO_CORRIENTE: 'Activo Corriente',
    ACTIVO_NO_CORRIENTE: 'Activo No Corriente',
    PASIVO_CORRIENTE: 'Pasivo Corriente',
    PASIVO_NO_CORRIENTE: 'Pasivo No Corriente',
    PATRIMONIO: 'Patrimonio',
    INGRESO: 'Ingresos',
    COSTO: 'Costo de Ventas',
    GASTO_OPERATIVO: 'Gastos Operativos',
    GASTO_FINANCIERO: 'Gastos Financieros',
    IMPUESTO: 'Impuesto sobre la Renta',
    SIN_CLASIFICAR: 'Sin Clasificar'
  };

  /* ---------- Diccionario de reconocimiento por palabras clave ----------
     El orden importa: la primera regla que coincide gana. Las reglas más
     específicas se declaran primero. `contra: true` indica cuenta de
     naturaleza contraria dentro de su grupo (ej. depreciación acumulada). */
  const REGLAS = [
    /* --- Cuentas de valuación (contra-activo) --- */
    { grupo: 'ACTIVO_NO_CORRIENTE', contra: true, liquidez: 90, claves: ['depreciacion acumulada', 'deprec. acumulada', 'amortizacion acumulada', 'agotamiento acumulado'] },
    { grupo: 'ACTIVO_CORRIENTE', contra: true, liquidez: 32, claves: ['provision para cuentas', 'provision cuentas', 'estimacion para cuentas', 'incobrables', 'provision de incobrables'] },

    /* --- Activo corriente (ordenado por liquidez decreciente) --- */
    { grupo: 'ACTIVO_CORRIENTE', liquidez: 10, claves: ['caja chica', 'caja', 'efectivo', 'banco', 'bancos', 'cuenta corriente', 'equivalentes de efectivo', 'fondo fijo'] },
    { grupo: 'ACTIVO_CORRIENTE', liquidez: 20, claves: ['valores negociables', 'inversiones temporales', 'inversiones a corto plazo', 'titulos negociables', 'colocaciones a corto plazo'] },
    { grupo: 'ACTIVO_CORRIENTE', liquidez: 30, claves: ['cuentas por cobrar', 'clientes', 'efectos por cobrar', 'documentos por cobrar', 'deudores comerciales', 'cuentas por cobrar comerciales'] },
    { grupo: 'ACTIVO_CORRIENTE', liquidez: 35, claves: ['iva credito fiscal', 'credito fiscal', 'impuestos pagados por anticipado', 'anticipo de impuestos', 'islr retenido', 'retenciones por cobrar'] },
    { grupo: 'ACTIVO_CORRIENTE', liquidez: 40, claves: ['inventario', 'inventarios', 'mercancia', 'mercancias', 'materia prima', 'materias primas', 'productos en proceso', 'productos terminados', 'existencias', 'suministros', 'materiales'] },
    { grupo: 'ACTIVO_CORRIENTE', liquidez: 50, claves: ['pagado por anticipado', 'pagados por anticipado', 'gastos anticipados', 'seguros pagados', 'alquiler pagado', 'anticipo a proveedores', 'anticipos a proveedores', 'gastos prepagados'] },

    /* --- Activo no corriente --- */
    { grupo: 'ACTIVO_NO_CORRIENTE', liquidez: 60, claves: ['inversiones permanentes', 'inversiones a largo plazo', 'inversiones en acciones', 'inversiones perman'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: false, liquidez: 70, claves: ['terreno', 'terrenos', 'lote de terreno', 'parcela'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: true, vidaDefault: 20, liquidez: 71, claves: ['edificio', 'edificios', 'edificaciones', 'construccion', 'construcciones', 'galpon', 'planta fisica', 'inmueble'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: true, vidaDefault: 10, liquidez: 72, claves: ['maquinaria', 'maquinarias', 'equipo de planta', 'equipos de planta', 'planta y equipo', 'maquinas'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: true, vidaDefault: 5, liquidez: 73, claves: ['vehiculo', 'vehiculos', 'flota', 'camion', 'camiones', 'automovil', 'transporte'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: true, vidaDefault: 3, liquidez: 74, claves: ['equipo de computacion', 'equipos de computacion', 'equipo de computo', 'computadoras', 'hardware', 'servidores', 'equipo informatico'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: true, vidaDefault: 10, liquidez: 75, claves: ['mobiliario', 'muebles', 'enseres', 'equipo de oficina', 'equipos de oficina', 'herramientas', 'equipo medico', 'instalaciones'] },
    { grupo: 'ACTIVO_NO_CORRIENTE', depreciable: false, liquidez: 80, claves: ['intangible', 'intangibles', 'patente', 'patentes', 'marca', 'marcas', 'software', 'licencia', 'licencias', 'plusvalia', 'credito mercantil', 'goodwill', 'derecho de llave', 'cargos diferidos', 'gastos de organizacion'] },

    /* --- Pasivo corriente (mayor exigibilidad primero) --- */
    { grupo: 'PASIVO_CORRIENTE', liquidez: 10, claves: ['sobregiro', 'sobregiros bancarios'] },
    { grupo: 'PASIVO_CORRIENTE', liquidez: 20, claves: ['proveedores', 'cuentas por pagar', 'efectos por pagar', 'documentos por pagar', 'acreedores comerciales'] },
    { grupo: 'PASIVO_CORRIENTE', liquidez: 25, claves: ['sueldos por pagar', 'salarios por pagar', 'nomina por pagar', 'bono por pagar a empleados', 'retenciones por pagar', 'seguro social por pagar', 'ivss por pagar'] },
    { grupo: 'PASIVO_CORRIENTE', liquidez: 30, claves: ['impuestos por pagar', 'iva por pagar', 'islr por pagar', 'debito fiscal', 'impuesto por pagar'] },
    { grupo: 'PASIVO_CORRIENTE', liquidez: 35, claves: ['intereses por pagar', 'dividendos por pagar', 'gastos acumulados por pagar', 'gastos acumulados', 'acumulaciones por pagar', 'anticipos de clientes', 'anticipo de clientes', 'ingresos diferidos a corto plazo'] },
    { grupo: 'PASIVO_CORRIENTE', liquidez: 40, claves: ['prestamo bancario a corto plazo', 'prestamos a corto plazo', 'porcion circulante', 'porcion corriente', 'deuda a corto plazo', 'linea de credito', 'prestamo', 'prestamos', 'prestamo bancario', 'credito bancario'] },

    /* --- Pasivo no corriente --- */
    { grupo: 'PASIVO_NO_CORRIENTE', liquidez: 60, claves: ['hipoteca', 'hipotecas', 'hipotecario', 'prestamo hipotecario'] },
    { grupo: 'PASIVO_NO_CORRIENTE', liquidez: 65, claves: ['bonos por pagar', 'obligaciones por pagar', 'papeles comerciales a largo plazo'] },
    { grupo: 'PASIVO_NO_CORRIENTE', liquidez: 70, claves: ['prestamo a largo plazo', 'prestamos a largo plazo', 'deuda a largo plazo', 'credito a largo plazo', 'arrendamiento financiero'] },
    { grupo: 'PASIVO_NO_CORRIENTE', liquidez: 75, claves: ['prestaciones sociales', 'pasivo laboral', 'antiguedad de empleados', 'provision para prestaciones', 'apartado de prestaciones', 'pension', 'jubilacion'] },
    { grupo: 'PASIVO_NO_CORRIENTE', liquidez: 80, claves: ['ingresos diferidos a largo plazo', 'impuesto diferido', 'pasivo diferido'] },

    /* --- Patrimonio --- */
    { grupo: 'PATRIMONIO', liquidez: 10, claves: ['capital social', 'capital suscrito', 'capital pagado', 'capital', 'acciones comunes', 'acciones preferentes', 'aporte de socios', 'aportes de capital'] },
    { grupo: 'PATRIMONIO', liquidez: 20, claves: ['prima en emision', 'prima de emision', 'superavit de capital', 'actualizacion del patrimonio', 'revalorizacion', 'superavit por revaluacion'] },
    { grupo: 'PATRIMONIO', liquidez: 30, claves: ['reserva legal', 'reservas', 'reserva estatutaria', 'apartado de reservas'] },
    { grupo: 'PATRIMONIO', liquidez: 40, claves: ['utilidades retenidas', 'utilidades no distribuidas', 'resultados acumulados', 'ganancias acumuladas', 'superavit acumulado', 'utilidades acumuladas', 'perdidas acumuladas', 'deficit acumulado'] },
    { grupo: 'PATRIMONIO', liquidez: 50, claves: ['utilidad del ejercicio', 'resultado del ejercicio', 'utilidad neta del ejercicio', 'perdida del ejercicio', 'utilidad del periodo'] },

    /* --- Estado de Resultados --- */
    { grupo: 'INGRESO', contra: true, claves: ['devoluciones en ventas', 'descuentos en ventas', 'rebajas en ventas', 'devoluciones sobre ventas'] },
    { grupo: 'INGRESO', claves: ['ventas', 'ingresos por servicios', 'ingresos operacionales', 'ingresos', 'otros ingresos', 'ingresos financieros'] },
    { grupo: 'COSTO', claves: ['costo de ventas', 'costo de la mercancia vendida', 'costo de mercancia vendida', 'costo de produccion', 'costo de servicios', 'compras'] },
    { grupo: 'GASTO_FINANCIERO', claves: ['gastos financieros', 'gasto por intereses', 'intereses pagados', 'gasto de intereses', 'comisiones bancarias'] },
    { grupo: 'IMPUESTO', claves: ['gasto de islr', 'gasto por impuesto', 'impuesto sobre la renta', 'islr del ejercicio', 'gasto islr'] },
    { grupo: 'GASTO_OPERATIVO', claves: ['gastos de administracion', 'gastos administrativos', 'gastos de ventas', 'gastos de venta', 'gasto de sueldos', 'sueldos y salarios', 'gasto de alquiler', 'alquiler', 'publicidad', 'gasto de depreciacion', 'depreciacion del ejercicio', 'gasto de servicios', 'servicios publicos', 'gastos operativos', 'gastos generales', 'honorarios', 'mantenimiento', 'gasto'] }
  ];

  /* Alias directos escritos en la columna "categoría/tipo" del CSV */
  const ALIAS_CATEGORIA = {
    ACTIVO_NO_CORRIENTE: ['activo no corriente', 'activo fijo', 'anc', 'activo no circulante', 'propiedad planta y equipo',
                          'inversion', 'inversiones', 'bien de uso', 'bienes de uso', 'depreciable', 'inmovilizado'],
    PASIVO_NO_CORRIENTE: ['pasivo no corriente', 'pasivo a largo plazo', 'pnc', 'pasivo no circulante',
                          'deuda largo', 'deuda a largo', 'deuda largo plazo', 'pasivo largo'],
    PASIVO_CORRIENTE: ['pasivo corriente', 'pasivo circulante', 'pc', 'pasivo a corto plazo',
                       'deuda corto', 'deuda a corto', 'deuda corto plazo', 'pasivo corto', 'deuda', 'obligacion', 'por pagar'],
    ACTIVO_CORRIENTE: ['activo corriente', 'activo circulante', 'ac', 'corriente activo',
                       'liquidez', 'disponible', 'almacen', 'inventario', 'existencia',
                       'derecho cobro', 'derecho de cobro', 'por cobrar', 'realizable', 'exigible'],
    PATRIMONIO: ['patrimonio', 'capital contable', 'patrimonio neto', 'propietarios', 'socios', 'accionistas', 'capital propio'],
    GASTO_FINANCIERO: ['gasto financiero', 'gastos financieros', 'financiero'],
    IMPUESTO: ['impuesto', 'islr'],
    COSTO: ['costo', 'costos', 'costo de ventas'],
    INGRESO: ['ingreso', 'ingresos', 'venta', 'ventas'],
    GASTO_OPERATIVO: ['gasto', 'gastos', 'gasto operativo', 'gastos operativos', 'egreso', 'egresos']
  };

  function porCategoriaCsv(texto) {
    const t = N(texto).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    for (const [grupo, alias] of Object.entries(ALIAS_CATEGORIA)) {
      if (alias.some(a => t === a)) return grupo;
    }
    for (const [grupo, alias] of Object.entries(ALIAS_CATEGORIA)) {
      if (alias.some(a => t.includes(a))) return grupo;
    }
    return null;
  }

  /* Clase contable a la que pertenece cada grupo (para resolver discrepancias) */
  const CLASES = {
    ACTIVO_CORRIENTE: 'activo', ACTIVO_NO_CORRIENTE: 'activo',
    PASIVO_CORRIENTE: 'pasivo', PASIVO_NO_CORRIENTE: 'pasivo',
    PATRIMONIO: 'patrimonio',
    INGRESO: 'resultado', COSTO: 'resultado', GASTO_OPERATIVO: 'resultado',
    GASTO_FINANCIERO: 'resultado', IMPUESTO: 'resultado'
  };
  const clase = g => CLASES[g] || 'otro';

  /* Ajuste por plazo declarado en el propio nombre de la cuenta */
  function ajustarPorPlazo(grupo, nombreNorm) {
    const largo = /(largo plazo|no corriente|no circulante|a mas de un ano)/.test(nombreNorm);
    const corto = /(corto plazo|corriente|circulante|porcion circulante)/.test(nombreNorm);
    if (largo && grupo === 'ACTIVO_CORRIENTE') return 'ACTIVO_NO_CORRIENTE';
    if (largo && grupo === 'PASIVO_CORRIENTE') return 'PASIVO_NO_CORRIENTE';
    if (corto && grupo === 'ACTIVO_NO_CORRIENTE') return 'ACTIVO_CORRIENTE';
    if (corto && grupo === 'PASIVO_NO_CORRIENTE') return 'PASIVO_CORRIENTE';
    return grupo;
  }

  function buscarRegla(nombreNorm) {
    let mejor = null, mejorLargo = 0;
    for (const regla of REGLAS) {
      for (const clave of regla.claves) {
        if (nombreNorm.includes(clave) && clave.length > mejorLargo) {
          mejor = regla; mejorLargo = clave.length;
        }
      }
    }
    return mejor;
  }

  /* ---------- Clasificación de una cuenta ---------- */
  function clasificar(entry) {
    const nombreNorm = N(entry.nombre);
    const regla = buscarRegla(nombreNorm);
    const forzadoCsv = porCategoriaCsv(entry.categoriaCsv);

    /* Cuando el nombre y la columna de categoría discrepan: dentro de la misma
       clase contable manda el diccionario (es más específico: "Costo de Ventas"
       marcado como "Egreso" sigue siendo costo); si discrepan de clase, manda la
       categoría declarada en el archivo. */
    let grupo, origen;
    if (regla && forzadoCsv) {
      grupo = clase(regla.grupo) === clase(forzadoCsv) ? regla.grupo : forzadoCsv;
      origen = 'csv+diccionario';
    } else if (regla) {
      grupo = regla.grupo; origen = 'diccionario de cuentas';
    } else if (forzadoCsv) {
      grupo = forzadoCsv; origen = 'columna categoría del CSV';
    } else {
      grupo = 'SIN_CLASIFICAR'; origen = 'no reconocida';
    }

    if (grupo !== 'SIN_CLASIFICAR') grupo = ajustarPorPlazo(grupo, nombreNorm);

    const esContra = !!(regla && regla.contra);
    const depreciable = !!(regla && regla.depreciable) && grupo === 'ACTIVO_NO_CORRIENTE';

    return {
      ...entry,
      grupo,
      grupoNombre: GRUPOS[grupo],
      liquidez: regla && regla.liquidez !== undefined ? regla.liquidez : 99,
      origenClasificacion: origen,
      contra: esContra,
      depreciable,
      esTerreno: /terreno|parcela|lote de terreno/.test(nombreNorm),
      vidaUtil: entry.vidaUtil != null && entry.vidaUtil > 0 ? entry.vidaUtil : (depreciable ? (regla.vidaDefault || null) : null),
      vidaPorDefecto: entry.vidaUtil == null && depreciable,
      valorResidual: entry.valorResidual != null ? Math.abs(entry.valorResidual) : 0,
      anosUso: entry.anosUso != null && entry.anosUso > 0 ? entry.anosUso : 0
    };
  }

  /* ---------- Depreciación en línea recta ----------
     Cuota anual = (Costo - Valor residual) / Vida útil
     Regla estricta: el Terreno es el único activo fijo que NO se deprecia.
     La depreciación acumulada se limita al monto depreciable total. */
  function depreciar(cuenta) {
    const base = {
      depreciacionAnual: 0,
      depreciacionAcumulada: 0,
      valorNeto: Math.abs(cuenta.saldo),
      notaDepreciacion: ''
    };

    if (cuenta.grupo !== 'ACTIVO_NO_CORRIENTE' || cuenta.contra) return { ...cuenta, ...base };

    if (cuenta.esTerreno) {
      return { ...cuenta, ...base, notaDepreciacion: 'Terreno: activo fijo no depreciable (regla de negocio estricta).' };
    }
    if (!cuenta.depreciable) {
      return { ...cuenta, ...base, notaDepreciacion: 'Activo no sujeto a depreciación en línea recta.' };
    }
    if (!cuenta.vidaUtil || cuenta.vidaUtil <= 0) {
      return { ...cuenta, ...base, notaDepreciacion: 'Sin vida útil definida: no se calculó depreciación.' };
    }

    const costo = Math.abs(cuenta.saldo);
    const residual = Math.min(cuenta.valorResidual || 0, costo);
    const montoDepreciable = Math.max(costo - residual, 0);
    const anual = montoDepreciable / cuenta.vidaUtil;
    const acumulada = Math.min(anual * (cuenta.anosUso || 0), montoDepreciable);

    return {
      ...cuenta,
      depreciacionAnual: anual,
      depreciacionAcumulada: acumulada,
      valorNeto: costo - acumulada,
      notaDepreciacion: `Línea recta: (${costo.toFixed(2)} − ${residual.toFixed(2)}) / ${cuenta.vidaUtil} años` +
        (cuenta.vidaPorDefecto ? ' (vida útil estimada por catálogo)' : '') +
        (cuenta.anosUso ? ` · ${cuenta.anosUso} año(s) de uso acumulado` : '')
    };
  }

  function procesar(entries) {
    return entries.map(e => depreciar(clasificar(e)));
  }

  return { procesar, clasificar, depreciar, GRUPOS };
})();

window.Classifier = Classifier;

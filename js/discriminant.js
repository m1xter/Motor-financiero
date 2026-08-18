/* ============================================================
   discriminant.js — Sistema predictivo (Fase 3)
   ============================================================
   Modelo de Evaluación de Créditos mediante Análisis Discriminante:

        Z = 0.4 · X₁ + 0.6 · X₂

        X₁ = Razón Circulante              (Activo Corriente ÷ Pasivo Corriente)
        X₂ = Razón de Apalancamiento Interno (Patrimonio ÷ Pasivo Total)

   Dictamen automatizado:
        Z > 1.4            → Crédito excelente
        0.66 ≤ Z ≤ 1.4     → Crédito de riesgo normal
        Z < 0.66           → Crédito malo
   ============================================================ */

const Discriminant = (() => {

  const COEF_X1 = 0.4;
  const COEF_X2 = 0.6;
  const CORTE_SUPERIOR = 1.4;
  const CORTE_INFERIOR = 0.66;

  const CATEGORIAS = {
    EXCELENTE: {
      clave: 'EXCELENTE',
      dictamen: 'Crédito excelente',
      criterio: 'Z > 1.4',
      color: '#12b886',
      recomendacion: 'Se recomienda aprobar la solicitud de crédito. La empresa muestra holgura de liquidez y un respaldo patrimonial sólido frente a sus obligaciones; puede otorgarse financiamiento con condiciones preferenciales.'
    },
    NORMAL: {
      clave: 'NORMAL',
      dictamen: 'Crédito de riesgo normal',
      criterio: '0.66 ≤ Z ≤ 1.4',
      color: '#f2a20c',
      recomendacion: 'Se recomienda aprobar con condiciones y garantías: montos acotados, seguimiento trimestral de los indicadores de liquidez y exigencia de mejora en la estructura de endeudamiento.'
    },
    MALO: {
      clave: 'MALO',
      dictamen: 'Crédito malo',
      criterio: 'Z < 0.66',
      color: '#e03131',
      recomendacion: 'Se recomienda negar el crédito o exigir garantías reales y avales solidarios. La empresa presenta debilidad de liquidez y dependencia excesiva del financiamiento de terceros.'
    }
  };

  function clasificar(z) {
    if (z === null || !isFinite(z)) return null;
    if (z > CORTE_SUPERIOR) return CATEGORIAS.EXCELENTE;
    if (z >= CORTE_INFERIOR) return CATEGORIAS.NORMAL;
    return CATEGORIAS.MALO;
  }

  /* ---------- Evaluación del modelo ---------- */
  function evaluar(estados, ratios) {
    const b = estados.balance;
    const x1 = ratios.clave.razonCirculante;
    const x2 = ratios.clave.apalancamientoInterno;

    const advertencias = [];
    if (x1 === null) advertencias.push('No hay pasivo corriente registrado: la Razón Circulante (X₁) no es calculable.');
    if (x2 === null) advertencias.push('No hay pasivo total registrado: la Razón de Apalancamiento Interno (X₂) no es calculable.');

    if (x1 === null || x2 === null) {
      return {
        calculable: false, x1, x2, z: null, categoria: null, advertencias,
        aportes: { x1: null, x2: null },
        distanciaCortes: null
      };
    }

    const aporteX1 = COEF_X1 * x1;
    const aporteX2 = COEF_X2 * x2;
    const z = aporteX1 + aporteX2;
    const categoria = clasificar(z);

    /* Sensibilidad: cuánto debe variar cada X para cambiar de categoría */
    const objetivo = z > CORTE_SUPERIOR ? CORTE_SUPERIOR : (z >= CORTE_INFERIOR ? CORTE_SUPERIOR : CORTE_INFERIOR);
    const faltanteZ = objetivo - z;

    return {
      calculable: true,
      x1, x2, z, categoria,
      coeficientes: { x1: COEF_X1, x2: COEF_X2 },
      aportes: {
        x1: aporteX1, x2: aporteX2,
        pesoX1: z !== 0 ? aporteX1 / z : null,
        pesoX2: z !== 0 ? aporteX2 / z : null
      },
      cortes: { superior: CORTE_SUPERIOR, inferior: CORTE_INFERIOR },
      distanciaCortes: {
        aExcelente: CORTE_SUPERIOR - z,
        aRiesgoNormal: CORTE_INFERIOR - z
      },
      sensibilidad: {
        objetivo,
        faltanteZ,
        deltaX1: faltanteZ / COEF_X1,
        deltaX2: faltanteZ / COEF_X2,
        activoCorrienteRequerido: faltanteZ > 0 ? (faltanteZ / COEF_X1) * b.pasivoCorriente : 0,
        patrimonioRequerido: faltanteZ > 0 ? (faltanteZ / COEF_X2) * b.pasivoTotal : 0
      },
      advertencias,
      memoriaCalculo: [
        `X₁ = Activo Corriente ÷ Pasivo Corriente = ${b.activoCorriente.toFixed(2)} ÷ ${b.pasivoCorriente.toFixed(2)} = ${x1.toFixed(4)}`,
        `X₂ = Patrimonio ÷ Pasivo Total = ${b.patrimonio.toFixed(2)} ÷ ${b.pasivoTotal.toFixed(2)} = ${x2.toFixed(4)}`,
        `Z = 0.4 · ${x1.toFixed(4)} + 0.6 · ${x2.toFixed(4)} = ${aporteX1.toFixed(4)} + ${aporteX2.toFixed(4)} = ${z.toFixed(4)}`,
        `Dictamen: ${categoria.dictamen} (${categoria.criterio})`
      ]
    };
  }

  return { evaluar, clasificar, CATEGORIAS, COEF_X1, COEF_X2, CORTE_SUPERIOR, CORTE_INFERIOR };
})();

window.Discriminant = Discriminant;

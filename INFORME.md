# Informe técnico — Motor Computacional de Análisis Financiero y Predicción de Riesgo

Proyecto 3 · Finanzas para Ingenieros · 8vo semestre de Ingeniería en Informática

Repositorio: <https://github.com/m1xter/Motor-financiero>

---

## 1. ¿Qué hace el proyecto?

Es una aplicación web (sin servidor, 100 % en el navegador) que recibe un archivo CSV con
cuentas contables **desordenadas** y produce, en tiempo real:

1. **Estructuración contable (Fase 1).** Clasifica cada cuenta por su grado de liquidez
   (activos) o exigibilidad (pasivos), separa patrimonio y cuentas de resultados, calcula la
   depreciación en línea recta de los activos fijos —el **terreno nunca se deprecia**— y arma
   el **Balance General** y el **Estado de Resultados**, validando la ecuación
   `Activo = Pasivo + Patrimonio`. Si no cuadra, muestra una alerta con el monto de la
   diferencia, la causa probable y la corrección sugerida.
2. **Dashboard de razones financieras (Fase 2).** 26 indicadores agrupados en liquidez,
   apalancamiento, actividad y rentabilidad, cada uno con su fórmula, su valor y un semáforo
   de interpretación, más cuatro gráficos.
3. **Predicción de riesgo de crédito (Fase 3).** Modelo de análisis discriminante
   `Z = 0.4·X₁ + 0.6·X₂` con dictamen automático (crédito excelente / riesgo normal / malo),
   memoria de cálculo, aportes de cada variable, distancia a los puntos de corte y análisis de
   sensibilidad.

Todo es **editable en vivo**: al cambiar un saldo, una clasificación, la vida útil, el valor
residual o los años de uso, se recalculan balance, estados, razones, gráficos y dictamen sin
recargar la página. La app también exporta un informe HTML imprimible.

### Flujo de datos

```
archivo CSV
   │
   ▼  CsvParser.parse()            → detecta separador, encabezados y montos
partidas crudas (entries)
   │
   ▼  Classifier.procesar()        → clasifica + calcula depreciación por cuenta
cuentas clasificadas
   │
   ▼  Statements.construir()       → Balance, Estado de Resultados y validación
estados financieros
   │
   ├──▶ Ratios.calcular()          → 26 razones financieras
   │         │
   │         ▼
   └──▶ Discriminant.evaluar()     → X₁, X₂, Z y dictamen de crédito
             │
             ▼  App.render() + Charts.refrescarTodo()   → interfaz y gráficos
```

Ese encadenamiento está en `js/app.js`, funciones `construirCuentas()` (línea 57) y
`recalcular()` (línea 88): cualquier edición del usuario vuelve a ejecutar el pipeline completo.

---

## 2. ¿Dónde se hace cada cálculo?

| Cálculo | Archivo | Función / línea |
|---|---|---|
| Detección del separador (`,` `;` `\|` tab) | `js/csv-parser.js` | `detectDelimiter()` — L16 |
| Lectura de campos con comillas | `js/csv-parser.js` | `splitLine()` — L31 |
| Conversión de montos (`1.234.567,89`, `1,234,567.89`, `(2.400)`, `Bs 45.000`) | `js/csv-parser.js` | `parseAmount()` — L57 |
| Reconocimiento de encabezados (`descripcion_cuenta`, `monto`, `tipo_saldo`, `vida_util_anios`, descarte de `id_cuenta`) | `js/csv-parser.js` | `HEADER_PATTERNS` + `matchHeader()` — L95–112 |
| Corrección del mapeo mirando el contenido real de las filas | `js/csv-parser.js` | `parse()` — L138–186 |
| Filtrado de filas de totales del archivo | `js/csv-parser.js` | `parse()` — L206 |
| Clasificación por palabras clave (liquidez / exigibilidad) | `js/classifier.js` | `REGLAS` — L34–86 |
| Traducción de la columna de categoría del CSV | `js/classifier.js` | `ALIAS_CATEGORIA` + `porCategoriaCsv()` — L89–117 |
| Prioridad entre nombre y categoría declarada | `js/classifier.js` | `clasificar()` — L152–190 |
| Reubicación corto/largo plazo por el nombre | `js/classifier.js` | `ajustarPorPlazo()` — L130 |
| Búsqueda de la regla más específica por nombre | `js/classifier.js` | `buscarRegla()` — L140 |
| **Depreciación en línea recta** y regla del terreno | `js/classifier.js` | `depreciar()` — L199 |
| Totales del Balance General | `js/statements.js` | `construir()` — L51–68 |
| Estado de Resultados (bruta, operativa, neta) | `js/statements.js` | `construir()` — L70–91 |
| Reparto de la depreciación (ejercicio vs. ejercicios anteriores) | `js/statements.js` | `construir()` — L31–49, L80–85 |
| **Validación `Activo = Pasivo + Patrimonio`** | `js/statements.js` | `construir()` — L117–129 |
| Diagnóstico de la causa del descuadre | `js/statements.js` | `sugerirCausa()` — L176 |
| Componentes para las razones (efectivo, inventarios, CxC, proveedores…) | `js/ratios.js` | `componentes()` — L34 |
| División protegida (evita `Infinity`/`NaN`, devuelve `N/D`) | `js/ratios.js` | `div()` — L16 |
| Razones de **liquidez** | `js/ratios.js` | `calcular()` — L66–89 |
| Razones de **apalancamiento** | `js/ratios.js` | `calcular()` — L91–122 |
| Razones de **actividad** | `js/ratios.js` | `calcular()` — L124–161 |
| Razones de **rentabilidad** | `js/ratios.js` | `calcular()` — L163–190 |
| Semáforo de interpretación de cada índice | `js/ratios.js` | `semaforo()` — L46 |
| **Modelo discriminante Z y dictamen** | `js/discriminant.js` | `evaluar()` — L56, `clasificar()` — L48 |
| Coeficientes y puntos de corte | `js/discriminant.js` | L19–22 |
| Sensibilidad (cuánto falta para cambiar de categoría) | `js/discriminant.js` | `evaluar()` — L96–103 |
| Recálculo en vivo ante cada edición | `js/app.js` | `construirCuentas()` L57, `recalcular()` L88, listeners L520–537 |
| Render de tablas, KPIs, alertas y modelo | `js/app.js` | `render()` L136 y `renderBalance()`, `renderIndices()`, `renderModelo()`… |
| Gráficos (Chart.js) | `js/charts.js` | `refrescarTodo()` — L124 |
| Exportación del informe HTML | `js/app.js` | `exportar()` — L441 |

---

## 3. Fórmulas implementadas

### Depreciación en línea recta — `js/classifier.js`, `depreciar()`

```
Monto depreciable      = Costo − Valor residual
Cuota anual            = Monto depreciable ÷ Vida útil
Depreciación acumulada = mín( Cuota anual × Años de uso , Monto depreciable )
Valor neto             = Costo − Depreciación acumulada
```

Reglas de negocio:

- El **terreno** se detecta por nombre (`esTerreno`) y devuelve cuota 0 con la nota
  *«Terreno: activo fijo no depreciable»*.
- La acumulada nunca supera el monto depreciable (no se deprecia por debajo del residual).
- Si el CSV no trae vida útil, se usa una vida por catálogo (edificios 20, maquinaria 10,
  vehículos 5, computación 3, mobiliario 10 años) y se marca como estimada.

### Ecuación contable — `js/statements.js`, `construir()`

```
Activo Total          = Activo Corriente + (Activo No Corriente − Depreciación acumulada)
Pasivo Total          = Pasivo Corriente + Pasivo No Corriente
Patrimonio ajustado   = Patrimonio del CSV − Depreciación de ejercicios anteriores
Patrimonio            = Patrimonio ajustado + Resultado del ejercicio (opcional)
Descuadre             = Activo Total − (Pasivo Total + Patrimonio)
Cuadra                ⟺ |Descuadre| ≤ 0,5
```

El tratamiento de la depreciación respeta la partida doble: la **cuota del ejercicio** va al
gasto (y por tanto al resultado), mientras la **depreciación de años anteriores** se carga
contra los resultados acumulados del patrimonio.

### Estado de Resultados — `js/statements.js`

```
Ventas Netas             = Ventas brutas − Devoluciones y descuentos
Utilidad Bruta           = Ventas Netas − Costo de Ventas
Utilidad Operativa       = Utilidad Bruta − Gastos Operativos + Otros ingresos
Utilidad antes de ISLR   = Utilidad Operativa − Gastos Financieros
Utilidad Neta            = Utilidad antes de ISLR − Impuestos
```

### Razones financieras — `js/ratios.js`

| Grupo | Indicador | Fórmula |
|---|---|---|
| Liquidez | Razón Circulante **(X₁)** | Activo Corriente ÷ Pasivo Corriente |
| Liquidez | Prueba Ácida | (Activo Corriente − Inventarios − Gastos anticipados) ÷ Pasivo Corriente |
| Liquidez | Razón de Efectivo | (Efectivo + Valores negociables) ÷ Pasivo Corriente |
| Liquidez | Capital de Trabajo Neto | Activo Corriente − Pasivo Corriente |
| Liquidez | Capital de trabajo sobre activos | Capital de Trabajo ÷ Activo Total |
| Apalancamiento | Razón de Endeudamiento | Pasivo Total ÷ Activo Total |
| Apalancamiento | Apalancamiento Interno **(X₂)** | Patrimonio ÷ Pasivo Total |
| Apalancamiento | Deuda–Patrimonio | Pasivo Total ÷ Patrimonio |
| Apalancamiento | Autonomía Financiera | Patrimonio ÷ Activo Total |
| Apalancamiento | Endeudamiento a largo plazo | Pasivo No Corriente ÷ (Pasivo No Corriente + Patrimonio) |
| Apalancamiento | Cobertura de Intereses | Utilidad Operativa ÷ Gastos Financieros |
| Apalancamiento | Multiplicador del Capital | Activo Total ÷ Patrimonio |
| Actividad | Rotación de Inventario | Costo de Ventas ÷ Inventarios |
| Actividad | Días de Inventario | 365 ÷ Rotación de Inventario |
| Actividad | Rotación de CxC | Ventas Netas ÷ Cuentas por Cobrar |
| Actividad | Período Promedio de Cobro | 365 ÷ Rotación de CxC |
| Actividad | Período Promedio de Pago | 365 ÷ (Costo de Ventas ÷ Proveedores) |
| Actividad | Ciclo de Conversión de Efectivo | Días de inventario + Cobro − Pago |
| Actividad | Rotación de Activos Totales | Ventas Netas ÷ Activo Total |
| Actividad | Rotación del Activo Fijo | Ventas Netas ÷ Activo No Corriente |
| Rentabilidad | Margen Bruto | Utilidad Bruta ÷ Ventas Netas |
| Rentabilidad | Margen Operativo | Utilidad Operativa ÷ Ventas Netas |
| Rentabilidad | Margen Neto | Utilidad Neta ÷ Ventas Netas |
| Rentabilidad | ROA | Utilidad Neta ÷ Activo Total |
| Rentabilidad | ROE | Utilidad Neta ÷ Patrimonio |
| Rentabilidad | Rendimiento operativo de la inversión | Utilidad Operativa ÷ Activo Total |

Cuando un denominador es cero la razón no se fuerza a `0` ni a `Infinity`: `div()` devuelve
`null` y la interfaz muestra **N/D**.

### Modelo discriminante — `js/discriminant.js`

```
X₁ = Activo Corriente ÷ Pasivo Corriente     (Razón Circulante)
X₂ = Patrimonio ÷ Pasivo Total               (Apalancamiento Interno)

Z  = 0,4 · X₁ + 0,6 · X₂

Z > 1,4            → Crédito excelente     (aprobar, condiciones preferenciales)
0,66 ≤ Z ≤ 1,4     → Crédito de riesgo normal (aprobar con garantías y seguimiento)
Z < 0,66           → Crédito malo          (negar o exigir garantías reales)
```

Además se calcula el aporte de cada término (`0,4·X₁` y `0,6·X₂`), su peso relativo, la
distancia a cada corte y la sensibilidad: cuánto tendría que aumentar el activo corriente o el
patrimonio para subir de categoría.

---

## 4. Lectura de CSV desordenados

`CsvParser` no exige un formato fijo:

- **Separadores:** `,` `;` `|` y tabulador, detectados por consistencia entre filas.
- **Montos:** formato latino y anglosajón, símbolos monetarios, negativos entre paréntesis.
- **Encabezados:** sinónimos (`cuenta`, `partida`, `descripcion_cuenta`, `concepto`…;
  `saldo`, `monto`, `importe`, `valor`…), columnas de identificadores descartadas
  (`id_cuenta`, `codigo`, `nro`) y verificación posterior contra los datos: si la columna
  elegida como saldo no contiene montos, el motor la reasigna y avisa.
- **Categorías libres:** `Liquidez`, `Almacen`, `Derecho_Cobro`, `Inversion`, `Deuda_Corto`,
  `Deuda_Largo`, `Propietarios`, `Ingreso`, `Egreso`, además de los nombres contables
  formales. Si el nombre de la cuenta es más específico que la categoría (p. ej. *Costo de
  Ventas* marcado como *Egreso*), manda el nombre.
- **Filas de totales** del archivo original se ignoran y se recalculan internamente.
- Si no hay encabezados, se asume primera columna = cuenta y la columna numérica = saldo.

---

## 5. Ejemplo con el CSV de prueba entregado

Archivo `data/ejemplo_enunciado.csv` (encabezados `id_cuenta, descripcion_cuenta, tipo_saldo,
monto, vida_util_anios`), 14 partidas:

| Concepto | Monto |
|---|---|
| Activo Corriente (efectivo 45.000 + inventario 25.000 + CxC 30.000) | 100.000,00 |
| Activo No Corriente (maquinaria 80.000 + terreno 120.000) | 200.000,00 |
| **Activo Total** | **300.000,00** |
| Pasivo Corriente (proveedores 35.000 + préstamo 6 meses 15.000 + impuestos 10.000) | 60.000,00 |
| Pasivo No Corriente (hipoteca a 10 años) | 60.000,00 |
| **Pasivo Total** | **120.000,00** |
| Patrimonio (capital 100.000 + utilidades acumuladas 20.000) | 120.000,00 |
| Utilidad neta (250.000 − 120.000 − 40.000 − 8.000 de depreciación) | 82.000,00 |

- La maquinaria deprecia `80.000 ÷ 10 = 8.000` al año; el **terreno no deprecia**.
- La ecuación **no cuadra**: `300.000 ≠ 120.000 + 120.000`. El motor reporta el descuadre de
  `60.000` y señala que coincide con el monto de la hipoteca, sugiriendo verificar su
  clasificación o su signo.
- Modelo: `X₁ = 100.000 ÷ 60.000 = 1,6667`; `X₂ = 120.000 ÷ 120.000 = 1,0000`;
  `Z = 0,4·1,6667 + 0,6·1,0000 = 1,2667` → **crédito de riesgo normal**.

Los otros juegos de datos incluidos permiten demostrar los tres dictámenes:

| Juego de datos | Z | Dictamen |
|---|---|---|
| `ejemplo_balance.csv` (empresa sólida) | 1,7293 | Crédito excelente |
| `ejemplo_intermedia.csv` | 1,1723 | Crédito de riesgo normal |
| `ejemplo_riesgo.csv` | 0,4910 | Crédito malo |
| `ejemplo_desordenado.csv` (separador `\|`, sin encabezados) | 1,3962 | Riesgo normal + alerta de descuadre |

---

## 6. Verificación

- `npm test` (`node test/engine.test.js`): **80 pruebas** sobre parseo de montos, delimitadores,
  encabezados del archivo del enunciado, clasificación, depreciación, terreno no depreciable,
  ecuación contable, razones, recálculo tras edición y modelo discriminante.
- `node test/diagnostico.js <juego|ruta.csv>`: imprime balance, descuadre, X₁, X₂, Z y dictamen
  de cualquier CSV, útil para contrastar los resultados a mano.
- `node test/generar-csv.js`: regenera los CSV de `data/` desde los juegos de datos.

## 7. Estructura del proyecto

```
index.html            interfaz: carga, KPIs, pestañas y canvas de gráficos
styles.css            diseño responsive, tema claro/oscuro
js/csv-parser.js      lectura y normalización del CSV
js/classifier.js      clasificación contable y depreciación
js/statements.js      Balance, Estado de Resultados y validación de la ecuación
js/ratios.js          26 razones financieras con semáforos
js/discriminant.js    modelo Z = 0,4·X₁ + 0,6·X₂ y dictamen
js/charts.js          gráficos Chart.js
js/app.js             controlador, edición en vivo y exportación del informe
js/sample-data.js     juegos de datos de demostración
data/                 CSV descargables
test/                 pruebas y utilidades de diagnóstico
vercel.json           despliegue estático en Vercel
```

Tecnología: HTML, CSS y JavaScript sin dependencias de compilación (Chart.js por CDN); no hay
backend y ningún dato contable sale del equipo del usuario.

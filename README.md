# Motor Computacional de Análisis Financiero y Predicción de Riesgo

Aplicación web (HTML + CSS + JavaScript, sin backend) que recibe un archivo CSV con un listado
**desordenado** de cuentas contables y produce automáticamente:

1. **Estructuración contable dinámica** — clasifica cada cuenta en Activo Corriente, Activo No Corriente,
   Pasivo Corriente, Pasivo No Corriente y Patrimonio, ordenando activos por liquidez y pasivos por exigibilidad.
2. **Depreciación en línea recta** de los activos fijos, con la regla estricta de que **el terreno nunca se deprecia**.
3. **Validación de la ecuación patrimonial** `Activo = Pasivo + Patrimonio`, con alerta en pantalla,
   monto del descuadre, causa probable y sugerencia de corrección.
4. **Dashboard de razones financieras** (liquidez, apalancamiento, actividad y rentabilidad) que se
   recalcula en tiempo real ante cualquier cambio de los datos.
5. **Modelo discriminante de crédito** `Z = 0.4·X₁ + 0.6·X₂` con dictamen automático.

## Formato del CSV

| Columna | Requerida | Descripción |
|---|---|---|
| `Cuenta` | Sí | Nombre de la cuenta (`cuenta`, `partida`, `descripcion`, `concepto`…). |
| `Saldo` | Sí | Monto (`saldo`, `monto`, `valor`, `importe`…). |
| `Categoria` | No | Fuerza la clasificación (`activo corriente`, `pasivo no corriente`, `patrimonio`, `ingreso`, `gasto`…). |
| `Vida Util` | No | Años de vida útil del activo fijo. |
| `Valor Residual` | No | Valor de salvamento. |
| `Anos de Uso` | No | Años ya transcurridos (genera la depreciación acumulada). |

El lector tolera:

- Separadores `,` `;` `|` y tabulador (detección automática).
- Campos entre comillas y comillas escapadas.
- Montos en formato latino `1.234.567,89` y anglosajón `1,234,567.89`, con `$`, `Bs.`, paréntesis para negativos.
- Encabezados ausentes o con nombres alternativos, y filas de totales (se ignoran y se recalculan internamente).
- Columnas de identificadores (`id_cuenta`, `codigo`, `nro`) que se descartan, y encabezados como `descripcion_cuenta`, `tipo_saldo`, `monto`, `vida_util_anios`. Si el encabezado engaña al mapeo, se corrige revisando el contenido real de las filas.
- Vocabulario libre en la columna de categoría: `Liquidez`, `Almacen`, `Derecho_Cobro`, `Inversion`, `Deuda_Corto`, `Deuda_Largo`, `Propietarios`, `Ingreso`, `Egreso`. Cuando el nombre de la cuenta es más específico que la categoría (p. ej. `Costo de Ventas` marcado como `Egreso`), manda el nombre.

Plantillas listas para la demostración en `data/`:

- `ejemplo_enunciado.csv` — datos de prueba del enunciado (encabezados propios y **descuadre**)
- `ejemplo_balance.csv` — empresa sólida → **Crédito excelente**
- `ejemplo_intermedia.csv` — empresa intermedia → **Crédito de riesgo normal**
- `ejemplo_riesgo.csv` — empresa apalancada con pérdida → **Crédito malo**
- `ejemplo_desordenado.csv` — CSV sin encabezados, separado por `|`, con fila de totales y **descuadre intencional**

## Fórmulas implementadas

**Depreciación en línea recta**

```
Cuota anual   = (Costo − Valor residual) / Vida útil
Acumulada     = min(Cuota anual × Años de uso, Costo − Valor residual)
Valor neto    = Costo − Acumulada
```

El terreno se reporta en el balance como activo fijo **no depreciable**. Los intangibles no se
someten a línea recta salvo que el CSV indique vida útil.

**Ecuación patrimonial**

```
Activo = Pasivo + Patrimonio        (tolerancia 0,01)
```

La depreciación acumulada de ejercicios anteriores se carga contra los resultados acumulados del
patrimonio y la cuota del ejercicio corriente contra el estado de resultados, para conservar la partida doble.

**Modelo discriminante de crédito**

```
Z  = 0.4·X₁ + 0.6·X₂
X₁ = Activo Corriente / Pasivo Corriente          (razón circulante)
X₂ = Patrimonio / Pasivo Total                    (apalancamiento interno)
```

| Condición | Dictamen |
|---|---|
| `Z > 1.4` | Crédito excelente |
| `0.66 ≤ Z ≤ 1.4` | Crédito de riesgo normal |
| `Z < 0.66` | Crédito malo |

## Razones del dashboard

- **Liquidez:** razón circulante, prueba ácida, razón de efectivo, capital de trabajo neto y sobre activos.
- **Apalancamiento:** endeudamiento, apalancamiento interno, deuda–patrimonio, autonomía financiera,
  endeudamiento a largo plazo, cobertura de intereses, multiplicador del capital.
- **Actividad:** rotación e días de inventario, rotación y período de cobro, período de pago,
  ciclo de conversión de efectivo, rotación de activos totales y del activo fijo.
- **Rentabilidad:** margen bruto, operativo y neto, ROA, ROE, ROI.

Los indicadores con denominador cero se muestran como **N/D** (nunca `Infinity` ni `NaN`).

## Uso local

```bash
git clone https://github.com/m1xter/Motor-financiero.git
cd Motor-financiero
python3 -m http.server 8000     # o: npx serve .
# abrir http://localhost:8000
```

Pruebas del motor de cálculo (sin dependencias externas):

```bash
node test/engine.test.js        # 60 verificaciones
node test/diagnostico.js solida # inspección de un juego de datos
node test/generar-csv.js        # regenera los CSV de data/
```

## Despliegue en Vercel

1. Subir el repositorio a GitHub.
2. En Vercel: **Add New → Project → Import Git Repository** y seleccionar `Motor-financiero`.
3. Framework preset: **Other**. Sin comando de build y sin directorio de salida
   (`vercel.json` ya declara el sitio como estático).
4. **Deploy**. Cada `push` a la rama principal genera un despliegue nuevo.

## Estructura

```
index.html              Interfaz (carga, alertas, KPIs, pestañas, gráficos)
styles.css              Sistema de diseño, tema claro/oscuro, responsivo
js/csv-parser.js        Lectura y normalización del CSV
js/classifier.js        Clasificación de cuentas y depreciación en línea recta
js/statements.js        Balance general, estado de resultados y validación contable
js/ratios.js            Razones de liquidez, apalancamiento, actividad y rentabilidad
js/discriminant.js      Modelo Z = 0.4·X₁ + 0.6·X₂ y dictamen de crédito
js/charts.js            Gráficos (Chart.js)
js/sample-data.js       Juegos de datos de demostración
js/app.js               Controlador de la interfaz, edición en vivo e informe exportable
test/                   Pruebas y utilidades del motor
data/                   CSV de ejemplo descargables
```

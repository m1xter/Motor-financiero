/* ============================================================
   sample-data.js — Juegos de datos de demostración
   ============================================================
   Los mismos archivos están disponibles en /data para descarga y
   para pruebas de carga en vivo.
   ============================================================ */

const SampleData = {
  solida: {
    nombre: 'Distribuidora Andina C.A. (empresa sólida)',
    csv: `Cuenta;Saldo;Categoria;Vida Util;Valor Residual;Anos de Uso
Efectivo en caja;18.500,00;;;;
Bancos cuenta corriente;342.300,00;;;;
Valores negociables;46.000,00;;;;
Cuentas por cobrar clientes;238.400,00;;;;
Provision para cuentas incobrables;11.900,00;;;;
Inventario de mercancias;312.700,00;;;;
Seguros pagados por anticipado;14.600,00;;;;
IVA credito fiscal;9.800,00;;;;
Terreno;480.000,00;;;;
Edificio;760.000,00;;20;60.000,00;6
Maquinaria y equipo de planta;395.000,00;;10;25.000,00;4
Vehiculos de reparto;186.000,00;;5;16.000,00;2
Equipo de computacion;54.000,00;;3;6.000,00;1
Mobiliario y enseres;38.500,00;;10;2.500,00;3
Software administrativo;27.000,00;;;;
Proveedores nacionales;196.400,00;;;;
Efectos por pagar a corto plazo;74.000,00;;;;
Sueldos por pagar;38.900,00;;;;
IVA por pagar;22.100,00;;;;
ISLR por pagar;31.500,00;;;;
Intereses por pagar;7.400,00;;;;
Prestamo bancario a largo plazo;420.000,00;;;;
Hipoteca por pagar;265.000,00;;;;
Prestaciones sociales acumuladas;96.000,00;;;;
Capital social;1.100.000,00;;;;
Reserva legal;90.000,00;;;;
Utilidades retenidas;268.600,00;;;;
Ventas;2.980.000,00;;;;
Devoluciones en ventas;54.000,00;;;;
Otros ingresos;36.000,00;;;;
Costo de ventas;1.742.000,00;;;;
Gastos de administracion;418.000,00;;;;
Gastos de ventas;286.000,00;;;;
Gastos financieros;92.000,00;;;;
Gasto de impuesto sobre la renta;123.000,00;;;;`
  },

  riesgo: {
    nombre: 'Manufacturas del Táchira S.R.L. (empresa en riesgo)',
    csv: `cuenta,saldo,tipo,vida util,valor residual,anos de uso
Caja,4200,,,,
Banco Nacional,21500,,,,
Cuentas por cobrar,96000,,,,
Inventario de materia prima,184000,,,,
Productos terminados,72000,,,,
Gastos pagados por anticipado,6800,,,,
Terreno,150000,,,,
Galpon industrial,310000,,25,20000,12
Maquinaria pesada,268000,,10,18000,8
Camiones,94000,,5,8000,4
Proveedores,214000,,,,
Documentos por pagar a corto plazo,98000,,,,
Sobregiro bancario,42000,,,,
Impuestos por pagar,36500,,,,
Sueldos por pagar,28400,,,,
Prestamo bancario a largo plazo,195000,,,,
Prestaciones sociales,48000,,,,
Capital social,450000,,,,
Utilidades retenidas,118600,,,,
Ventas netas,1180000,,,,
Costo de ventas,894000,,,,
Gastos de administracion,168000,,,,
Gastos de ventas,74000,,,,
Gastos financieros,68000,,,,`
  },

  intermedia: {
    nombre: 'Comercial Los Andes C.A. (riesgo normal)',
    csv: `Cuenta;Saldo;Categoria;Vida Util;Valor Residual;Anos de Uso
Efectivo en caja;18.500,00;;;;
Bancos cuenta corriente;259.300,00;;;;
Valores negociables;46.000,00;;;;
Cuentas por cobrar clientes;238.400,00;;;;
Provision para cuentas incobrables;11.900,00;;;;
Inventario de mercancias;312.700,00;;;;
Seguros pagados por anticipado;14.600,00;;;;
IVA credito fiscal;9.800,00;;;;
Terreno;480.000,00;;;;
Edificio;760.000,00;;20;60.000,00;6
Maquinaria y equipo de planta;395.000,00;;10;25.000,00;4
Vehiculos de reparto;186.000,00;;5;16.000,00;2
Equipo de computacion;54.000,00;;3;6.000,00;1
Mobiliario y enseres;38.500,00;;10;2.500,00;3
Software administrativo;27.000,00;;;;
Proveedores nacionales;196.400,00;;;;
Efectos por pagar a corto plazo;74.000,00;;;;
Sueldos por pagar;38.900,00;;;;
IVA por pagar;22.100,00;;;;
ISLR por pagar;31.500,00;;;;
Intereses por pagar;7.400,00;;;;
Prestamo bancario a largo plazo;1.020.000,00;;;;
Hipoteca por pagar;265.000,00;;;;
Prestaciones sociales acumuladas;96.000,00;;;;
Capital social;500.000,00;;;;
Reserva legal;90.000,00;;;;
Utilidades retenidas;268.600,00;;;;
Ventas;2.980.000,00;;;;
Devoluciones en ventas;54.000,00;;;;
Otros ingresos;36.000,00;;;;
Costo de ventas;1.742.000,00;;;;
Gastos de administracion;418.000,00;;;;
Gastos de ventas;286.000,00;;;;
Gastos financieros;210.000,00;;;;
Gasto de impuesto sobre la renta;88.000,00;;;;`
  },

  desordenado: {
    nombre: 'CSV desordenado con descuadre intencional',
    csv: `PARTIDA|MONTO
Utilidades retenidas|180.000
Maquinaria|240.000
Proveedores|132.500
Caja|12.400
Hipoteca por pagar a largo plazo|210.000
Inventario de mercancia|168.900
Capital social|400.000
Terreno|320.000
Cuentas por cobrar clientes|97.600
Depreciacion acumulada maquinaria|48.000
Impuestos por pagar|21.300
Bancos|64.800
Efectos por pagar corto plazo|58.000
Prestaciones sociales|44.000
TOTAL ACTIVO|855.700`
  }
};

window.SampleData = SampleData;

# El reporte mensual

La pantalla `/reportes` (permiso `report:sales`: dueño y administrador, con conexión) muestra lo que se vendió en un mes, separado en los cuatro
renglones con los que se declara (gravado al 19 %, gravado al 5 %, exento y excluido), las anulaciones del mes aparte y lo cobrado por medio de
pago. Lo calcula el backend ([ADR 0035](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0035-el-reporte-mensual-suma-lo-que-dijo-cada-recibo-y-corta-a-hora-de-bogota.md))
y los meses los corta un reloj de Bogotá.

## Lo que NO es

Una auditoría contable (2026-10-25) leyó el reporte y concluyó que **es un resumen de ventas para el control interno, no la liquidación tributaria**.
Los cuatro renglones no alcanzan para preparar la declaración de IVA: faltan las compras y los gastos con sus soportes, el IVA descontable, las
retenciones, otras clasificaciones del formulario y los períodos de la declaración (que pueden ser de dos meses, de cuatro o de un año). Por eso la
pantalla lo dice **arriba, antes de cualquier cifra**, y se ve **aunque el mes no tenga ventas o el reporte no cargue**. Dice, con estas palabras:

- **«Este reporte es de control interno, no es tu declaración de IVA».** No reemplaza la factura electrónica ni la declaración de impuestos. Sirve
  para ver cómo van las ventas y para dárselo a quien lleva las cuentas.
- **Qué le falta a la declaración:** tus compras y gastos, el IVA que puedes descontar, las retenciones y los períodos de tu declaración. Tu contador
  lo concilia con sus documentos.
- **No copies el «Total vendido» como tus ingresos: lleva el IVA adentro.** Para los ingresos se usa el valor sin IVA.
- **Si una venta hecha sin conexión llega después de cerrar el mes, ese mes cambia.** El reporte se calcula al pedirlo y cuenta cada venta en el mes en
  que ocurrió, no en el que llegó: una venta hecha sin conexión el 30 de septiembre y enviada el 2 de octubre cuenta en septiembre. La pantalla aconseja, antes
  de dárselo al contador: conecta todos los equipos y espera a que digan «Todo enviado».
- **Exento y excluido salen como los marcaste en cada producto.** El sistema no sabe cuál es cuál: guarda lo que el negocio le dice (ADR 0034). Que un
  producto sea exento no significa que puedas descontar o pedir de vuelta el IVA de tus compras; eso lo define el contador.

## Lo que no hace todavía

- **Solo se entrega en pantalla.** No hay PDF, CSV ni impresión, así que el aviso vive en un solo lugar. El día que se agregue una de esas salidas, el
  aviso tiene que ir también en ella (y una prueba tiene que exigirlo).
- **No guarda una versión fechada** del reporte entregado. Quien lo entrega debe guardar la suya (una captura o una copia) con la fecha, para poder
  explicar después una diferencia si llegó una venta tardía.
- **No suma las ventas netas** (ventas menos anulaciones) ni acumula por el período de la declaración. Los dos bloques se ven aparte, como los pidió el
  contador (ADR 0032); cómo se presenta el neto en la declaración lo decide quien la prepara.

## Dónde está

| Qué                                          | Dónde                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| La pantalla y el aviso                       | `src/presentation/pages/MonthlyReportPage.tsx` (`UseNotice`)                              |
| Lo que dice cada frase, vigilado             | `src/presentation/pages/MonthlyReportPage.spec.tsx` y `test/docs/reporte-mensual.spec.ts` |
| La forma del reporte (los cuatro renglones)  | `src/domain/model/monthly-report.ts`                                                      |
| La prueba de punta a punta (venta → reporte) | `e2e/reporte-mensual.spec.ts`                                                             |

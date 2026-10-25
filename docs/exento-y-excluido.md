# Exento y excluido: quién decide

Un producto al 0 % de IVA puede ser **exento** o **excluido**. Para cobrar da igual (los dos llevan 0 %), pero para declarar van en renglones distintos, y
confundirlos es un error de contabilidad. El sistema **no sabe cuál es cuál**: guarda lo que el negocio le dice ([ADR 0034](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0034-el-tipo-tributario-vive-en-el-producto-y-se-copia-a-la-linea.md)).
La auditoría contable del 2026-10-25 pidió que no se dé por hecho ninguno de los dos.

## Qué pasa al crear un producto

- **Un producto nuevo no trae tipo elegido.** Ninguno de los cuatro botones de IVA (Gravado 19 %, Gravado 5 %, Exento y Excluido) arranca marcado, y el
  formulario no guarda hasta que la persona elige: «Elige si el producto es gravado, exento o excluido.» El backend también lo exige.
- **Al elegir, el formulario explica la diferencia**, con los ejemplos de la auditoría:
  - «Exento: está dentro del IVA, pero a tarifa 0 %, así que no se cobra.» Por ejemplo: huevos frescos, leche de vaca sin azúcar añadida y queso fresco sin
    madurar.
  - «Excluido: está fuera del IVA, así que no se cobra.» Por ejemplo: papa, tomate y cebolla frescos.
  - Los dos avisan que se declaran aparte, que depende de cómo se vende (fresco no es lo mismo que procesado) y que, ante la duda, se le pregunta al
    contador.
- **La misma explicación sale al abrir un producto para editarlo.** Así quien tiene uno al 0 % lo puede revisar y, si no era ese tipo, elegir el otro.

## De dónde viene el único «exento» que nadie eligió

Viene de **datos viejos**, no de un valor por defecto del formulario. A lo que se guardó al 0 % antes de que existiera el tipo tributario se le dio «exento»
como **valor de arranque** (no es una clasificación):

- la migración `20261023120000_tipo_tributario` del backend, con las filas que ya tenía;
- `startingTaxKind` (`src/domain/model/tax.ts`), con la copia del catálogo que un equipo guardó antes del tipo y con una venta que estaba en la cola sin
  conexión (ver [`sincronizacion.md`](sincronizacion.md) y [`punto-de-venta.md`](punto-de-venta.md)).

No hay base de datos de producción, así que ahí no hay filas viejas. En PRE son productos de prueba. Un producto que quedó así se corrige abriéndolo y
eligiendo de nuevo.

## Lo que no hace

- **No guarda una marca de «tipo confirmado» por producto.** Por eso no puede avisar cuáles productos al 0 % conservan el valor de arranque. Si el negocio
  llegara a tener datos viejos reales, esa marca (con migración, API y copia sin conexión) sería el paso siguiente; hoy no se justifica.
- **No decide por la persona.** Los ejemplos ayudan a elegir, no son una lista completa ni una consulta tributaria: la presentación importa y quien
  responde es el contador.

## Dónde está

| Qué                                             | Dónde                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| El formulario y la explicación                  | `src/presentation/catalog/ProductForm.tsx` (`ZERO_RATE_HINT`, `taxHintOf`) |
| Los cuatro tipos con la tarifa que les cabe     | `src/domain/model/tax.ts` (`TAX_CHOICES`)                                  |
| Que ningún botón arranca marcado                | `src/presentation/pages/NewProductPage.spec.tsx`                           |
| Que la explicación sale al editar               | `src/presentation/pages/EditProductPage.spec.tsx`                          |
| Que el documento y el formulario dicen lo mismo | `test/docs/exento-y-excluido.spec.ts`                                      |

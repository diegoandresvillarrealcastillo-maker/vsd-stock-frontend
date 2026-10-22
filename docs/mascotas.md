# Mascotas de VSD Stock

Cinco personajes, cada uno con cuatro caras (normal, feliz, celebrando y dormida). Son de Diego, que los describió el 22 de octubre de 2026, y están adaptados de las mascotas de VSD Health: el dibujo es el mismo, lo que cambia es lo que cada una hace en este producto.

Una mascota **solo aparece donde el producto ya hace lo que ella muestra**. Las historias prometen más de lo que VSD Stock hace hoy (están en la sección de lo que todavía no existe) y un dibujo contento no puede decir lo contrario de lo que la pantalla hace. Cada fila de las tablas de abajo dice si ese estado ya es verdad: **Sí** si hay una pantalla o un aviso del producto que lo provoca, **No** si el dibujo existe pero nada lo dispara todavía.

## Cómo se usan

```tsx
import { Mascota } from '../assets/mascotas/Mascota';

<Mascota personaje="ori" estado="dormida" />;
```

| Propiedad   | Qué hace                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `personaje` | `fungito`, `sparky`, `ori`, `gato` (Ojo de Gato) u `obsidian`.                                      |
| `estado`    | `normal`, `feliz`, `celebrando` o `dormida`.                                                        |
| `tamano`    | Lado en píxeles, 128 por defecto: la mitad exacta del arte, nítido en pantallas de doble densidad.  |
| `inmediata` | Carga al instante, para la que es lo primero que se ve. Si no, espera a estar cerca de la pantalla. |
| `className` | Clases de quien la usa (márgenes, posición); no reemplazan las de la mascota.                       |

- **Texto alternativo:** dice quién es y qué hace («Ori, durmiendo»). El estado no puede vivir solo en el dibujo.
- **Píxeles nítidos:** el arte es _pixel art_ y la clase `.mascota` desactiva el suavizado del navegador.
- **Movimiento:** al aparecer, la normal y la feliz flotan y la celebrando salta, por menos de 5 segundos (así nadie necesita un botón para detenerla, WCAG 2.2.2), solo transformaciones (ADR 0008) y **solo para quien no pidió menos movimiento**. La dormida no se mueve.
- **Una sola carpeta:** el arte y el componente viven en `src/presentation/assets/mascotas/`. La landing (`sitio/`, ADR 0033) solo puede importar de la aplicación esa carpeta y el dominio, así que usa **el mismo** componente y no hay dos copias.
- **Una mascota por estado verdadero:** `YA_CORRESPONDEN`, en `mascotas.ts`, lista los estados que ya son ciertos. Quien ponga una mascota en una pantalla elige uno de esos.

### Cambiar o agregar un dibujo

Mismo nombre (`<personaje>-<estado>.webp`), WebP de 256 por 256 píxeles con fondo transparente y 30 KB o menos. Los originales están en la carpeta `disenos/mascotas` de VSD Health (fuera de este repositorio): el script que los recorta está ahí.

## Fungito

**El guardián del stock.** Un hongo de sombrero azul con lunares, callado y paciente. En VSD Stock cuida el catálogo y las existencias.

| Estado     | Qué dibuja                              | Cuándo aparece                                                                                        | ¿El producto ya lo hace? |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------ |
| normal     | Mira de frente, con gesto tranquilo     | Mientras se muestra el catálogo o las existencias de los productos                                    | Sí                       |
| feliz      | Ojos en arco y mejillas sonrojadas      | Cuando entra mercancía: se registra una compra y suben las existencias                                | Sí                       |
| celebrando | Da un saltito entre esporas de luz      | Cuando el conteo del estante coincide con el del sistema. Todavía no existe un aviso para ese momento | No                       |
| dormida    | Sombrero caído, ojos cerrados y una «Z» | Cuando el catálogo está vacío: todavía no hay productos que cuidar                                    | Sí                       |

## Sparky

**La luz que avisa.** Un foco ámbar sobre un cuerpo de cobre con engranaje. En VSD Stock avisa lo que está por debajo del mínimo.

| Estado     | Qué dibuja                            | Cuándo aparece                                                                                      | ¿El producto ya lo hace? |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| normal     | Foco ámbar encendido, mirada neutral  | Cuando un producto queda por debajo de su mínimo: la alerta «Bajo el mínimo» de las existencias     | Sí                       |
| feliz      | Foco más brillante y ojos que sonríen | Cuando ningún producto está por debajo del mínimo. Hoy ninguna pantalla lo muestra                  | No                       |
| celebrando | Rayos, filamento y una banderita      | Cuando algo sale excepcionalmente bien en las ventas del día. Hoy el producto no lo mide            | No                       |
| dormida    | Foco gris y apagado, con «Zzz»        | Cuando la demo de la página está en reposo y despierta, unos 25 segundos. Solo ocurre en la landing | Sí                       |

## Ojo de Gato

**El auditor.** Un gato con gafas gruesas que lee un libro de cuentas. En VSD Stock cuenta el efectivo del turno.

| Estado     | Qué dibuja                                    | Cuándo aparece                                                                                          | ¿El producto ya lo hace? |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| normal     | Lee su libro, serio tras las gafas            | Mientras se cuenta el efectivo de la caja para cerrar el turno                                          | Sí                       |
| feliz      | Levanta la vista, ojos en arco y corazoncitos | Cuando el efectivo contado coincide con el esperado: «La caja cuadra»                                   | Sí                       |
| celebrando | Levanta una pata entre confeti                | Cuando un cierre queda perfecto de principio a fin. Hoy el producto no lo distingue de «La caja cuadra» | No                       |
| dormida    | Cabeza sobre el libro, gafas torcidas y «Zzz» | Cuando no hay un turno abierto: «No tienes un turno abierto»                                            | Sí                       |

## Obsidian

**La bóveda.** Un gólem de cristal con ojos cian. En VSD Stock cuida quién entra y a qué: los roles.

| Estado     | Qué dibuja                            | Cuándo aparece                                                                                   | ¿El producto ya lo hace? |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| normal     | Flota firme, con los ojos atentos     | Cuando una pantalla no es para el rol de la persona: «No tienes acceso»                          | Sí                       |
| feliz      | Cristales relajados y ojos en arco    | Cuando se invita a una persona nueva con su rol, con el código de invitación                     | Sí                       |
| celebrando | Gira y abre los brazos entre chispas  | Cuando se detiene un intento de entrada que no debía. Hoy ninguna pantalla muestra esos intentos | No                       |
| dormida    | Brillo apagado, en el suelo, con «Zz» | Cuando la sesión caduca y hay que entrar de nuevo: «Tu sesión caducó»                            | Sí                       |

## Ori

**La que sincroniza.** Una grulla de origami. En VSD Stock lleva al servidor lo que se vendió sin conexión y quedó guardado en el equipo.

| Estado     | Qué dibuja                               | Cuándo aparece                                                                                                            | ¿El producto ya lo hace? |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| normal     | Postura elegante, con las alas en reposo | Cuando no queda nada por enviar: «Nada por enviar»                                                                        | Sí                       |
| feliz      | Alas inclinadas hacia arriba             | Cuando todo lo guardado en el equipo ya llegó al servidor: «Todo enviado»                                                 | Sí                       |
| celebrando | Revolotea entre confeti de papel         | Cuando vuelve la red tras un corte largo y todo se envía sin una falla. Hoy el producto no lo distingue de «Todo enviado» | No                       |
| dormida    | Plegada en el suelo, con «zzz»           | Cuando no hay conexión: las ventas se guardan en el equipo y se envían al volver la red («Sin conexión»)                  | Sí                       |

Ori dormida es el estado que mejor cuenta lo que hace VSD Stock: la tienda no se detiene aunque se caiga la red. Por eso es la mascota del diagrama de la landing (C4-L4).

## Lo que las historias prometen y el producto todavía no hace

Las historias que contó Diego mencionan cosas que VSD Stock no hace hoy. Mientras no existan, **no se escriben en ningún texto de la landing ni de la aplicación** y ninguna mascota las muestra; las pruebas lo vigilan.

- **Fungito:** una bodega que abre y cierra. En su historia duerme cuando la bodega cierra; en VSD Stock el negocio nace con una bodega «Principal» que no se abre ni se cierra, así que duerme cuando el catálogo está vacío.
- **Sparky:** recordatorios, la rotación de los productos, el récord de ventas del día, las cuentas por cobrar y las órdenes de compra a proveedores. Hoy solo avisa lo que está por debajo del mínimo; las compras se registran, pero no hay órdenes.
- **Ojo de Gato:** la facturación electrónica y la DIAN, los reportes, la contabilidad y la lectura Z. Hoy cuenta el efectivo de un turno y dice si cuadra. El reporte mensual es un ticket de este ciclo (C4-R1) y, hasta que se fusione, tampoco se promete.
- **Obsidian:** el cifrado, las copias automáticas en la nube, la detección de fraude y los avisos de accesos bloqueados. Hoy cuida los roles: cada persona ve lo suyo y el servidor también lo niega.
- **Ori:** varias sucursales sincronizadas. El negocio nace con una sola sucursal, «Principal», y hoy Ori sincroniza el equipo de una tienda con su servidor.

## Lo que no se trajo de VSD Health

- **Trama**, la sexta mascota de Health, no entra: la historia de Diego para VSD Stock tiene cinco.
- Lo que Health pone encima de sus mascotas (frases para el ánimo, teléfonos de ayuda, el vocabulario del bienestar) tampoco: VSD Stock vende a un mostrador, no acompaña a nadie en su salud. Una prueba falla si aparece.

## Quién las vigila

- `test/mascotas/arte.spec.ts`: están los 20 dibujos, ni uno más ni uno menos, de 256 por 256 píxeles, con fondo transparente, de 30 KB o menos cada uno y 400 KB o menos entre todos. Trama no está.
- `src/presentation/assets/mascotas/imagenes.spec.ts` y `Mascota.spec.tsx`: cada estado resuelve a su imagen, ninguno se repite, y el componente dice quién es y qué hace, carga tarde y se deja mover por el CSS.
- `test/mascotas/historias.spec.ts`: esta tabla dice lo mismo que `YA_CORRESPONDEN`, ninguna promesa de la sección de arriba aparece fuera de ella ni en lo que sale en pantalla, y nada de Health se coló.
- `test/design/mascotas.spec.ts`: píxeles nítidos, movimiento solo para quien no lo pidió reducido, solo `transform`, menos de 5 segundos.

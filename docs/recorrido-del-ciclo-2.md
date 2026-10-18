# Recorrido del Ciclo 2: identidad, catálogo e inventario

Lo que se hace **al cerrar cada ciclo**: recorrer la aplicación completa, con una persona de verdad frente a un navegador, y
comprobar que cada pantalla hace lo que dice. Las pruebas automáticas dicen que cada pieza funciona; esto dice que **juntas**
funcionan.

Este recorrido se hizo el **17 de octubre de 2026** contra la **pila local** (una base de Docker con el esquema real, la API del
backend y un servicio de identidad de mentira). **No se ha hecho contra el Supabase de PRE porque PRE todavía no existe**: cuando
exista, se repite este mismo recorrido y se anota al final. Hasta entonces, el cierre del ciclo no incluye esa parte.

## Preparar la pila

Los comandos están en el backend, en
[`docs/ambientes.md`](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/ambientes.md#probar-todo-junto-en-tu-máquina-sin-supabase):
la base (`npm run db:up` y `npm run db:prepare`), el servicio de identidad (`npm run dev:identity`) y la API con lo que ese
servicio imprime. Aquí solo falta el frontend, que lee su configuración al arrancar. En `.env.local` (no se sube) o en el
entorno:

```bash
VITE_API_URL=http://localhost:3000
VITE_AUTH_URL=http://127.0.0.1:54321/auth/v1
VITE_AUTH_PUBLISHABLE_KEY=sb_publishable_desarrollo_local   # la clave publicable de mentira; nunca una secreta
```

y `npm run dev` (<http://localhost:5173>; la API tiene que permitir ese origen en `CORS_ORIGINS`).

> El servicio de identidad guarda a las personas **en memoria**: al apagarlo se pierden, y las claves con que firma cambian en
> cada arranque. Cada recorrido empieza de cero.

## Lo que se recorre

Cada fila dice qué haces y **qué tiene que pasar**. Las frases son las de la pantalla.

### Entrar y abrir un negocio (dueña)

| #   | Qué haces                                                                                           | Qué tiene que pasar                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Abrir `/registrarse`, escribir un correo y una contraseña de 6 o más caracteres y **Crear cuenta**. | Pasa a «Crea tu negocio» (`/empezar`), ya con sesión.                                                                                                                                                                                                                |
| 2   | Escribir el nombre del negocio y el tuyo y **Crear negocio**.                                       | Inicio: «Hola, Ana Gómez. Estás en Tienda La Esquina.», el estado del servicio en «En línea» y el menú: Inicio, Catálogo, Inventario, Compras y Personas.                                                                                                            |
| 3   | **Recargar la página.**                                                                             | Vuelve a «Ingresar»: **la sesión no sobrevive a recargar**, a propósito ([ADR 0022](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0022-identidad-y-sesion.md), punto 10). Se entra de nuevo con el mismo correo. |

### Catálogo

| #   | Qué haces                                                                                      | Qué tiene que pasar                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Catálogo vacío.                                                                                | «Todavía no tienes productos.» y «Nuevo producto».                                                                                                                                                                          |
| 5   | **Ver y cambiar categorías**, agregar «Granos» y volver a agregar «granos».                    | La primera: «Agregamos «Granos».»; la segunda: «Ya hay una categoría con ese nombre.» en el campo.                                                                                                                          |
| 6   | **Nuevo producto**: nombre «Arroz 500 g», SKU `ARR-500`, precio `3.200`, **Guardar producto**. | El precio dice «Escribe solo números, sin puntos, comas ni símbolos. Por ejemplo: 3200.» y no se llama al servidor.                                                                                                         |
| 7   | Cambiar el precio a `3200`, IVA 5 %, categoría Granos, existencia mínima `10`.                 | Ayudas: «Se verá como $ 3.200.», «De $ 3.200 con IVA 5 %, el IVA es $ 152.» y «Te avisamos cuando haya menos de 10 und.». Al guardar vuelve al catálogo: «Guardamos «Arroz 500 g».» y la fila «ARR-500 · Granos — $ 3.200». |
| 8   | Otro producto («Azúcar 1 kg», unidad Kilogramo, precio `4200`) con el **mismo SKU** `ARR-500`. | «Ese SKU ya lo tiene otro producto» y «ARR-500 es de «Arroz 500 g». Usa otro SKU.», con el enlace «Ver el producto».                                                                                                        |
| 9   | Cambiar el SKU a `AZU-1K` y guardar.                                                           | Se crea; el catálogo lista los dos, el segundo «AZU-1K · Sin categoría».                                                                                                                                                    |
| 10  | Abrir «Azúcar 1 kg» y **Archivar producto**; luego **Reactivar producto**.                     | «Producto archivado. Ya no se vende, pero conserva su historia.» (con la marca «Archivado» arriba) y después «Producto reactivado. Ya se puede vender.»                                                                     |

### Inventario y compras

| #   | Qué haces                                                                                                                                        | Qué tiene que pasar                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | **Inventario**.                                                                                                                                  | Los dos productos con «0 und» y «0 kg»; «Arroz 500 g» con «Bajo el mínimo» (el mínimo es 10).                                                                                           |
| 12  | Abrir «Arroz 500 g», **Ajustar existencia**, escribir la cantidad `24` y el motivo «Existencia inicial» **sin elegir** Sumar o Restar y guardar. | «Elige si suma o resta.»; no se manda nada.                                                                                                                                             |
| 13  | Elegir **Sumar**.                                                                                                                                | La ayuda dice «En unidades enteras (und). Quedarían 24 und.». Al guardar vuelve al historial: «Hay 24 und.», «Ajuste guardado.» y la fila «Ajuste — Existencia inicial · … — + 24 und». |
| 14  | **Compras → Ver y cambiar proveedores**, agregar «Distribuidora El Sol» con su teléfono.                                                         | «Agregamos «Distribuidora El Sol».» y aparece en la lista.                                                                                                                              |
| 15  | **Nueva compra**: proveedor El Sol, nota «Pedido de octubre», producto «Azúcar 1 kg», cantidad `2,5`, costo `4000` y **Agregar línea**.          | La línea dice «Azúcar 1 kg · 2,5 kg · $ 4.000 cada kg». La cantidad usa **coma**; con un punto se pide la coma.                                                                         |
| 16  | **Registrar compra**.                                                                                                                            | Vuelve a Compras: «Compra registrada: la existencia ya subió.» y la fila «17 oct · Distribuidora El Sol — 1 producto · Pedido de octubre».                                              |
| 17  | **Inventario**.                                                                                                                                  | «Azúcar 1 kg» con «2,5 kg»; «Arroz 500 g» con «24 und» y **sin** la alerta (ya no está por debajo del mínimo).                                                                          |

### Personas y roles

| #   | Qué haces                                                                                                                            | Qué tiene que pasar                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | **Personas → Invitar a alguien**: «Luis Pérez», rol Cajero.                                                                          | «Invitación creada» con un código de la forma `XXXX-XXXX-XXXX-XXXX` que **se muestra una sola vez** («Por seguridad no guardamos el código»). |
| 19  | **Cerrar sesión**, crear otra cuenta (otro correo), en «Crea tu negocio» elegir **Usar mi código** y escribir uno que no existe.     | «Ese código no existe o ya se usó. Revísalo o pide uno nuevo.»                                                                                |
| 20  | Escribir el código verdadero (se acepta en minúsculas y con espacios).                                                               | Inicio: «Hola, Luis Pérez. Estás en Tienda La Esquina.»                                                                                       |
| 21  | Como cajero, mirar el menú.                                                                                                          | Solo Inicio, Catálogo e Inventario.                                                                                                           |
| 22  | Como cajero, abrir Catálogo e Inventario.                                                                                            | Ve los productos, los precios y las existencias, **sin** «Nuevo producto» ni las categorías.                                                  |
| 23  | Como cajero, escribir en la barra de direcciones (sin recargar) `/compras`, `/personas`, `/catalogo/nuevo` o `/catalogo/categorias`. | «No tienes acceso. Tu rol no permite ver esta pantalla.»                                                                                      |
| 24  | Volver a entrar como la dueña y abrir Personas.                                                                                      | Ana Gómez (Dueño) y Luis Pérez (Cajero), y el aviso «El negocio siempre tiene un dueño».                                                      |

> En el paso 23 se cambia la dirección con el historial del navegador en lugar de escribirla en la barra, porque recargar
> cierra la sesión (paso 3): escribirla de verdad lleva a «Ingresar».

## Lo que este recorrido no cubre

- **El Supabase real de PRE.** Ni el correo de confirmación, ni los límites de uso de correos, ni que el proyecto firme con
  claves asimétricas, ni el adaptador de Prisma a través del pooler. Eso es `npm run verify:pre` del backend
  ([ADR 0025](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0025-verificacion-de-pre-contra-supabase.md))
  y, después, repetir este recorrido contra PRE.
- **Un teléfono.** Se recorrió en un navegador de escritorio. Cuánto cansa volver a escribir la contraseña al recargar en un
  teléfono que recarga a menudo (el ADR 0022 lo dice como riesgo) sigue sin medirse.
- **Lo que un rol no puede hacer dentro de una pantalla que sí ve** (por ejemplo, que el cajero no tenga «Ajustar existencia» en
  el historial de un producto). Lo cubren las pruebas de cada pantalla y, en el backend, la prueba que cruza cada ruta con
  cada rol.
- **Trabajar sin conexión.** El Ciclo 2 no incluye el motor sin conexión.
- **El detalle de una compra y sus totales.** La API no los entrega todavía.

## Cómo se repite

1. Levanta la pila (el enlace de arriba) y arranca el frontend.
2. Recorre las tablas en orden. Si algo no dice lo de la columna de la derecha, **eso es un defecto**: abre un Issue con el
   número de fila.
3. Cuando exista PRE, repítelo contra él y agrega aquí la fecha, quién lo hizo y lo que no coincidió.

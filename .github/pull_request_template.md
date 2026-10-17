## Qué hacemos

<!-- Una o dos frases. Qué cambia y por qué. -->

Refs: #

## Evidencia

- [ ] Escribimos las pruebas primero y las vimos fallar por la razón correcta (pegamos la salida en rojo y en verde).
- [ ] `npm run lint`, `format:check`, `typecheck`, `test:coverage` y `build` pasan.
- [ ] Si la interfaz cambia: la revisamos en un navegador real, en tema claro y oscuro, con movimiento reducido y a 375 px, y dejamos lo que vimos.
- [ ] Si tocamos la API que consumimos: ejecutamos `npm run contract:sync`, adaptamos el código y el trabajo «Contrato con el backend» pasa.

## Diseño, documentación y decisiones

- [ ] Si la pantalla o un componente es nuevo o cambia, está en Figma y el PR enlaza el cambio (los nombres de las variables siguen siendo los de los tokens).
- [ ] Actualizamos en este mismo PR la documentación que cambia.
- [ ] Si tomamos una decisión de arquitectura, la escribimos como ADR (en el repositorio del backend) y la enlazamos.

## Seguridad

- [ ] No hay secretos, claves ni datos personales en el código, los registros ni este PR. Ninguna variable `VITE_` lleva un secreto.
- [ ] Los commits no llevan `Co-Authored-By` ni marcas de generación.

## Qué conviene mirar al revisar

<!-- Dónde está lo delicado o lo que dudamos. -->

## Fuera de alcance y pendiente

<!-- Qué dejamos para otro ticket, para que nadie lo dé por hecho. -->

> El PR queda en borrador hasta que el CI esté en verde. Quien lo abre no lo aprueba ni lo fusiona.

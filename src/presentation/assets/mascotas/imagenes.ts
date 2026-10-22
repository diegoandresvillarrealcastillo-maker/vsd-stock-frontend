import type { Estado, Personaje } from './mascotas';
import fungitoCelebrando from './fungito-celebrando.webp';
import fungitoDormida from './fungito-dormida.webp';
import fungitoFeliz from './fungito-feliz.webp';
import fungitoNormal from './fungito-normal.webp';
import gatoCelebrando from './gato-celebrando.webp';
import gatoDormida from './gato-dormida.webp';
import gatoFeliz from './gato-feliz.webp';
import gatoNormal from './gato-normal.webp';
import obsidianCelebrando from './obsidian-celebrando.webp';
import obsidianDormida from './obsidian-dormida.webp';
import obsidianFeliz from './obsidian-feliz.webp';
import obsidianNormal from './obsidian-normal.webp';
import oriCelebrando from './ori-celebrando.webp';
import oriDormida from './ori-dormida.webp';
import oriFeliz from './ori-feliz.webp';
import oriNormal from './ori-normal.webp';
import sparkyCelebrando from './sparky-celebrando.webp';
import sparkyDormida from './sparky-dormida.webp';
import sparkyFeliz from './sparky-feliz.webp';
import sparkyNormal from './sparky-normal.webp';

// Un import por dibujo, y no `import.meta.glob`, por dos razones: TypeScript obliga a que cada personaje tenga sus cuatro
// estados (si falta uno, no compila) y si falta el archivo la compilacion falla; y Vitest guarda en cache lo que expande el
// glob, asi que despues de agregar o quitar un dibujo las pruebas verian una lista vieja. Vite le pone a cada uno su
// direccion final, con huella, en la compilacion.
const DIRECCIONES: Readonly<Record<Personaje, Readonly<Record<Estado, string>>>> = {
  fungito: {
    normal: fungitoNormal,
    feliz: fungitoFeliz,
    celebrando: fungitoCelebrando,
    dormida: fungitoDormida,
  },
  sparky: {
    normal: sparkyNormal,
    feliz: sparkyFeliz,
    celebrando: sparkyCelebrando,
    dormida: sparkyDormida,
  },
  ori: { normal: oriNormal, feliz: oriFeliz, celebrando: oriCelebrando, dormida: oriDormida },
  gato: { normal: gatoNormal, feliz: gatoFeliz, celebrando: gatoCelebrando, dormida: gatoDormida },
  obsidian: {
    normal: obsidianNormal,
    feliz: obsidianFeliz,
    celebrando: obsidianCelebrando,
    dormida: obsidianDormida,
  },
};

/** La direccion del dibujo de una mascota en un estado. */
export function imagenDeMascota(personaje: Personaje, estado: Estado): string {
  return DIRECCIONES[personaje][estado];
}

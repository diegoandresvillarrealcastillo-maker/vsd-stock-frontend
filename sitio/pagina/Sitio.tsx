import { contenido } from './contenido';
import { Anuncio } from './secciones/Anuncio';
import { BarraContacto } from './secciones/BarraContacto';
import { ComoFunciona } from './secciones/ComoFunciona';
import { Confianza } from './secciones/Confianza';
import { CtaFinal } from './secciones/CtaFinal';
import { Demo } from './secciones/Demo';
import { Funciones } from './secciones/Funciones';
import { Hero } from './secciones/Hero';
import { Limites } from './secciones/Limites';
import { LoQueViene } from './secciones/LoQueViene';
import { Navegacion } from './secciones/Navegacion';
import { Pie } from './secciones/Pie';
import { Preguntas } from './secciones/Preguntas';
import { Problema } from './secciones/Problema';

/**
 * La pagina: las secciones en el orden de la propuesta. Es la misma que el servidor prerenderiza y que el navegador monta encima,
 * asi que nada de lo que pinta puede depender de donde esta la persona o de lo que eligio antes (eso llega despues de montar).
 */
export function Sitio() {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:font-semibold focus:text-on-accent"
      >
        {contenido.navegacion.saltar}
      </a>
      <Anuncio />
      <Navegacion />
      <main id="contenido" tabIndex={-1} className="outline-none">
        <Hero />
        <Problema />
        <ComoFunciona />
        <Funciones />
        <Demo />
        <Limites />
        <Confianza />
        <LoQueViene />
        <Preguntas />
        <CtaFinal />
      </main>
      <Pie />
      <BarraContacto />
    </>
  );
}

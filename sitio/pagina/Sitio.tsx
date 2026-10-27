import { contenido } from './contenido';
import { AntesYDespues } from './secciones/AntesYDespues';
import { Beneficios } from './secciones/Beneficios';
import { ComoEmpezar } from './secciones/ComoEmpezar';
import { CtaFinal } from './secciones/CtaFinal';
import { Funciones } from './secciones/Funciones';
import { Hero } from './secciones/Hero';
import { Incluye } from './secciones/Incluye';
import { Navegacion } from './secciones/Navegacion';
import { ParaQuien } from './secciones/ParaQuien';
import { Pie } from './secciones/Pie';
import { Preguntas } from './secciones/Preguntas';
import { Pruebalo } from './secciones/Pruebalo';

/**
 * La pagina: las secciones en el orden de la propuesta comercial (LND-2). Es la misma que el servidor prerenderiza y que el navegador
 * monta encima, asi que nada de lo que pinta puede depender de donde esta la persona o de lo que eligio antes (eso llega despues de
 * montar).
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
      <Navegacion />
      <main id="contenido" tabIndex={-1} className="outline-none">
        <Hero />
        <Beneficios />
        <AntesYDespues />
        <Funciones />
        <Pruebalo />
        <ComoEmpezar />
        <ParaQuien />
        <Incluye />
        <Preguntas />
        <CtaFinal />
      </main>
      <Pie />
    </>
  );
}

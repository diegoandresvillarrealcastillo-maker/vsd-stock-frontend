import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contenido } from '../contenido';
import type { EstadoDePre, SondaDePre } from '../demos/estadoDePre';
import { API_DE_PRE } from '../destinos';
import { ChipDePre } from './ChipDePre';

// El chip del estado de la demo de PRE (C4-L6) visto desde fuera: lo que dice en cada estado y que diga lo mismo en el servidor y
// en el navegador. La consulta a la API se prueba aparte (`demos/estadoDePre.spec.ts`); aqui la sonda es de mentira.

const { estadoDemo } = contenido;

/** Una sonda que la prueba mueve a mano, y que cuenta quien la escucha. */
function sondaFalsa(inicial: EstadoDePre = 'verificando') {
  let estado = inicial;
  const oyentes = new Set<() => void>();
  const sonda: SondaDePre & {
    cambiarA: (nuevo: EstadoDePre) => void;
    oyentes: () => number;
  } = {
    leer: () => estado,
    suscribir: (avisar) => {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
    cambiarA: (nuevo) => {
      estado = nuevo;
      act(() => {
        for (const avisar of [...oyentes]) avisar();
      });
    },
    oyentes: () => oyentes.size,
  };
  return sonda;
}

const chip = (): HTMLElement => screen.getByRole('status');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChipDePre: lo que dice en cada estado', () => {
  it('abre diciendo que esta verificando, y que los datos son ficticios', () => {
    render(<ChipDePre sonda={sondaFalsa()} />);

    expect(chip().textContent).toBe(estadoDemo.verificando);
    expect(chip().getAttribute('data-estado-de-pre')).toBe('verificando');
  });

  it('dice que la demo esta disponible cuando la API contesto', () => {
    const sonda = sondaFalsa();
    render(<ChipDePre sonda={sonda} />);

    sonda.cambiarA('despierta');

    expect(chip().textContent).toBe(estadoDemo.despierta);
    expect(chip().getAttribute('data-estado-de-pre')).toBe('despierta');
  });

  it('dice que la prueba esta en reposo y la primera carga puede tardar ~25 s si la API no contesto a tiempo', () => {
    const sonda = sondaFalsa();
    render(<ChipDePre sonda={sonda} />);

    sonda.cambiarA('dormida');

    expect(chip().textContent).toBe(estadoDemo.dormida);
    expect(chip().textContent).toMatch(/Prueba en reposo; la primera carga puede tardar ~25 s/);
    expect(chip().getAttribute('data-estado-de-pre')).toBe('dormida');
  });

  it('pasa de dormida a disponible si la API contesta tarde', () => {
    const sonda = sondaFalsa();
    render(<ChipDePre sonda={sonda} />);
    sonda.cambiarA('dormida');

    sonda.cambiarA('despierta');

    expect(chip().textContent).toBe(estadoDemo.despierta);
  });

  it.each(['verificando', 'despierta', 'dormida'] as const)(
    'dice «datos ficticios» en el estado %s, y nunca dice que esta caida',
    (estado) => {
      render(<ChipDePre sonda={sondaFalsa(estado)} />);

      expect(chip().textContent).toMatch(/ficticios/i);
      expect(chip().textContent).not.toMatch(/ca[ií]d[ao]|fall[oa]|error|no funciona/i);
    },
  );

  it('es una region de estado: un lector de pantalla anuncia el cambio sin quitarle el foco a nadie', () => {
    render(<ChipDePre sonda={sondaFalsa()} />);

    expect(chip().getAttribute('role')).toBe('status');
    expect(chip().tabIndex).toBe(-1);
  });

  it('no deja que el color sea lo unico que dice el estado: cada uno tiene su frase, y el punto no se lee', () => {
    const textos = (['verificando', 'despierta', 'dormida'] as const).map((estado) => {
      const { unmount } = render(<ChipDePre sonda={sondaFalsa(estado)} />);
      const punto = chip().querySelector('[data-punto]');
      expect(punto?.getAttribute('aria-hidden')).toBe('true');
      const texto = chip().textContent;
      unmount();
      return texto;
    });

    expect(new Set(textos).size).toBe(3);
  });
});

describe('ChipDePre: quien mira y cuando', () => {
  it('empieza a mirar la sonda al montarse y deja de mirarla al irse', () => {
    const sonda = sondaFalsa();
    const { unmount } = render(<ChipDePre sonda={sonda} />);
    expect(sonda.oyentes()).toBe(1);

    unmount();

    expect(sonda.oyentes()).toBe(0);
  });

  it('en el servidor dice «verificando» aunque la sonda ya sepa mas: el navegador monta el mismo HTML', () => {
    const html = renderToString(<ChipDePre sonda={sondaFalsa('despierta')} />);

    expect(html).toContain(estadoDemo.verificando);
    expect(html).not.toContain(estadoDemo.despierta);
  });

  it('sin sonda propia usa la de la pagina: al montarse pregunta una sola vez a la API de PRE', () => {
    const buscar = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', buscar);

    render(<ChipDePre />);
    render(<ChipDePre />);

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith(
      `${API_DE_PRE}/health`,
      expect.objectContaining({ mode: 'no-cors' }),
    );
  });

  it('en el servidor no pregunta nada a la API', () => {
    const buscar = vi.fn();
    vi.stubGlobal('fetch', buscar);

    renderToString(<ChipDePre />);

    expect(buscar).not.toHaveBeenCalled();
  });
});

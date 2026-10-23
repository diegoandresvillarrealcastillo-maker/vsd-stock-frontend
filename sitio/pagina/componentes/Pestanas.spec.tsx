import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Pestanas, type Pestana } from './Pestanas';

// Las pestanas de la banda de la demo (C4-L6) vistas desde fuera: lo que se ve, lo que se toca y lo que lee un lector de pantalla.
// Siguen el patron de pestanas de WAI-ARIA con activacion manual: las flechas mueven el foco y Enter o la barra (un clic en el
// boton) eligen, porque elegir una pestana puede descargar su contenido y no debe pasar con cada flecha.

/** Un panel que cuenta cuantas veces se monto, para ver cuando la pagina lo construye. */
function Contador({
  nombre,
  alMontar,
}: {
  readonly nombre: string;
  readonly alMontar: () => void;
}) {
  const [montado] = useState(() => {
    alMontar();
    return true;
  });
  return <p>{montado ? `contenido de ${nombre}` : ''}</p>;
}

const NOMBRES = ['Vender', 'IVA', 'Caja'] as const;

function montar(alMontar: (nombre: string) => void = () => undefined) {
  const pestanas: [Pestana, ...Pestana[]] = [
    {
      clave: 'vender',
      rotulo: 'Vender',
      panel: <Contador nombre="vender" alMontar={() => alMontar('vender')} />,
    },
    {
      clave: 'iva',
      rotulo: 'IVA',
      panel: (
        <>
          <Contador nombre="iva" alMontar={() => alMontar('iva')} />
          <input aria-label="precio" defaultValue="" />
        </>
      ),
    },
    {
      clave: 'caja',
      rotulo: 'Caja',
      panel: <Contador nombre="caja" alMontar={() => alMontar('caja')} />,
    },
  ];
  return render(<Pestanas id="demo" etiqueta="Elige una demostración" pestanas={pestanas} />);
}

const pestana = (nombre: string): HTMLElement => screen.getByRole('tab', { name: nombre });
const panelDe = (nombre: string): HTMLElement => {
  const id = pestana(nombre).getAttribute('aria-controls');
  const panel = id === null ? null : document.getElementById(id);
  if (panel === null) throw new Error(`la pestana ${nombre} no controla ningun panel`);
  return panel;
};
const tocar = (nombre: string): void => {
  fireEvent.click(pestana(nombre));
};
const tecla = (nombre: string, key: string): void => {
  fireEvent.keyDown(pestana(nombre), { key });
};

describe('Pestanas: lo que se ve', () => {
  it('es una lista de pestanas con nombre, y una pestana por cada entrada, en su orden', () => {
    montar();

    const lista = screen.getByRole('tablist', { name: 'Elige una demostración' });
    expect(
      within(lista)
        .getAllByRole('tab')
        .map((p) => p.textContent),
    ).toEqual([...NOMBRES]);
  });

  it('abre con la primera pestana elegida y las demas no', () => {
    montar();

    expect(pestana('Vender').getAttribute('aria-selected')).toBe('true');
    expect(pestana('IVA').getAttribute('aria-selected')).toBe('false');
    expect(pestana('Caja').getAttribute('aria-selected')).toBe('false');
  });

  it('muestra solo el panel de la pestana elegida', () => {
    montar();

    expect(panelDe('Vender').hidden).toBe(false);
    expect(panelDe('IVA').hidden).toBe(true);
    expect(panelDe('Caja').hidden).toBe(true);
  });

  it('cambia de panel al tocar otra pestana', () => {
    montar();

    tocar('IVA');

    expect(pestana('IVA').getAttribute('aria-selected')).toBe('true');
    expect(pestana('Vender').getAttribute('aria-selected')).toBe('false');
    expect(panelDe('IVA').hidden).toBe(false);
    expect(panelDe('Vender').hidden).toBe(true);
  });

  it('sigue en la misma pestana si se toca la que ya estaba', () => {
    montar();

    tocar('Vender');

    expect(pestana('Vender').getAttribute('aria-selected')).toBe('true');
    expect(panelDe('Vender').hidden).toBe(false);
  });
});

describe('Pestanas: lo que lee un lector de pantalla', () => {
  it('cada pestana controla un panel de pestana, y el panel se llama como su pestana', () => {
    montar();

    for (const nombre of NOMBRES) {
      const panel = panelDe(nombre);
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(pestana(nombre).id);
    }
    // El nombre se ve en el panel que esta a la vista (uno escondido no se anuncia).
    expect(screen.getByRole('tabpanel', { name: 'Vender' })).toBe(panelDe('Vender'));
  });

  it('tiene todos los paneles en la pagina, aunque su contenido aun no: aria-controls nunca apunta a nada', () => {
    montar();

    for (const nombre of NOMBRES) {
      expect(document.getElementById(pestana(nombre).getAttribute('aria-controls') ?? '')).not.toBe(
        null,
      );
    }
  });

  it('usa ids que empiezan con el que le da quien la pone, y ninguno se repite', () => {
    montar();

    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.length).toBe(NOMBRES.length * 2);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('demo-')).toBe(true);
  });

  it('solo la pestana elegida entra en el orden del teclado', () => {
    montar();

    expect(pestana('Vender').tabIndex).toBe(0);
    expect(pestana('IVA').tabIndex).toBe(-1);
    expect(pestana('Caja').tabIndex).toBe(-1);

    tocar('Caja');

    expect(pestana('Caja').tabIndex).toBe(0);
    expect(pestana('Vender').tabIndex).toBe(-1);
  });

  it('las pestanas son botones que no envian nada', () => {
    montar();

    for (const nombre of NOMBRES) {
      expect(pestana(nombre).tagName).toBe('BUTTON');
      expect(pestana(nombre).getAttribute('type')).toBe('button');
    }
  });
});

describe('Pestanas: el teclado', () => {
  it('la flecha a la derecha pasa el foco a la siguiente pestana sin elegirla', () => {
    montar();
    pestana('Vender').focus();

    tecla('Vender', 'ArrowRight');

    expect(document.activeElement).toBe(pestana('IVA'));
    expect(pestana('Vender').getAttribute('aria-selected')).toBe('true');
    expect(pestana('IVA').getAttribute('aria-selected')).toBe('false');
  });

  it('la flecha a la izquierda vuelve a la anterior', () => {
    montar();
    pestana('Caja').focus();

    tecla('Caja', 'ArrowLeft');

    expect(document.activeElement).toBe(pestana('IVA'));
  });

  it('da la vuelta: despues de la ultima va la primera, y antes de la primera la ultima', () => {
    montar();
    pestana('Caja').focus();
    tecla('Caja', 'ArrowRight');
    expect(document.activeElement).toBe(pestana('Vender'));

    tecla('Vender', 'ArrowLeft');

    expect(document.activeElement).toBe(pestana('Caja'));
  });

  it('Inicio va a la primera y Fin a la ultima', () => {
    montar();
    pestana('IVA').focus();

    tecla('IVA', 'End');
    expect(document.activeElement).toBe(pestana('Caja'));

    tecla('Caja', 'Home');
    expect(document.activeElement).toBe(pestana('Vender'));
  });

  it('moverse con las flechas no abre el contenido de las pestanas por las que pasa', () => {
    const montadas: string[] = [];
    montar((nombre) => montadas.push(nombre));
    pestana('Vender').focus();

    tecla('Vender', 'ArrowRight');
    tecla('IVA', 'ArrowRight');

    expect(montadas).toEqual(['vender']);
  });

  it('ignora las demas teclas y no les quita el foco', () => {
    montar();
    pestana('Vender').focus();

    tecla('Vender', 'a');
    tecla('Vender', 'ArrowDown');

    expect(document.activeElement).toBe(pestana('Vender'));
  });

  it('evita que las flechas, Inicio y Fin muevan la pagina, y deja pasar las demas teclas', () => {
    montar();

    expect(fireEvent.keyDown(pestana('Vender'), { key: 'ArrowRight' })).toBe(false);
    expect(fireEvent.keyDown(pestana('IVA'), { key: 'Home' })).toBe(false);
    expect(fireEvent.keyDown(pestana('IVA'), { key: 'End' })).toBe(false);
    expect(fireEvent.keyDown(pestana('Caja'), { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(pestana('Caja'), { key: 'a' })).toBe(true);
  });

  it('al elegir la pestana que tiene el foco, ella pasa a ser la que entra en el orden del teclado', () => {
    montar();
    pestana('Vender').focus();
    tecla('Vender', 'ArrowRight');

    fireEvent.click(document.activeElement as HTMLElement);

    expect(pestana('IVA').tabIndex).toBe(0);
    expect(pestana('Vender').tabIndex).toBe(-1);
  });
});

describe('Pestanas: cuando se construye cada panel', () => {
  it('solo construye el panel de la primera pestana al abrir', () => {
    const montadas: string[] = [];
    montar((nombre) => montadas.push(nombre));

    expect(montadas).toEqual(['vender']);
    expect(within(panelDe('IVA')).queryByText(/contenido/)).toBeNull();
  });

  it('construye el panel de una pestana la primera vez que se elige', () => {
    const montadas: string[] = [];
    montar((nombre) => montadas.push(nombre));

    tocar('IVA');

    expect(montadas).toEqual(['vender', 'iva']);
    expect(within(panelDe('IVA')).getByText('contenido de iva')).toBeTruthy();
  });

  it('no vuelve a construir un panel por volver a elegirlo, y conserva lo que la persona escribio', () => {
    const montadas: string[] = [];
    montar((nombre) => montadas.push(nombre));
    tocar('IVA');
    fireEvent.change(screen.getByLabelText('precio'), { target: { value: '11900' } });

    tocar('Caja');
    tocar('IVA');
    tocar('Vender');
    tocar('IVA');

    expect(montadas).toEqual(['vender', 'iva', 'caja']);
    expect(screen.getByLabelText<HTMLInputElement>('precio').value).toBe('11900');
  });

  it('deja los paneles que ya se vieron en la pagina, escondidos, para que no se pierdan', () => {
    montar();
    tocar('IVA');
    tocar('Vender');

    expect(panelDe('IVA').hidden).toBe(true);
    expect(within(panelDe('IVA')).getByText('contenido de iva')).toBeTruthy();
  });
});

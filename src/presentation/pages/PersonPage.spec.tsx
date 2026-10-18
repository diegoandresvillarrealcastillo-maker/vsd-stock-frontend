import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakePeople, testInvitation, testPerson } from '../../../test/support/people';
import { renderScreen } from '../../../test/support/screens';
import { PersonPage } from './PersonPage';

// El `userId` de la membresia de prueba es `u-ana`: la persona «yo» de las pruebas.
const ANA = testPerson({
  id: 'u-ana',
  fullName: 'Ana Gómez',
  role: 'owner',
  email: 'ana@ejemplo.co',
});
const BETO = testPerson({
  id: 'beto',
  fullName: 'Beto Pérez',
  role: 'admin',
  email: 'beto@ejemplo.co',
});
const CARLA = testPerson({
  id: 'carla',
  fullName: 'Carla Ruiz',
  role: 'cashier',
  email: 'carla@ejemplo.co',
});
const DANIEL = testPerson({
  id: 'daniel',
  fullName: 'Daniel Mora',
  role: 'cashier',
  email: null,
  status: 'pending',
  invitationExpiresAt: new Date('2026-10-24T12:00:00.000Z'),
});
const EVA = testPerson({ id: 'eva', fullName: 'Eva Torres', role: 'cashier', status: 'inactive' });
const EVERYONE = [ANA, BETO, CARLA, DANIEL, EVA];

function setup(personId: string, actor: Role = 'owner', everyone = EVERYONE) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', actor));
  const people = createFakePeople(everyone);
  const view = renderScreen(
    <Routes>
      <Route path="/personas/:personId" element={<PersonPage />} />
    </Routes>,
    { path: `/personas/${personId}`, auth, people },
  );
  return { ...view, people };
}

const failure = (code: string, status = 409) =>
  new ApiError({
    class: status === 409 ? 'conflict' : 'permanent',
    status,
    retryAfterMs: null,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status,
      detail: 'd',
      instance: '/v1/users/x',
      code,
      traceId: 'x',
    },
  });

const save = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await Promise.resolve();
  });
};
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await Promise.resolve();
  });
};

describe('PersonPage', () => {
  it('says it is loading, then shows the person with their email, role and state', async () => {
    setup('carla');

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(await screen.findByRole('heading', { level: 1, name: 'Carla Ruiz' })).toBeDefined();
    expect(screen.getByText('carla@ejemplo.co')).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('Carla Ruiz');
    expect(screen.getByLabelText<HTMLSelectElement>('Rol').value).toBe('cashier');
  });

  it('has a way back to the list', async () => {
    setup('carla');

    expect(
      (await screen.findByRole('link', { name: 'Volver a personas' })).getAttribute('href'),
    ).toBe('/personas');
  });

  it('says there is no such person when the address names someone who is not in the business', async () => {
    setup('nadie');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No encontramos a esa persona' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver a personas' })).toBeDefined();
  });

  it('says what went wrong when the people cannot be loaded, and tries again', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testMe('ana', 'owner'));
    const people = createFakePeople(EVERYONE);
    people.listEveryone.mockRejectedValueOnce(
      new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null }),
    );
    renderScreen(
      <Routes>
        <Route path="/personas/:personId" element={<PersonPage />} />
      </Routes>,
      { path: '/personas/carla', auth, people },
    );

    expect(await screen.findByText('No pudimos cargar a la persona')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Carla Ruiz' })).toBeDefined();
  });

  describe('changing the name and the role', () => {
    it('tells the people the owner can give: owner, administrator and cashier', async () => {
      setup('carla');
      await screen.findByLabelText('Rol');

      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Dueño',
        'Administrador',
        'Cajero',
      ]);
    });

    it('lets an administrator look after cashiers only, so the role cannot be changed', async () => {
      setup('carla', 'admin');
      await screen.findByLabelText('Rol');

      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cajero']);
    });

    it('sends only what changed', async () => {
      const { people } = setup('carla');
      await screen.findByLabelText('Nombre');
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Carla R. Ruiz' } });

      await save();

      expect(people.updatePerson).toHaveBeenCalledWith('carla', { fullName: 'Carla R. Ruiz' });
      expect(screen.getByRole('status').textContent).toContain('Cambios guardados.');
    });

    it('sends the role when only the role changed', async () => {
      const { people } = setup('carla');
      await screen.findByLabelText('Rol');
      fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'admin' } });

      await save();

      expect(people.updatePerson).toHaveBeenCalledWith('carla', { role: 'admin' });
    });

    it('says nothing changed and sends nothing when there is nothing to save', async () => {
      const { people } = setup('carla');
      await screen.findByLabelText('Nombre');

      await save();

      expect(screen.getByRole('status').textContent).toContain('No hiciste ningún cambio.');
      expect(people.updatePerson).not.toHaveBeenCalled();
    });

    it('asks for the name when it is blanked', async () => {
      const { people } = setup('carla');
      await screen.findByLabelText('Nombre');
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  ' } });

      await save();

      expect(screen.getByText('Escribe el nombre de la persona.')).toBeDefined();
      expect(people.updatePerson).not.toHaveBeenCalled();
    });

    it('shows the person as the server left them, for who looks at the heading', async () => {
      setup('carla');
      await screen.findByLabelText('Nombre');
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Carla Nueva' } });

      await save();

      expect(screen.getByRole('heading', { level: 1, name: 'Carla Nueva' })).toBeDefined();
    });

    it('says the role does not allow it, and keeps what was typed', async () => {
      const { people } = setup('carla');
      people.updatePerson.mockRejectedValueOnce(failure('forbidden', 403));
      await screen.findByLabelText('Nombre');
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otro' } });

      await save();

      expect(screen.getByRole('alert').textContent).toContain('Tu rol no permite hacer esto.');
      expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('Otro');
    });
  });

  describe('who can be changed', () => {
    it('does not let an administrator change another administrator or an owner, and says why', async () => {
      setup('beto', 'admin');

      expect(await screen.findByRole('heading', { level: 1, name: 'Beto Pérez' })).toBeDefined();
      expect(
        screen.getByText(/Solo el dueño puede cambiar a administradores y dueños/),
      ).toBeDefined();
      expect(screen.queryByLabelText('Nombre')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
    });

    it('lets an owner change an administrator', async () => {
      setup('beto', 'owner');

      expect(await screen.findByLabelText('Nombre')).toBeDefined();
      expect(screen.queryByText(/Solo el dueño puede cambiar/)).toBeNull();
    });
  });

  describe('the only owner', () => {
    it('explains that the business cannot be left without an owner, to the person themselves', async () => {
      setup('u-ana');

      expect(await screen.findByText('Eres el único dueño')).toBeDefined();
      expect(screen.getByText(/no puede quedarse sin un dueño activo/)).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
      expect(screen.getByLabelText<HTMLSelectElement>('Rol').disabled).toBe(true);
    });

    it('lets the only owner still change their name', async () => {
      const { people } = setup('u-ana');
      await screen.findByLabelText('Nombre');
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana M. Gómez' } });

      await save();

      expect(people.updatePerson).toHaveBeenCalledWith('u-ana', { fullName: 'Ana M. Gómez' });
    });

    it('says «es el único dueño» when someone else looks at them', async () => {
      const boss = testPerson({ id: 'otra', fullName: 'Otra Dueña', role: 'owner' });
      setup('otra', 'owner', [boss, CARLA]);

      expect(await screen.findByText('Es el único dueño')).toBeDefined();
    });

    it('lets an owner be let go when there is another active owner', async () => {
      const second = testPerson({ id: 'otra', fullName: 'Otra Dueña', role: 'owner' });
      setup('otra', 'owner', [ANA, second, CARLA]);

      expect(await screen.findByRole('button', { name: 'Dar de baja' })).toBeDefined();
      expect(screen.queryByText('Es el único dueño')).toBeNull();
    });

    it('counts only the owners who are still active', async () => {
      const gone = testPerson({
        id: 'baja',
        fullName: 'Dueña de baja',
        role: 'owner',
        status: 'inactive',
      });
      setup('u-ana', 'owner', [ANA, gone]);

      expect(await screen.findByText('Eres el único dueño')).toBeDefined();
    });

    it('says it too when the server refuses, if the screen did not know', async () => {
      const second = testPerson({ id: 'otra', fullName: 'Otra Dueña', role: 'owner' });
      const { people } = setup('otra', 'owner', [ANA, second]);
      people.updatePerson.mockRejectedValueOnce(failure('last-owner'));
      await screen.findByRole('button', { name: 'Dar de baja' });
      await click('Dar de baja');

      await click('Sí, dar de baja');

      expect(screen.getByRole('alert').textContent).toContain(
        'El negocio no puede quedarse sin un dueño activo.',
      );
    });
  });

  describe('letting someone go', () => {
    it('asks first, saying who and what it means, and does nothing until the person confirms', async () => {
      const { people } = setup('carla');
      await screen.findByRole('button', { name: 'Dar de baja' });

      await click('Dar de baja');

      expect(screen.getByText('¿Dar de baja a Carla Ruiz?')).toBeDefined();
      expect(screen.getByText(/Ya no podrá entrar al negocio/)).toBeDefined();
      expect(people.updatePerson).not.toHaveBeenCalled();
    });

    it('goes back without changing anything when the person cancels', async () => {
      const { people } = setup('carla');
      await screen.findByRole('button', { name: 'Dar de baja' });
      await click('Dar de baja');

      await click('Cancelar');

      expect(screen.queryByText('¿Dar de baja a Carla Ruiz?')).toBeNull();
      expect(people.updatePerson).not.toHaveBeenCalled();
    });

    it('lets her go when confirmed, and shows her as let go', async () => {
      const { people } = setup('carla');
      await screen.findByRole('button', { name: 'Dar de baja' });
      await click('Dar de baja');

      await click('Sí, dar de baja');

      expect(people.updatePerson).toHaveBeenCalledWith('carla', { active: false });
      expect(screen.getByText('De baja')).toBeDefined();
      expect(screen.queryByText('¿Dar de baja a Carla Ruiz?')).toBeNull();
      expect(screen.getByRole('button', { name: 'Dar de alta' })).toBeDefined();
    });

    it('lets someone who was let go come back with one press, without asking', async () => {
      const { people } = setup('eva');
      await screen.findByRole('button', { name: 'Dar de alta' });

      await click('Dar de alta');

      expect(people.updatePerson).toHaveBeenCalledWith('eva', { active: true });
      expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeDefined();
    });

    it('does not offer to let go someone who is already out, nor to bring back someone who is in', async () => {
      setup('eva');

      await screen.findByRole('button', { name: 'Dar de alta' });
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
    });
  });

  describe('someone who has not redeemed their invitation yet', () => {
    it('says it is pending and offers a new code, when they lost it', async () => {
      setup('daniel');

      expect(await screen.findByText('Pendiente')).toBeDefined();
      expect(screen.getByText(/Todavía no canjeó su código/)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Crear un código nuevo' })).toBeDefined();
    });

    it('shows the new code once, as when it was first made', async () => {
      const { people } = setup('daniel');
      people.renewInvitation.mockResolvedValueOnce(testInvitation({ code: 'WXYZ-2345-6789-ABCD' }));
      await screen.findByRole('button', { name: 'Crear un código nuevo' });

      await click('Crear un código nuevo');

      expect(people.renewInvitation).toHaveBeenCalledWith('daniel');
      expect(screen.getByRole('heading', { level: 1, name: 'Código nuevo' })).toBeDefined();
      expect(screen.getByText('WXYZ-2345-6789-ABCD')).toBeDefined();
    });

    it('does not offer a new code to someone who already entered', async () => {
      setup('carla');
      await screen.findByLabelText('Nombre');

      expect(screen.queryByRole('button', { name: 'Crear un código nuevo' })).toBeNull();
    });

    it('says why when the code cannot be renewed', async () => {
      const { people } = setup('daniel');
      people.renewInvitation.mockRejectedValueOnce(failure('invitation-not-pending'));
      await screen.findByRole('button', { name: 'Crear un código nuevo' });

      await click('Crear un código nuevo');

      expect(screen.getByRole('alert').textContent).toContain('ya canjeó su invitación');
    });
  });

  describe('what the server says about each field, and the cursor', () => {
    const invalid = (pointer: string, detail: string) =>
      new ApiError({
        class: 'permanent',
        status: 400,
        retryAfterMs: null,
        problem: {
          type: 'urn:vsd-stock:problem:validation-failed',
          title: 't',
          status: 400,
          detail: 'd',
          instance: '/v1/users/beto',
          code: 'validation-failed',
          traceId: 'x',
          errors: [{ pointer, code: 'invalid', detail }],
        },
      });

    it('puts what the server says about the name under the name', async () => {
      const { people } = setup('beto');
      people.updatePerson.mockRejectedValue(invalid('/fullName', 'Ese nombre no sirve.'));
      fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Otro' } });

      await save();

      expect(screen.getByText('Ese nombre no sirve.')).toBeDefined();
      expect(screen.getByLabelText('Nombre').getAttribute('aria-invalid')).toBe('true');
    });

    it('puts what the server says about the role under the role', async () => {
      const { people } = setup('beto');
      people.updatePerson.mockRejectedValue(invalid('/role', 'Ese rol no es posible.'));
      fireEvent.change(await screen.findByLabelText('Rol'), { target: { value: 'cashier' } });

      await save();

      expect(screen.getByText('Ese rol no es posible.')).toBeDefined();
      expect(screen.getByLabelText('Rol').getAttribute('aria-invalid')).toBe('true');
    });

    it('puts the cursor on the name when it is blanked', async () => {
      setup('beto');
      fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: '  ' } });

      await save();

      expect(document.activeElement?.id).toBe('nombre');
    });

    it('stops saying «Cambios guardados» as soon as the person changes something else', async () => {
      setup('beto');
      fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Beto P.' } });
      await save();
      expect(screen.getByText('Cambios guardados.')).toBeDefined();

      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Beto Pe' } });

      expect(screen.queryByText('Cambios guardados.')).toBeNull();
    });
  });

  describe('what is shown after something is done to the person', () => {
    it('goes back to what was saved when the person is let go, forgetting what was typed and not saved', async () => {
      setup('beto');
      fireEvent.change(await screen.findByLabelText('Nombre'), {
        target: { value: 'Otro nombre' },
      });
      fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'cashier' } });

      fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Sí, dar de baja' }));
        await Promise.resolve();
      });

      expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('Beto Pérez');
      expect(screen.getByLabelText<HTMLSelectElement>('Rol').value).toBe('admin');
    });

    it('does not offer to bring back, or to renew the code of, someone it can not look after', async () => {
      const OTRO_ADMIN = testPerson({
        id: 'otro',
        fullName: 'Otro Admin',
        role: 'admin',
        status: 'inactive',
      });
      const PENDIENTE = testPerson({
        id: 'pendiente',
        fullName: 'Admin Pendiente',
        role: 'admin',
        status: 'pending',
        invitationExpiresAt: new Date('2026-10-24T12:00:00.000Z'),
      });
      setup('otro', 'admin', [ANA, OTRO_ADMIN, PENDIENTE]);
      await screen.findByRole('heading', { level: 1, name: 'Otro Admin' });

      expect(screen.queryByRole('button', { name: 'Dar de alta' })).toBeNull();
    });

    it('does not offer a new code for an administrator to another administrator', async () => {
      const PENDIENTE = testPerson({
        id: 'pendiente',
        fullName: 'Admin Pendiente',
        role: 'admin',
        status: 'pending',
        invitationExpiresAt: new Date('2026-10-24T12:00:00.000Z'),
      });
      setup('pendiente', 'admin', [ANA, PENDIENTE]);
      await screen.findByRole('heading', { level: 1, name: 'Admin Pendiente' });

      expect(screen.queryByRole('button', { name: 'Crear un código nuevo' })).toBeNull();
    });

    it('assumes the least it can when it does not know who is looking: nothing can be changed', async () => {
      const auth = createTestAuth();
      renderScreen(
        <Routes>
          <Route path="/personas/:personId" element={<PersonPage />} />
        </Routes>,
        { path: '/personas/carla', auth, people: createFakePeople(EVERYONE) },
      );

      await screen.findByRole('heading', { level: 1, name: 'Carla Ruiz' });

      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
      expect(screen.getByText('Solo lectura')).toBeDefined();
    });
  });

  describe('who counts as the only owner', () => {
    it('does not call «the only owner» someone who was let go, when there is another active owner', async () => {
      const VIEJO = testPerson({
        id: 'viejo',
        fullName: 'Viejo Dueño',
        role: 'owner',
        status: 'inactive',
      });
      setup('viejo', 'owner', [ANA, VIEJO]);
      await screen.findByRole('heading', { level: 1, name: 'Viejo Dueño' });

      expect(screen.queryByText('Es el único dueño')).toBeNull();
    });

    it('counts the owner that was just made, so the new one is not taken for the only one', async () => {
      const { people } = setup('beto', 'owner', [ANA, BETO]);
      fireEvent.change(await screen.findByLabelText('Rol'), { target: { value: 'owner' } });

      await save();
      await screen.findByText('Cambios guardados.');

      expect(people.updatePerson).toHaveBeenCalledWith('beto', { role: 'owner' });
      expect(screen.queryByText('Es el único dueño')).toBeNull();
    });
  });
});

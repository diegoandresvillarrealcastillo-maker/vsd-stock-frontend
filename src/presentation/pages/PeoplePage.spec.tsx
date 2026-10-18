import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakePeople, testPerson } from '../../../test/support/people';
import { renderScreen } from '../../../test/support/screens';
import { PeoplePage } from './PeoplePage';

const ANA = testPerson({
  id: 'ana',
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
const DANIEL = testPerson({
  id: 'daniel',
  fullName: 'Daniel Mora',
  role: 'cashier',
  email: null,
  status: 'pending',
  invitationExpiresAt: new Date('2026-10-24T12:00:00.000Z'),
});
const EVA = testPerson({
  id: 'eva',
  fullName: 'Eva Torres',
  role: 'cashier',
  email: 'eva@ejemplo.co',
  status: 'inactive',
});

function setup(role: Role = 'owner', people = createFakePeople([ANA, BETO, DANIEL, EVA])) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const view = renderScreen(<PeoplePage />, { path: '/personas', auth, people });
  return { ...view, people };
}

const failure = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

describe('PeoplePage', () => {
  it('says it is loading while the people arrive', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando personas');
    await screen.findByText('Ana Gómez');
  });

  it('lists everyone with their email, their role and their state', async () => {
    setup();

    const list = await screen.findByRole('list', { name: 'Personas del negocio' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toContain('Ana Gómez');
    expect(rows[0]?.textContent).toContain('ana@ejemplo.co');
    expect(rows[0]?.textContent).toContain('Dueño');
    expect(rows[1]?.textContent).toContain('Administrador');
    expect(rows[2]?.textContent).toContain('Sin correo');
    expect(rows[2]?.textContent).toContain('Cajero');
    expect(rows[2]?.textContent).toContain('Pendiente');
    expect(rows[3]?.textContent).toContain('De baja');
    expect(rows[0]?.textContent).not.toContain('Pendiente');
    expect(rows[0]?.textContent).not.toContain('De baja');
    expect(rows[3]?.textContent).not.toContain('Pendiente');
    expect(rows[2]?.textContent).not.toContain('De baja');
    expect(rows[3]?.textContent).not.toContain('Pendiente');
    expect(rows[2]?.textContent).not.toContain('De baja');
  });

  it('takes the person to the detail of the row they choose', async () => {
    setup();

    const link = await screen.findByRole('link', { name: /Beto Pérez/ });

    expect(link.getAttribute('href')).toBe('/personas/beto');
  });

  it('does not put a person that is not valid to a link that cannot be followed: the id is part of the address', async () => {
    setup('owner', createFakePeople([testPerson({ id: 'a/b', fullName: 'Rara' })]));

    const link = await screen.findByRole('link', { name: /Rara/ });

    expect(link.getAttribute('href')).toBe('/personas/a%2Fb');
  });

  it.each(['owner', 'admin'] as const)('lets a %s invite someone', async (role) => {
    setup(role);

    const link = await screen.findByRole('link', { name: 'Invitar a alguien' });

    expect(link.getAttribute('href')).toBe('/personas/nueva');
  });

  it('does not offer to invite to who cannot invite anyone', async () => {
    setup('cashier');
    await screen.findByText('Ana Gómez');

    expect(screen.queryByRole('link', { name: 'Invitar a alguien' })).toBeNull();
  });

  it('explains that the business always has an owner', async () => {
    setup();

    expect(await screen.findByText('El negocio siempre tiene un dueño')).toBeDefined();
  });

  it('says what went wrong and offers to try again, which asks for the same thing again', async () => {
    const people = createFakePeople([ANA]);
    people.listPeople.mockRejectedValueOnce(failure);
    setup('owner', people);

    expect(await screen.findByText('No pudimos cargar las personas')).toBeDefined();
    expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Ana Gómez')).toBeDefined();
    expect(people.listPeople).toHaveBeenCalledTimes(2);
  });

  it('loads the next page when asked, after the ones already shown, and stops offering it at the end', async () => {
    const people = createFakePeople();
    people.listPeople
      .mockResolvedValueOnce({ items: [ANA], nextCursor: 'siguiente' })
      .mockResolvedValueOnce({ items: [BETO], nextCursor: null });
    setup('owner', people);
    await screen.findByText('Ana Gómez');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await Promise.resolve();
    });

    expect(people.listPeople).toHaveBeenLastCalledWith('siguiente');
    expect(screen.getByText('Ana Gómez')).toBeDefined();
    expect(screen.getByText('Beto Pérez')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('does not offer to load more when the list is complete', async () => {
    setup();
    await screen.findByText('Ana Gómez');

    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('says what went wrong when the next page fails, and keeps what was already shown', async () => {
    const people = createFakePeople();
    people.listPeople
      .mockResolvedValueOnce({ items: [ANA], nextCursor: 'siguiente' })
      .mockRejectedValueOnce(failure);
    setup('owner', people);
    await screen.findByText('Ana Gómez');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión con el servidor');
    expect(screen.getByText('Ana Gómez')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cargar más' })).toBeDefined();
  });

  it('has the heading of the screen', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Personas' })).toBeDefined();
  });

  it('does not offer to invite while it does not know who is asking', async () => {
    const auth = createTestAuth();
    renderScreen(<PeoplePage />, { path: '/personas', auth, people: createFakePeople([ANA]) });

    await screen.findByText('Ana Gómez');

    expect(screen.queryByRole('link', { name: 'Invitar a alguien' })).toBeNull();
  });

  it('follows the cursor page after page, in order, and keeps offering more until the last one', async () => {
    const people = createFakePeople([]);
    people.listPeople
      .mockResolvedValueOnce({ items: [ANA], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [BETO], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [DANIEL], nextCursor: null });
    setup('owner', people);
    await screen.findByText('Ana Gómez');

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Beto Pérez');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Daniel Mora');

    expect(people.listPeople).toHaveBeenLastCalledWith('c2');
    const names = within(screen.getByRole('list', { name: 'Personas del negocio' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent ?? '');
    expect(names[0]).toContain('Ana Gómez');
    expect(names[1]).toContain('Beto Pérez');
    expect(names[2]).toContain('Daniel Mora');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('does not offer to invite while it does not know who is asking', async () => {
    const auth = createTestAuth();
    renderScreen(<PeoplePage />, { path: '/personas', auth, people: createFakePeople([ANA]) });

    await screen.findByText('Ana Gómez');

    expect(screen.queryByRole('link', { name: 'Invitar a alguien' })).toBeNull();
  });

  it('follows the cursor page after page, in order, and keeps offering more until the last one', async () => {
    const people = createFakePeople([]);
    people.listPeople
      .mockResolvedValueOnce({ items: [ANA], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [BETO], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [DANIEL], nextCursor: null });
    setup('owner', people);
    await screen.findByText('Ana Gómez');

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Beto Pérez');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Daniel Mora');

    expect(people.listPeople).toHaveBeenLastCalledWith('c2');
    const names = within(screen.getByRole('list', { name: 'Personas del negocio' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent ?? '');
    expect(names[0]).toContain('Ana Gómez');
    expect(names[1]).toContain('Beto Pérez');
    expect(names[2]).toContain('Daniel Mora');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });
});

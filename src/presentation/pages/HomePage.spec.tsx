import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestConnection } from '../../../test/support/connection';
import { renderScreen } from '../../../test/support/screens';
import { HomePage } from './HomePage';

function setup() {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner', 'Tienda La Esquina'));
  const connection = createTestConnection();
  renderScreen(<HomePage />, { path: '/', auth, connection });
  return { connection };
}

describe('HomePage', () => {
  it('greets the person and says in which business they are', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeDefined();
    expect(await screen.findByText('Hola, Ana Gómez. Estás en Tienda La Esquina.')).toBeDefined();
  });

  it('shows what the server answers: the application starts watching when it opens', async () => {
    const { connection } = setup();
    expect(connection.health.requests).toBe(1);

    await act(async () => {
      await connection.health.succeed();
    });

    expect(screen.getByText('En línea')).toBeDefined();
  });

  it('shows that there is no connection when the server does not answer, and offers to try again', async () => {
    const { connection } = setup();

    await act(async () => {
      await connection.health.fail();
    });

    expect(screen.getByText('Sin conexión')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });
});

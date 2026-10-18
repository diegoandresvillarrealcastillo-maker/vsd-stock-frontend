import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestConnection } from '../../../test/support/connection';
import { renderScreen } from '../../../test/support/screens';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('puts what it is given in the main part of the page, which can take the focus from a «skip» link', () => {
    renderScreen(
      <AuthLayout>
        <p>Contenido de la pantalla</p>
      </AuthLayout>,
    );

    const main = screen.getByRole('main');
    expect(main.id).toBe('contenido');
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(main.textContent).toContain('Contenido de la pantalla');
  });

  it('shows the brand and the theme button, so the theme can be changed before signing in', () => {
    renderScreen(<AuthLayout>x</AuthLayout>);

    expect(screen.getByText('VSD Stock')).toBeDefined();
    expect(screen.getByRole('button', { name: /Cambiar a tema/ })).toBeDefined();
  });

  it('says nothing about the connection while the server answers', async () => {
    const connection = createTestConnection();
    renderScreen(<AuthLayout>x</AuthLayout>, { connection });

    await act(async () => {
      await connection.health.succeed();
    });

    expect(screen.queryByText('Sin conexión')).toBeNull();
  });

  it('says there is no connection when the server does not answer, because nothing here can be done without it', async () => {
    const connection = createTestConnection();
    renderScreen(<AuthLayout>x</AuthLayout>, { connection });

    await act(async () => {
      await connection.health.fail();
    });

    expect(screen.getByText('Sin conexión')).toBeDefined();
    expect(screen.getByText(/No podemos hablar con el servidor/)).toBeDefined();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakePeople } from '../../../test/support/people';
import { PeopleProvider, usePeople } from './PeopleProvider';

function Probe() {
  const people = usePeople();
  return <p data-testid="listo">{typeof people.listPeople}</p>;
}

describe('PeopleProvider', () => {
  it('gives the people of the business to whoever asks inside it', () => {
    render(
      <PeopleProvider people={createFakePeople()}>
        <Probe />
      </PeopleProvider>,
    );

    expect(screen.getByTestId('listo').textContent).toBe('function');
  });

  it('refuses to be used outside the provider, naming it', () => {
    const quiet = console.error;
    console.error = () => undefined;
    try {
      expect(() => render(<Probe />)).toThrow(/PeopleProvider/);
    } finally {
      console.error = quiet;
    }
  });
});

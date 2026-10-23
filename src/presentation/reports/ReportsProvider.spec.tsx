import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeReports } from '../../../test/support/reports';
import { ReportsProvider, useReports } from './ReportsProvider';

function Probe() {
  const reports = useReports();
  return <p data-testid="listo">{typeof reports.monthly}</p>;
}

describe('ReportsProvider', () => {
  it('gives the reports of the business to whoever asks inside it', () => {
    render(
      <ReportsProvider reports={createFakeReports()}>
        <Probe />
      </ReportsProvider>,
    );

    expect(screen.getByTestId('listo').textContent).toBe('function');
  });

  it('refuses to be used outside the provider, naming it', () => {
    const quiet = console.error;
    console.error = () => undefined;
    try {
      expect(() => render(<Probe />)).toThrow(/ReportsProvider/);
    } finally {
      console.error = quiet;
    }
  });
});

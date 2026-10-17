import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from './FormField';

function renderField(props: Partial<React.ComponentProps<typeof FormField>> = {}) {
  const onChange = vi.fn();
  render(<FormField id="correo" label="Correo" value="" onChange={onChange} {...props} />);
  return { onChange, input: screen.getByLabelText<HTMLInputElement>('Correo') };
}

describe('FormField', () => {
  it('joins the label to the input, so a screen reader says what the field is for', () => {
    const { input } = renderField();

    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBe('correo');
  });

  it('tells what the person types, letter by letter', () => {
    const { input, onChange } = renderField();

    fireEvent.change(input, { target: { value: 'ana@' } });

    expect(onChange).toHaveBeenCalledWith('ana@');
  });

  it('shows what it holds', () => {
    const { input } = renderField({ value: 'ana@ejemplo.co' });

    expect(input.value).toBe('ana@ejemplo.co');
  });

  it('passes the kind of input and its hints to the keyboard and to the password manager', () => {
    const { input } = renderField({
      type: 'email',
      autoComplete: 'email',
      inputMode: 'email',
      name: 'email',
    });

    expect(input.type).toBe('email');
    expect(input.autocomplete).toBe('email');
    expect(input.inputMode).toBe('email');
    expect(input.name).toBe('email');
  });

  it('can ask the keyboard not to correct a code and to write it in capitals', () => {
    const { input } = renderField({ autoCapitalize: 'characters', spellCheck: false });

    expect(input.getAttribute('autocapitalize')).toBe('characters');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('is plain text by default', () => {
    const { input } = renderField();

    expect(input.type).toBe('text');
  });

  it('shows a hint and ties it to the input', () => {
    const { input } = renderField({ hint: 'Lo usas para entrar.' });

    const hint = screen.getByText('Lo usas para entrar.');
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('shows an error instead of the hint, marks the input as invalid and ties the error to it', () => {
    const { input } = renderField({ hint: 'Lo usas para entrar.', error: 'Falta el correo.' });

    const error = screen.getByText('Falta el correo.');
    expect(screen.queryByText('Lo usas para entrar.')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('has nothing to describe when it has neither a hint nor an error', () => {
    const { input } = renderField();

    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('can be disabled while something is being sent', () => {
    const { input } = renderField({ disabled: true });

    expect(input.disabled).toBe(true);
  });

  it('can be a short list of choices, as readable by a keyboard and a screen reader as a text field', () => {
    const onChange = vi.fn();
    render(
      <FormField
        id="rol"
        label="Rol"
        value="cashier"
        onChange={onChange}
        options={[
          { value: 'admin', label: 'Administrador' },
          { value: 'cashier', label: 'Cajero' },
        ]}
      />,
    );

    const select = screen.getByLabelText<HTMLSelectElement>('Rol');
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('cashier');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Administrador',
      'Cajero',
    ]);

    fireEvent.change(select, { target: { value: 'admin' } });

    expect(onChange).toHaveBeenCalledWith('admin');
  });

  it('says it is required to a screen reader, without the browser putting its own message over ours', () => {
    const { input } = renderField({ required: true });

    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.required).toBe(false);
  });
});

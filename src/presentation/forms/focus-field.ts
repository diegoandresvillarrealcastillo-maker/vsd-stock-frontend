/** Le da el foco al campo con ese `id`, para que quien usa solo el teclado empiece donde esta lo que falta. */
export function focusField(id: string): void {
  document.getElementById(id)?.focus();
}

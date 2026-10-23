// El ritmo del dibujo (C4-L4): cuanto espera cada paso antes de salir y cuanto tarda en llegar. Es de quien anima y no de la maquina:
// la maquina decide QUE pasa (`siguientePaso`) y esto, CUANDO. Un cobro se toma su tiempo; los envios de una cola salen casi
// seguidos para que se vea que bajan una venta tras otra.

/** Lo que tarda una venta enviada en bajar por el enlace de internet y lo que tarda en entrar al libro, en milisegundos. */
export const TRAMOS_MS = { enlace: 650, libro: 450 } as const;

/** Lo que el dibujo espera, en milisegundos, antes de que la venta salga. */
export const PAUSA_MS = { vender: 1400, enviar: 300 } as const;

/** Lo que tarda la venta en llegar a donde va, en milisegundos. Es lo que dura su animacion. */
export const VIAJE_MS = { vender: 700, enviar: TRAMOS_MS.enlace + TRAMOS_MS.libro } as const;

import type { Scheduler } from '../../../domain/ports/out/scheduler';

/** El temporizador del navegador (`setTimeout`) detras del puerto `Scheduler`. */
export class TimeoutScheduler implements Scheduler {
  schedule(callback: () => void, delayMs: number): () => void {
    const handle = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(handle);
    };
  }
}

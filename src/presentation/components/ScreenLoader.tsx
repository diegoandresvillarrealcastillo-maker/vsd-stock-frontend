import { Component, Suspense, type ReactNode } from 'react';
import { Button } from './Button';
import { RowsSkeleton } from './RowsSkeleton';

interface ScreenLoaderProps {
  children: ReactNode;
  /** Cambia cuando la persona va a otra pantalla: el aviso de una que no abrio no se queda pegado a la siguiente. */
  resetKey: string;
  /** Recarga la aplicacion. Por omision, la pagina; se cambia en las pruebas, donde recargar no existe. */
  onReload?: () => void;
}

interface ScreenLoaderState {
  failed: boolean;
  resetKey: string;
}

/**
 * Donde esperan las pantallas que bajan solo cuando alguien entra a ellas (C4-R0): mientras llegan dice que vienen en camino, y si
 * una no llega (se cayo la red antes de instalar la aplicacion, o salio una version nueva y el archivo viejo ya no esta) lo dice y
 * ofrece recargar, en vez de dejar la pagina en blanco. Recargar es lo unico que arregla un archivo que fallo: el navegador recuerda
 * que fallo y no lo vuelve a pedir hasta recargar. El marco y el menu quedan en pie. Tambien atrapa una pantalla que se rompe al
 * dibujarse: para quien la usa es lo mismo, esta pantalla no abre.
 */
export class ScreenLoader extends Component<ScreenLoaderProps, ScreenLoaderState> {
  override state: ScreenLoaderState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Pick<ScreenLoaderState, 'failed'> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ScreenLoaderProps,
    state: ScreenLoaderState,
  ): ScreenLoaderState | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override render() {
    if (!this.state.failed) {
      return (
        <Suspense fallback={<RowsSkeleton label="Cargando la pantalla…" rows={3} />}>
          {this.props.children}
        </Suspense>
      );
    }
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-4 rounded-lg border border-border/45 bg-surface-raised p-4 shadow-sm"
      >
        <div className="flex min-w-0 flex-col">
          <p className="text-lg font-semibold leading-7 text-fg">No se pudo abrir esta pantalla</p>
          <p className="text-sm text-fg-muted">
            Puede ser la conexión o una versión nueva de la aplicación. Recargarla suele arreglarlo.
          </p>
        </div>
        <Button
          onClick={
            this.props.onReload ??
            (() => {
              window.location.reload();
            })
          }
        >
          Recargar la aplicación
        </Button>
      </div>
    );
  }
}

import { summarizeCopy } from '../../domain/model/copy-summary';
import { Button } from '../components/Button';
import { StatusCard } from '../components/StatusCard';
import { useReadCopy } from './ReadCopyProvider';

/**
 * Dice que catalogo guarda este equipo para vender sin conexion y de cuando es (C3-10): cuantos productos, a que hora se leyeron el
 * catalogo y la existencia, y por que no se pudo actualizar si no se pudo. Un fallo no borra lo que ya habia: se sigue con esa copia.
 * Es una region `status`: un lector de pantalla anuncia cada cambio por su cuenta.
 */
export function CopyStatus() {
  const { state, refresh } = useReadCopy();
  const summary = summarizeCopy(state);

  return (
    <StatusCard tone={summary.tone} headline={summary.headline} detail={summary.detail}>
      {summary.canRefresh && <Button onClick={refresh}>Actualizar</Button>}
    </StatusCard>
  );
}

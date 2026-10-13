import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaAltas } from '@/features/tramites/AltaDeConcesion/components/BandejaAltas'
import { SolicitudesNumeroPanel } from '../components/SolicitudesNumeroPanel'

/**
 * Bandeja de Catastro: altas de concesión en la oficina (en carga, en corrección o en el cierre),
 * pedidos de número de concesión y expedientes que vuelven para el cierre.
 */
export default function BandejaCatastroPage() {
  return (
    <BandejaOficina oficina="catastro">
      <BandejaAltas oficina="catastro" />
      <BandejaRegistrosPozo oficina="catastro" />
      <SolicitudesNumeroPanel />
    </BandejaOficina>
  )
}

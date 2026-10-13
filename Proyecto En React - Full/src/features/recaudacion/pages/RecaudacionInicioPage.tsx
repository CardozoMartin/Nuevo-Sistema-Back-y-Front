import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaAltas } from '@/features/tramites/AltaDeConcesion/components/BandejaAltas'

/** Bandeja de la oficina. Las acciones propias de la oficina se agregarán acá. */
export default function RecaudacionInicioPage() {
  return (
    <BandejaOficina oficina="recaudacion">
      <BandejaAltas oficina="recaudacion" />
      <BandejaRegistrosPozo oficina="recaudacion" />
    </BandejaOficina>
  )
}

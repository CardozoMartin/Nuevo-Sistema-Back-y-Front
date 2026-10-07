import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { SolicitudesNumeroPanel } from '../components/SolicitudesNumeroPanel'

/** Bandeja de Catastro: pedidos de número de concesión + expedientes que vuelven para el cierre. */
export default function BandejaCatastroPage() {
  return (
    <BandejaOficina oficina="catastro">
      <SolicitudesNumeroPanel />
    </BandejaOficina>
  )
}

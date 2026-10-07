import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { AvisosDistrito } from '@/features/pozo/BajaDePozo/components/AvisosDistrito'

/** Bandeja de la oficina: expedientes del circuito y bajas de pozo para tomar conocimiento. */
export default function DistritoInicioPage() {
  return (
    <BandejaOficina oficina="distrito">
      <AvisosDistrito />
    </BandejaOficina>
  )
}

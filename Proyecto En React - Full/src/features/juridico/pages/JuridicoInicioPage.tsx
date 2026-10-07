import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaBajasPozo } from '@/features/pozo/BajaDePozo/components/BandejaBajasPozo'
import { EmpresasPendientesPanel } from '@/features/pozo/EmpresasPerforadoras/components/EmpresasPendientesPanel'

/** Bandeja de la oficina: expedientes del circuito y altas de empresas perforadoras y bajas de pozo para dictaminar. */
export default function JuridicoInicioPage() {
  return (
    <BandejaOficina oficina="juridico">
      <BandejaBajasPozo oficina="juridico" />
      <EmpresasPendientesPanel oficina="juridico" />
    </BandejaOficina>
  )
}

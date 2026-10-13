import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaAltas } from '@/features/tramites/AltaDeConcesion/components/BandejaAltas'
import { BandejaBajasPozo } from '@/features/pozo/BajaDePozo/components/BandejaBajasPozo'
import { EmpresasPendientesPanel } from '@/features/pozo/EmpresasPerforadoras/components/EmpresasPendientesPanel'

/** Bandeja de la oficina: expedientes del circuito, altas de concesión, empresas perforadoras y bajas de pozo pendientes de resolución. */
export default function SecretariaGeneralInicioPage() {
  return (
    <BandejaOficina oficina="secretaria_general">
      <BandejaAltas oficina="secretaria_general" />
      <BandejaRegistrosPozo oficina="secretaria_general" />
      <BandejaBajasPozo oficina="secretaria_general" />
      <EmpresasPendientesPanel oficina="secretaria_general" />
    </BandejaOficina>
  )
}

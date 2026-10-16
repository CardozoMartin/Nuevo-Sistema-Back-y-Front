import { ROUTES } from '@/config/routes'
import { RUTA_TRAMITE } from '@/config/tramites'
import { ActionCard } from '@/components/ui/ActionCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDominio } from '@/hooks/useDominio'

export default function TramitesPage() {
  const { tramites } = useDominio()
  return (
    <>
      <PageHeader
        title="Trámites disponibles"
        description="Seleccione el tipo de trámite que desea iniciar. Toda la documentación presentada tendrá carácter de declaración jurada."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <ActionCard
          to={ROUTES.catastro.pendientes}
          icon="assignment_late"
          title="Seguimiento de expedientes"
          description="Todos los expedientes del circuito y en qué oficina está cada uno."
          cta="Ver seguimiento"
        />
      </div>

      {/* Los trámites salen de /tramites; cada uno lleva a su pantalla (RUTA_TRAMITE). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tramites
          .filter((t) => RUTA_TRAMITE[t.id])
          .map((t) => (
            <ActionCard key={t.id} to={RUTA_TRAMITE[t.id]} icon={t.icono} title={t.nombre} description={t.descripcion} cta="Iniciar trámite" />
          ))}
      </div>
    </>
  )
}

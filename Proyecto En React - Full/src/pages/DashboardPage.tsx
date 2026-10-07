import { NAVIGATION } from '@/config/navigation'
import { ActionCard } from '@/components/ui/ActionCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDominio } from '@/hooks/useDominio'

// Descripción de módulos que todavía no están en la API.
const DESCRIPCION_MODULO: Record<string, string> = {
  pozo: 'Autorización, registro y seguimiento de pozos.',
}

const accesos = NAVIGATION.filter((s) => s.key === 'oficinas' || s.key === 'modulos').flatMap((s) => s.items)

export default function DashboardPage() {
  const { oficina } = useDominio()
  return (
    <>
      <PageHeader
        title="Bienvenido al Sistema Integral DRH"
        description="Accedé a las oficinas y gestioná los trámites de la Dirección de Recursos Hídricos desde un solo lugar."
      />
      {/* Fase 4: KPIs, últimos trámites y alertas de vencimiento */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accesos.map((item) => {
          // Las oficinas toman nombre y descripción de /oficinas.
          const info = item.bandejaDe ? oficina(item.bandejaDe) : undefined
          const oficinaDelGrupo = item.children?.find((c) => c.bandejaDe)?.bandejaDe
          const infoGrupo = oficinaDelGrupo ? oficina(oficinaDelGrupo) : undefined
          const datos = info ?? infoGrupo
          return (
            <ActionCard
              key={item.key}
              to={item.children?.[0]?.path ?? item.path}
              icon={item.icon}
              title={datos?.nombre ?? item.label}
              description={datos?.descripcion ?? DESCRIPCION_MODULO[item.key] ?? ''}
            />
          )
        })}
      </div>
    </>
  )
}

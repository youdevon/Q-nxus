import { PageHeader } from "@/src/components/layout/page-header"
import { PageShell } from "@/src/components/layout/page-shell"
import { PageAlert } from "@/src/components/ui/page-alert"

type ModulePlaceholderProps = {
  title: string
  moduleName: string
  description: string
}

export function ModulePlaceholder({
  title,
  moduleName,
  description,
}: ModulePlaceholderProps) {
  return (
    <PageShell size="lg">
      <PageHeader title={title} description={description} />
      <PageAlert severity="warning" title={`${moduleName} module not implemented`}>
        This route is reserved for the {moduleName} module. Functionality will
        be added without changing the shared application shell.
      </PageAlert>
    </PageShell>
  )
}

import { PageHeader } from "@/src/components/layout/page-header"
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader title={title} description={description} />
      <PageAlert severity="warning" title={`${moduleName} module not implemented`}>
        This route is reserved for the {moduleName} module. Functionality will
        be added without changing the shared application shell.
      </PageAlert>
    </div>
  )
}

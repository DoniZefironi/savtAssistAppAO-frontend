import { ProjectPage } from '@/components/projects/project-page'

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  return (
    <ProjectPage
      projectId={Number(id)}
      isAdmin
      backHref="/admin/cabinets"
      startEditing={edit === '1'}
    />
  )
}

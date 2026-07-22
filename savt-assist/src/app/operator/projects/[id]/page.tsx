import { ProjectPage } from '@/components/projects/project-page'

export default async function OperatorProjectDetailPage({
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
      isAdmin={false}
      backHref="/operator/cabinets"
      startEditing={edit === '1'}
    />
  )
}

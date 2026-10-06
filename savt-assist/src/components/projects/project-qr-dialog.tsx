'use client'

import { QrDialog } from '@/components/ui/qr-dialog'
import { projectsApi } from '@/lib/api/projects'
import type { Project } from '@/types'

interface Props {
  project: Project | null
  onClose: () => void
}

export function ProjectQrDialog({ project, onClose }: Props) {
  return (
    <QrDialog
      open={project !== null}
      onClose={onClose}
      title="QR-код проекта"
      name={project?.name}
      fileName={`qr-project-${project?.name ?? ''}.png`}
      queryKey={['qr', 'project', project?.id]}
      load={() => projectsApi.getQr(project!.id)}
    />
  )
}

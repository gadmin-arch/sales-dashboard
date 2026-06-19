'use client'

interface ProjectStatusBadgeProps {
  status: 'in-progress' | 'completed' | 'pending'
}

const projectStatusStyles = {
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
}

const projectStatusLabels = {
  'in-progress': 'In Progress',
  completed: 'Completed',
  pending: 'Pending',
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <span className={`inline-flex font-medium rounded-full px-3 py-1 text-xs ${projectStatusStyles[status]}`}>
      {projectStatusLabels[status]}
    </span>
  )
}
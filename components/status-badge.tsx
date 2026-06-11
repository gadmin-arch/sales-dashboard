'use client'

interface StatusBadgeProps {
  status: 'paid' | 'due' | 'overdue' | 'pending' | 'in-progress' | 'completed'
  size?: 'sm' | 'md'
}

const statusStyles = {
  paid: 'bg-green-100 text-green-800',
  due: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  'in-progress': 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
}

const statusLabels = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <span className={`inline-flex font-medium rounded-full ${statusStyles[status]} ${sizeClasses}`}>
      {statusLabels[status]}
    </span>
  )
}

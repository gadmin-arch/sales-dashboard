import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

export const DonutChart = dynamic(
  () => import('./donut-chart-base').then((mod) => mod.DonutChartBase),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full rounded-xl" />
  }
)

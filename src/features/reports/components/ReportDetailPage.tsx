import { useParams } from 'react-router-dom'
import { ReportsPage } from './ReportsPage'
import type { AdminReportType } from '../types/report.types'

const reportKeyMap: Record<string, AdminReportType> = {
  'order-lifecycle': 'ORDER_LIFECYCLE',
  'vendor-performance': 'VENDOR_PERFORMANCE',
  payments: 'PAYMENTS',
  payouts: 'PAYOUTS',
  refunds: 'REFUNDS',
}

export function ReportDetailPage() {
  const { reportKey } = useParams()
  const initialReportType = reportKey ? reportKeyMap[reportKey] : undefined
  const reportType = initialReportType ?? 'ORDER_LIFECYCLE'

  return <ReportsPage initialReportType={reportType} key={reportType} />
}

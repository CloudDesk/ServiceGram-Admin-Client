import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import {
  formatDateSafe,
  formatPaise,
  getModerationStatusTone,
  humanizeCode,
} from '../servicePresenters'
import { serviceService } from '../services/service.service'
import type { AdminService, AdminServicesQueryParams } from '../types/service.types'
import {
  ServiceActionModal,
  type ServiceActionFormValues,
  type ServiceActionKind,
  type ServiceActionSelection,
} from './ServiceActionModal'

const SERVICE_LIST_STORAGE_KEY = 'servicegram.services.pending.v1'
const DEFAULT_PAGE_SIZE = 50

function badgeTone(tone: ReturnType<typeof getModerationStatusTone>) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

function priceLabel(service: AdminService) {
  const { pricing } = service

  if (pricing.priceType === 'INSPECTION_REQUIRED') {
    return 'Set at inspection'
  }

  if (pricing.priceType === 'RANGE' && pricing.minPricePaise !== null) {
    return `${formatPaise(pricing.minPricePaise)} – ${formatPaise(pricing.maxPricePaise)}`
  }

  if (pricing.priceType === 'STARTING_FROM') {
    return `From ${formatPaise(pricing.basePricePaise)}`
  }

  return formatPaise(pricing.basePricePaise)
}

interface RowActionsProps {
  canModerate: boolean
  service: AdminService
  onAction: (kind: ServiceActionKind, service: AdminService) => void
}

function RowActions({ canModerate, onAction, service }: RowActionsProps) {
  if (!canModerate) return null

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
        size="xs"
        type="button"
        variant="primary"
        onClick={() => onAction('APPROVE', service)}
      >
        Approve
      </Button>
      <Button
        className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
        size="xs"
        type="button"
        variant="danger"
        onClick={() => onAction('REJECT', service)}
      >
        Reject
      </Button>
    </div>
  )
}

export function ServicesPage() {
  const queryClient = useQueryClient()
  const canModerateServices = usePermission('vendor_services:moderate')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<ServiceActionSelection | null>(null)

  const query = useMemo<AdminServicesQueryParams>(
    () => ({ page, limit, search: search.trim() || undefined }),
    [limit, page, search],
  )

  const servicesQuery = useQuery({
    queryKey: ['services', 'pending', query],
    queryFn: () => serviceService.getPendingServices(query),
  })

  const services = useMemo(
    () => servicesQuery.data?.data ?? [],
    [servicesQuery.data],
  )
  const pagination = servicesQuery.data?.pagination

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: ServiceActionSelection
      values: ServiceActionFormValues
    }) => {
      if (action.kind === 'APPROVE') {
        return serviceService.approveService(action.service.serviceId, {
          reason: values.reason,
        })
      }

      if (!values.reason) {
        throw new Error('Reason is required for this decision.')
      }

      return serviceService.rejectService(action.service.serviceId, {
        reason: values.reason,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['services'] })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Service action failed.',
      )
    },
  })

  const columns: DataListColumn<AdminService>[] = useMemo(
    () => [
      {
        id: 'service',
        label: 'Service',
        defaultWidth: 220,
        minWidth: 180,
        priority: 1,
        grow: true,
        locked: true,
        render: (service) => (
          <span className="truncate font-medium text-foreground">
            {service.serviceName}
          </span>
        ),
      },
      {
        id: 'moderation',
        label: 'Moderation',
        defaultWidth: 130,
        minWidth: 110,
        priority: 1,
        render: (service) => (
          <Badge tone={badgeTone(getModerationStatusTone(service.moderation.status))}>
            {humanizeCode(service.moderation.status)}
          </Badge>
        ),
      },
      {
        id: 'vendor',
        label: 'Vendor',
        defaultWidth: 170,
        minWidth: 130,
        priority: 2,
        render: (service) => (
          <span className="truncate text-muted">{service.vendor.shopName}</span>
        ),
      },
      {
        id: 'category',
        label: 'Category',
        defaultWidth: 140,
        minWidth: 110,
        priority: 2,
        render: (service) => (
          <span className="truncate text-muted">
            {service.category?.name ?? '—'}
          </span>
        ),
      },
      {
        id: 'price',
        label: 'Price',
        defaultWidth: 140,
        minWidth: 110,
        priority: 2,
        render: (service) => (
          <span className="truncate tabular-nums text-foreground">
            {priceLabel(service)}
          </span>
        ),
      },
      {
        id: 'city',
        label: 'City',
        defaultWidth: 110,
        minWidth: 96,
        priority: 3,
        defaultHidden: true,
        render: (service) => (
          <span className="truncate text-muted">{service.vendor.city ?? '—'}</span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Submitted',
        defaultWidth: 110,
        minWidth: 96,
        priority: 3,
        render: (service) => (
          <span className="text-muted">{formatDateSafe(service.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh services"
            className="h-9"
            disabled={servicesQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void servicesQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                servicesQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Service moderation"
      />

      <DataList
        columns={columns}
        emptyHint="Nothing is waiting for review right now."
        emptyMessage="No services pending review"
        errorMessage="Could not load services."
        getRowId={(service) => service.serviceId}
        isError={servicesQuery.isError}
        isLoading={servicesQuery.isLoading}
        pagination={{
          page,
          pageSize: limit,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        rowActions={(service) => (
          <RowActions
            canModerate={canModerateServices}
            service={service}
            onAction={(kind, target) => {
              setActionError(null)
              setSelectedAction({ kind, service: target })
            }}
          />
        )}
        rowActionsWidth={150}
        rows={services}
        search={search}
        searchPlaceholder="Search service name, vendor…"
        storageKey={SERVICE_LIST_STORAGE_KEY}
        onRetry={() => void servicesQuery.refetch()}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {selectedAction ? (
        <ServiceActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedAction(null)
              setActionError(null)
            }
          }}
          onSubmit={(values) =>
            void actionMutation.mutateAsync({ action: selectedAction, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}

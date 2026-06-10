import { CheckCircle2, FileCheck2, FileWarning, MessageSquarePlus, PauseCircle, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { vendorService } from '../services/vendor.service'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
  type VendorActionSelection,
} from './VendorActionModal'
import type {
  VendorDetail,
  VendorDocument,
  VendorReviewTimelineItem,
  VendorStatus,
  VendorOnboardingStatus,
} from '../types/vendor.types'

const documentColumns: DynamicTableColumn<VendorDocument>[] = [
  {
    key: 'documentType',
    label: 'Document',
    minWidth: 220,
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) => (value === 'VERIFIED' ? 'success' : 'warning'),
    minWidth: 140,
  },
  {
    key: 'verifiedAt',
    label: 'Verified',
    format: 'date',
    minWidth: 180,
    placeholder: 'Not verified',
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

const timelineColumns: DynamicTableColumn<VendorReviewTimelineItem>[] = [
  {
    key: 'actionCode',
    label: 'Action',
    minWidth: 180,
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 260,
    placeholder: 'No reason recorded',
  },
  {
    key: 'createdAt',
    label: 'Created',
    format: 'date',
    minWidth: 180,
  },
]

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p>
    </div>
  )
}

function getVendorStatusTone(status: VendorStatus) {
  if (status === 'ACTIVE') {
    return 'success'
  }

  if (status === 'SUSPENDED') {
    return 'danger'
  }

  if (status === 'PENDING') {
    return 'warning'
  }

  return 'neutral'
}

function getOnboardingStatusTone(status: VendorOnboardingStatus) {
  if (status === 'APPROVED') {
    return 'success'
  }

  if (status === 'REJECTED') {
    return 'danger'
  }

  if (status === 'DOCUMENTS_PENDING') {
    return 'warning'
  }

  return 'info'
}

function VendorHeaderStatus({ vendor }: { vendor: VendorDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
        {vendor.vendorStatus}
      </Badge>
      <Badge tone={getOnboardingStatusTone(vendor.onboardingStatus)}>
        {vendor.onboardingStatus}
      </Badge>
    </div>
  )
}

function VendorHeaderActions({
  isSubmitting,
  onSelectAction,
  vendor,
}: {
  isSubmitting: boolean
  onSelectAction: (kind: VendorActionKind) => void
  vendor: VendorDetail
}) {
  const hasAction = (action: string) => vendor.availableActions.includes(action)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {hasAction('APPROVE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          onClick={() => onSelectAction('APPROVE')}
        >
          <CheckCircle2 className="mr-2 size-4" />
          Approve
        </Button>
      ) : null}
      {hasAction('REJECT') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('REJECT')}
        >
          <XCircle className="mr-2 size-4" />
          Reject
        </Button>
      ) : null}
      {hasAction('REQUEST_DOCUMENTS') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('REQUEST_DOCUMENTS')}
        >
          <FileWarning className="mr-2 size-4" />
          Request Documents
        </Button>
      ) : null}
      {hasAction('SUSPEND') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('SUSPEND')}
        >
          <PauseCircle className="mr-2 size-4" />
          Suspend
        </Button>
      ) : null}
      {hasAction('REACTIVATE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('REACTIVATE')}
        >
          <RotateCcw className="mr-2 size-4" />
          Reactivate
        </Button>
      ) : null}
      <Button
        disabled={isSubmitting}
        size="sm"
        variant="secondary"
        onClick={() => onSelectAction('ADD_NOTE')}
      >
        <MessageSquarePlus className="mr-2 size-4" />
        Add Note
      </Button>
    </div>
  )
}

export function VendorDetailPage() {
  const { vendorId } = useParams()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<VendorActionSelection | null>(null)

  const vendorQuery = useQuery({
    enabled: Boolean(vendorId),
    queryKey: ['vendor-detail', vendorId],
    queryFn: () => vendorService.getVendorById(vendorId as string),
  })

  const vendor = vendorQuery.data?.data

  const refreshVendor = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendor-detail', vendorId] }),
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    ])
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: VendorActionSelection
      values: VendorActionFormValues
    }) => {
      if (!vendor) {
        throw new Error('Vendor details are unavailable.')
      }

      if (action.kind === 'APPROVE') {
        return vendorService.approveVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT') {
        if (!values.reason) {
          throw new Error('Rejection reason is required.')
        }

        return vendorService.rejectVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REQUEST_DOCUMENTS') {
        if (!values.reason) {
          throw new Error('Document request reason is required.')
        }

        return vendorService.requestVendorDocuments(vendor.vendorId, {
          reason: values.reason,
          requestedDocumentTypes: values.requestedDocumentTypes,
        })
      }

      if (action.kind === 'SUSPEND') {
        if (!values.reason) {
          throw new Error('Suspension reason is required.')
        }

        return vendorService.suspendVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REACTIVATE') {
        if (!values.reason) {
          throw new Error('Reactivation reason is required.')
        }

        return vendorService.reactivateVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) {
          throw new Error('Internal note is required.')
        }

        return vendorService.addVendorNote(vendor.vendorId, {
          note: values.note,
        })
      }

      if (!action.document) {
        throw new Error('Document details are unavailable.')
      }

      return vendorService.verifyVendorDocument(
        vendor.vendorId,
        action.document.documentId,
        { reason: values.reason },
      )
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void refreshVendor()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Vendor action failed.',
      )
    },
  })

  const openAction = (kind: VendorActionKind, document?: VendorDocument) => {
    setActionError(null)
    setSelectedAction({ kind, document })
  }

  const submitAction = (values: VendorActionFormValues) => {
    if (!selectedAction) {
      return
    }

    void actionMutation.mutateAsync({
      action: selectedAction,
      values,
    })
  }

  if (!vendorId) {
    return (
      <PageContainer>
        <ErrorState
          description="The vendor route is missing a vendor id."
          title="Vendor not found"
        />
      </PageContainer>
    )
  }

  if (vendorQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    )
  }

  if (vendorQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this vendor. Please retry."
          title="Vendor unavailable"
          onRetry={() => void vendorQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!vendor) {
    return (
      <PageContainer>
        <EmptyState
          description="The vendor detail API returned no vendor data."
          title="Vendor not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <VendorHeaderActions
            isSubmitting={actionMutation.isPending}
            vendor={vendor}
            onSelectAction={openAction}
          />
        }
        description={vendor.publicVendorId}
        listHref={routePaths.vendors}
        listLabel="Vendors"
        recordName={vendor.shopName}
        titleMetaNode={<VendorHeaderStatus vendor={vendor} />}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Vendor Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Owner" value={vendor.ownerName} />
            <DetailField label="Mobile" value={vendor.mobileNumber} />
            <DetailField label="Vendor ID" value={vendor.vendorId} />
            <DetailField label="Public Vendor ID" value={vendor.publicVendorId} />
            <DetailField label="Category" value={vendor.category?.name} />
            <DetailField label="Category ID" value={vendor.category?.categoryId} />
            <DetailField label="Category Code" value={vendor.category?.categoryCode} />
            <DetailField label="Referral ID" value={vendor.referralId} />
            <DetailField label="Review Notes" value={vendor.reviewNotes} />
            <DetailField label="Rejection Reason" value={vendor.rejectionReason} />
            <DetailField
              label="Document Summary"
              value={
                vendor.documentSummary
                  ? `${vendor.documentSummary.verified}/${vendor.documentSummary.total} verified`
                  : null
              }
            />
            <DetailField
              label="Warnings"
              value={vendor.warnings.length ? vendor.warnings.join(', ') : null}
            />
            <DetailField
              label="Available Actions"
              value={
                vendor.availableActions.length
                  ? vendor.availableActions.join(', ')
                  : null
              }
            />
            <DetailField label="Verified At" value={vendor.verifiedAt} />
            <DetailField label="Suspended At" value={vendor.suspendedAt} />
            <DetailField label="Suspension Reason" value={vendor.suspensionReason} />
            <DetailField label="Created At" value={vendor.createdAt} />
            <DetailField label="Updated At" value={vendor.updatedAt} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Address</h2>
          <DetailField label="Address Line 1" value={vendor.address.addressLine1} />
          <DetailField label="Address Line 2" value={vendor.address.addressLine2} />
          <DetailField label="City" value={vendor.address.city} />
          <DetailField label="Zone" value={vendor.address.zone?.zoneName} />
          <DetailField label="Pincode" value={vendor.address.pincode} />
          <DetailField label="Latitude" value={vendor.address.latitude} />
          <DetailField label="Longitude" value={vendor.address.longitude} />
        </div>
      </section>

      <section className="space-y-4">
        <DynamicTable
          actionColumnLabel="Document Actions"
          bodyMaxHeight={360}
          columns={documentColumns}
          data={vendor.documents}
          emptyDescription="This vendor has no uploaded documents."
          emptyTitle="No documents"
          getRowId={(row) => row.documentId}
          rowActions={(document) => [
            {
              icon: <FileCheck2 className="size-4" />,
              isVisible:
                vendor.onboardingStatus !== 'APPROVED' &&
                document.status !== 'VERIFIED',
              key: 'verify',
              label: 'Verify',
              onClick: () => openAction('VERIFY_DOCUMENT', document),
              variant: 'secondary',
            },
          ]}
          title="Documents"
        />

        <DynamicTable
          bodyMaxHeight={360}
          columns={timelineColumns}
          data={vendor.reviewTimeline}
          emptyDescription="No review events have been recorded."
          emptyTitle="No review timeline"
          getRowId={(row) => row.reviewEventId}
          title="Review Timeline"
        />
      </section>

      <VendorActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${selectedAction.document?.documentId ?? 'vendor'}`
            : 'closed'
        }
        vendor={vendor}
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={submitAction}
      />
    </PageContainer>
  )
}

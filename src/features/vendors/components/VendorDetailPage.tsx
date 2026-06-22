import { CheckCircle2, Eye, FileCheck2, FileWarning, History, Landmark, MessageSquarePlus, PauseCircle, RotateCcw, XCircle } from 'lucide-react'
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
import { useAuthStore } from '../../../store/authStore'
import { vendorService } from '../services/vendor.service'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
  type VendorActionSelection,
} from './VendorActionModal'
import type {
  VendorDetail,
  VendorBankAccount,
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
    statusTone: (value) =>
      value === 'VERIFIED'
        ? 'success'
        : value === 'REJECTED'
          ? 'danger'
          : 'warning',
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

const bankAccountColumns: DynamicTableColumn<VendorBankAccount>[] = [
  {
    key: 'account',
    label: 'Account',
    minWidth: 260,
    renderCell: (account) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{account.bankName}</p>
          {account.isPrimary ? <Badge tone="info">Primary</Badge> : null}
        </div>
        <p className="text-xs text-muted">{account.accountNumberMasked}</p>
      </div>
    ),
  },
  {
    key: 'accountHolderName',
    label: 'Holder',
    minWidth: 180,
  },
  {
    key: 'ifscCode',
    label: 'IFSC',
    minWidth: 140,
  },
  {
    key: 'upiId',
    label: 'UPI',
    minWidth: 180,
    placeholder: 'Not linked',
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) =>
      value === 'VERIFIED'
        ? 'success'
        : value === 'REJECTED' || value === 'DISABLED'
          ? 'danger'
          : 'warning',
    minWidth: 190,
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

interface VendorDocumentHistoryRow {
  reviewEventId: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  reason: string | null
  createdAt: string
}

const documentHistoryColumns: DynamicTableColumn<VendorDocumentHistoryRow>[] = [
  {
    key: 'action',
    label: 'Action',
    minWidth: 220,
  },
  {
    key: 'fromStatus',
    label: 'From',
    minWidth: 120,
    placeholder: '—',
  },
  {
    key: 'toStatus',
    label: 'To',
    minWidth: 120,
    placeholder: '—',
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 280,
    placeholder: 'No reason recorded',
  },
  {
    key: 'createdAt',
    label: 'When',
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

function openDocumentDownload(document: VendorDocument) {
  const downloadUrl = document.download?.downloadUrl

  if (!downloadUrl) {
    return
  }

  window.open(downloadUrl, '_blank', 'noopener,noreferrer')
}

function getApprovalBlockMessage(vendor: VendorDetail) {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) {
    return 'Approval is blocked until the vendor uploads the required documents.'
  }

  const unverifiedBySummary = Math.max(summary.total - summary.verified, 0)
  const unverifiedDocuments = vendor.documents.filter(
    (document) => document.status !== 'VERIFIED',
  )
  const unverifiedCount = Math.max(
    unverifiedBySummary,
    unverifiedDocuments.length,
  )

  if (unverifiedCount === 0) {
    return null
  }

  const documentLabel = unverifiedCount === 1 ? 'document is' : 'documents are'

  return `Approval is blocked until ${unverifiedCount} ${documentLabel} verified. Verify the documents or request corrections before approving this vendor.`
}

function getBankSummaryMessage(vendor: VendorDetail) {
  const summary = vendor.bankAccountSummary

  if (!summary.hasPrimary) {
    return 'No primary payout bank account has been submitted by this vendor.'
  }

  if (summary.payoutReady) {
    return `Primary payout account is verified: ${summary.primaryBankName ?? 'Bank'} ${summary.primaryAccountNumberMasked ?? ''}`.trim()
  }

  if (summary.primaryStatus === 'REJECTED') {
    return 'Primary payout account was rejected. The vendor needs to submit corrected details.'
  }

  return 'Primary payout account is waiting for admin verification.'
}

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key]

  return typeof value === 'string' ? value : null
}

function getDocumentHistoryActionLabel(actionCode: string) {
  switch (actionCode) {
    case 'reject_document':
      return 'Admin requested resubmission'
    case 'document_upload_confirm':
      return 'Vendor resubmitted document'
    case 'verify_document':
      return 'Admin verified document'
    case 'request_documents':
      return 'Admin requested documents'
    default:
      return actionCode
  }
}

function getDocumentHistoryRows(
  vendor: VendorDetail,
  document: VendorDocument | null,
): VendorDocumentHistoryRow[] {
  if (!document) {
    return []
  }

  return vendor.reviewTimeline
    .filter((event) => {
      const documentId = getMetadataString(event.metadata, 'documentId')
      const documentType = getMetadataString(event.metadata, 'documentType')
      const requestedDocumentTypes = event.metadata?.requestedDocumentTypes

      if (documentId) {
        return documentId === document.documentId
      }

      if (documentType) {
        return documentType === document.documentType
      }

      return Array.isArray(requestedDocumentTypes)
        ? requestedDocumentTypes.includes(document.documentType)
        : false
    })
    .map((event) => ({
      reviewEventId: event.reviewEventId,
      action: getDocumentHistoryActionLabel(event.actionCode),
      fromStatus: getMetadataString(event.metadata, 'fromDocumentStatus'),
      toStatus: getMetadataString(event.metadata, 'toDocumentStatus'),
      reason: event.reason,
      createdAt: event.createdAt,
    }))
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
  const approvalBlockMessage = getApprovalBlockMessage(vendor)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {hasAction('APPROVE') ? (
        <Button
          disabled={isSubmitting || Boolean(approvalBlockMessage)}
          size="sm"
          title={approvalBlockMessage ?? undefined}
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

interface VendorDetailPageProps {
  listHref?: string
  listLabel?: string
}

export function VendorDetailPage({
  listHref = routePaths.vendors,
  listLabel = 'Vendors',
}: VendorDetailPageProps = {}) {
  const { vendorId } = useParams()
  const queryClient = useQueryClient()
  const canApproveVendors = useAuthStore((state) => state.can('vendors:approve'))
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<VendorActionSelection | null>(null)
  const [selectedHistoryDocument, setSelectedHistoryDocument] =
    useState<VendorDocument | null>(null)

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
      queryClient.invalidateQueries({ queryKey: ['vendor-onboarding'] }),
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
        const approvalBlockMessage = getApprovalBlockMessage(vendor)

        if (approvalBlockMessage) {
          throw new Error(approvalBlockMessage)
        }

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

      if (action.kind === 'REJECT_DOCUMENT') {
        if (!action.document) {
          throw new Error('Document details are unavailable.')
        }

        if (!values.reason) {
          throw new Error('Resubmission reason is required.')
        }

        return vendorService.rejectVendorDocument(
          vendor.vendorId,
          action.document.documentId,
          { reason: values.reason },
        )
      }

      if (action.kind === 'VERIFY_BANK_ACCOUNT') {
        if (!action.bankAccount) {
          throw new Error('Bank account details are unavailable.')
        }

        return vendorService.verifyVendorBankAccount(
          vendor.vendorId,
          action.bankAccount.bankAccountId,
          { reason: values.reason },
        )
      }

      if (action.kind === 'REJECT_BANK_ACCOUNT') {
        if (!action.bankAccount) {
          throw new Error('Bank account details are unavailable.')
        }

        if (!values.reason) {
          throw new Error('Bank account rejection reason is required.')
        }

        return vendorService.rejectVendorBankAccount(
          vendor.vendorId,
          action.bankAccount.bankAccountId,
          { reason: values.reason },
        )
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

  const openAction = (
    kind: VendorActionKind,
    document?: VendorDocument,
    bankAccount?: VendorBankAccount,
  ) => {
    setActionError(null)
    setSelectedAction({ kind, document, bankAccount })
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

  const approvalBlockMessage = vendor.availableActions.includes('APPROVE')
    ? getApprovalBlockMessage(vendor)
    : null
  const activeHistoryDocument = selectedHistoryDocument
    ? vendor.documents.find(
        (document) =>
          document.documentId === selectedHistoryDocument.documentId,
      ) ?? selectedHistoryDocument
    : null
  const selectedDocumentHistory = getDocumentHistoryRows(
    vendor,
    activeHistoryDocument,
  )

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
        listHref={listHref}
        listLabel={listLabel}
        recordName={vendor.shopName}
        titleMetaNode={<VendorHeaderStatus vendor={vendor} />}
      />

      {approvalBlockMessage ? (
        <div className="flex items-start gap-2 rounded-surface border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
          <FileWarning className="mt-0.5 size-4 shrink-0" />
          <span>{approvalBlockMessage}</span>
        </div>
      ) : null}

      <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Landmark className="size-4 text-muted" />
              <h2 className="text-base font-semibold text-foreground">Payout Bank Account</h2>
              <Badge tone={vendor.bankAccountSummary.payoutReady ? 'success' : 'warning'}>
                {vendor.bankAccountSummary.payoutReady ? 'Payout Ready' : 'Review Needed'}
              </Badge>
            </div>
            <p className="text-sm text-muted">{getBankSummaryMessage(vendor)}</p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <DetailField label="Total" value={vendor.bankAccountSummary.total} />
            <DetailField label="Verified" value={vendor.bankAccountSummary.verified} />
            <DetailField label="Pending" value={vendor.bankAccountSummary.pending} />
          </div>
        </div>

        {vendor.bankAccountSummary.warnings.length ? (
          <div className="rounded-surface border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
            {vendor.bankAccountSummary.warnings.join(', ')}
          </div>
        ) : null}

        <DynamicTable
          actionColumnLabel="Bank Actions"
          actionColumnMinWidth={260}
          bodyMaxHeight={320}
          columns={bankAccountColumns}
          data={vendor.bankAccounts}
          emptyDescription="This vendor has not submitted payout bank details yet."
          emptyTitle="No bank account"
          getRowId={(row) => row.bankAccountId}
          rowActions={(bankAccount) => [
            {
              icon: <CheckCircle2 className="size-4" />,
              isVisible:
                canApproveVendors &&
                bankAccount.availableActions.includes('VERIFY'),
              key: 'verify-bank',
              label: 'Verify',
              onClick: () => openAction('VERIFY_BANK_ACCOUNT', undefined, bankAccount),
              variant: 'secondary',
            },
            {
              icon: <XCircle className="size-4" />,
              isVisible:
                canApproveVendors &&
                bankAccount.availableActions.includes('REJECT'),
              key: 'reject-bank',
              label: 'Reject',
              onClick: () => openAction('REJECT_BANK_ACCOUNT', undefined, bankAccount),
              variant: 'danger',
            },
          ]}
          title="Bank Accounts"
        />
      </section>

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
          actionColumnMinWidth={410}
          bodyMaxHeight={360}
          columns={documentColumns}
          data={vendor.documents}
          description={
            vendor.onboardingStatus === 'APPROVED'
              ? 'Approved vendor documents are locked from onboarding resubmission.'
              : 'Verified documents can still be requested for resubmission before vendor approval.'
          }
          emptyDescription="This vendor has no uploaded documents."
          emptyTitle="No documents"
          getRowId={(row) => row.documentId}
          inlineActionLimit={3}
          rowActions={(document) => [
            {
              icon: <Eye className="size-4" />,
              isDisabled: !document.download?.downloadUrl,
              key: 'view',
              label: document.download?.downloadUrl ? 'View' : 'No preview',
              onClick: openDocumentDownload,
              variant: 'ghost',
            },
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
            {
              icon: <FileWarning className="size-4" />,
              isVisible:
                vendor.onboardingStatus !== 'APPROVED' &&
                ['PENDING', 'VERIFIED'].includes(document.status),
              key: 'reject',
              label:
                document.status === 'VERIFIED'
                  ? 'Request resubmit again'
                  : 'Request resubmit',
              onClick: () => openAction('REJECT_DOCUMENT', document),
              variant: 'secondary',
            },
            {
              icon: <History className="size-4" />,
              key: 'history',
              label: 'History',
              onClick: () => setSelectedHistoryDocument(document),
              placement: 'menu',
              variant: 'ghost',
            },
          ]}
          title="Documents"
        />

        {activeHistoryDocument ? (
          <section className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    Document History
                  </h2>
                  <Badge
                    tone={
                      activeHistoryDocument.status === 'VERIFIED'
                        ? 'success'
                        : activeHistoryDocument.status === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {activeHistoryDocument.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted">
                  {activeHistoryDocument.documentType}
                </p>
              </div>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setSelectedHistoryDocument(null)}
              >
                Close
              </Button>
            </div>

            {activeHistoryDocument.rejectionReason ? (
              <div className="rounded-surface border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
                Current admin reason: {activeHistoryDocument.rejectionReason}
              </div>
            ) : null}

            <DynamicTable
              bodyMaxHeight={300}
              columns={documentHistoryColumns}
              data={selectedDocumentHistory}
              emptyDescription="No review or resubmission events have been recorded for this document yet."
              emptyTitle="No document history"
              getRowId={(row) => row.reviewEventId}
              title={`${activeHistoryDocument.documentType} history`}
            />
          </section>
        ) : null}

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
            ? `${selectedAction.kind}-${selectedAction.document?.documentId ?? selectedAction.bankAccount?.bankAccountId ?? 'vendor'}`
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

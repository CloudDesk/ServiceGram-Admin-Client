import { buildApiUrl } from '../../../config/api'
import {
  APPROVAL_ACTION_TEMPLATES_PATH,
  APPROVAL_CONDITION_FIELDS_PATH,
  APPROVAL_WORKFLOW_DETAIL_PATH,
  APPROVAL_WORKFLOW_VERSION_SIMULATE_PATH,
  APPROVAL_WORKFLOW_VERSION_VALIDATE_PATH,
  APPROVAL_WORKFLOWS_PATH,
} from '../../../config/approvalApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  ApprovalActionTemplatesResponse,
  ApprovalConditionFieldsResponse,
  ApprovalRegistryQueryParams,
  ApprovalSimulationPayload,
  ApprovalSimulationResponse,
  ApprovalValidationResponse,
  ApprovalWorkflowDetailResponse,
  ApprovalWorkflowsListResponse,
  ApprovalWorkflowsQueryParams,
} from '../types/approval.types'

interface ApprovalApiErrorEnvelope {
  message?: string
  error?: string
  code?: string
  details?: {
    fieldErrors?: {
      field: string
      message: string
    }[]
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ApprovalApiErrorEnvelope
    | null

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object'
        ? (payload as ApprovalApiErrorEnvelope)
        : null
    const fieldMessage = errorPayload?.details?.fieldErrors?.[0]?.message

    throw new Error(
      fieldMessage ??
        errorPayload?.message ??
        errorPayload?.error ??
        'Approval request failed.',
    )
  }

  return payload as T
}

function postJson<TPayload>(payload: TPayload) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

async function getWorkflows(
  query: ApprovalWorkflowsQueryParams = {},
): Promise<ApprovalWorkflowsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${APPROVAL_WORKFLOWS_PATH}?${queryString}`
        : APPROVAL_WORKFLOWS_PATH,
    ),
  )

  return parseJsonResponse<ApprovalWorkflowsListResponse>(response)
}

async function getWorkflowDetail(
  workflowId: string,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_DETAIL_PATH(workflowId)),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function getConditionFields(
  query: ApprovalRegistryQueryParams = {},
): Promise<ApprovalConditionFieldsResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${APPROVAL_CONDITION_FIELDS_PATH}?${queryString}`
        : APPROVAL_CONDITION_FIELDS_PATH,
    ),
  )

  return parseJsonResponse<ApprovalConditionFieldsResponse>(response)
}

async function getActionTemplates(
  query: Omit<ApprovalRegistryQueryParams, 'triggerEvent'> = {},
): Promise<ApprovalActionTemplatesResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${APPROVAL_ACTION_TEMPLATES_PATH}?${queryString}`
        : APPROVAL_ACTION_TEMPLATES_PATH,
    ),
  )

  return parseJsonResponse<ApprovalActionTemplatesResponse>(response)
}

async function validateWorkflowVersion(
  versionId: string,
): Promise<ApprovalValidationResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_VERSION_VALIDATE_PATH(versionId)),
    postJson({}),
  )

  return parseJsonResponse<ApprovalValidationResponse>(response)
}

async function simulateWorkflowVersion(
  versionId: string,
  payload: ApprovalSimulationPayload,
): Promise<ApprovalSimulationResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_VERSION_SIMULATE_PATH(versionId)),
    postJson(payload),
  )

  return parseJsonResponse<ApprovalSimulationResponse>(response)
}

export const approvalService = {
  getWorkflows,
  getWorkflowDetail,
  getConditionFields,
  getActionTemplates,
  validateWorkflowVersion,
  simulateWorkflowVersion,
}

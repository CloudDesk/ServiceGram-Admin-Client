import { buildApiUrl } from '../../../config/api'
import {
  APPROVAL_ACTION_TEMPLATES_PATH,
  APPROVAL_CONDITION_FIELDS_PATH,
  APPROVAL_WORKFLOW_DETAIL_PATH,
  APPROVAL_WORKFLOW_META_PATH,
  APPROVAL_WORKFLOW_VERSIONS_PATH,
  APPROVAL_WORKFLOW_VERSION_DEACTIVATE_PATH,
  APPROVAL_WORKFLOW_VERSION_DEFINITION_PATH,
  APPROVAL_WORKFLOW_VERSION_PUBLISH_PATH,
  APPROVAL_WORKFLOW_VERSION_SIMULATE_PATH,
  APPROVAL_WORKFLOW_VERSION_VALIDATE_PATH,
  APPROVAL_WORKFLOWS_PATH,
} from '../../../config/approvalApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  ApprovalActionTemplatesResponse,
  ApprovalConditionFieldsResponse,
  ApprovalErrorResponse,
  ApprovalRegistryQueryParams,
  ApprovalSimulationPayload,
  ApprovalSimulationResponse,
  ApprovalValidationResponse,
  ApprovalWorkflowDetailResponse,
  ApprovalWorkflowsListResponse,
  ApprovalWorkflowsQueryParams,
  ApprovalWorkflowDeleteResponse,
  CreateApprovalWorkflowPayload,
  CreateApprovalWorkflowVersionDraftPayload,
  DeactivateApprovalWorkflowVersionPayload,
  DeleteApprovalWorkflowPayload,
  PublishApprovalWorkflowVersionPayload,
  ReplaceApprovalWorkflowVersionDefinitionPayload,
  UpdateApprovalWorkflowMetaPayload,
} from '../types/approval.types'
import { ApprovalServiceError } from '../types/approval.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  const body = text ? (JSON.parse(text) as T | ApprovalErrorResponse) : null

  if (!response.ok) {
    const errorBody = (body ?? null) as ApprovalErrorResponse | null

    throw new ApprovalServiceError(
      errorBody?.details?.fieldErrors?.[0]?.message ??
        errorBody?.message ??
        'Approval request failed.',
      response.status,
      errorBody?.code ?? 'REQUEST_FAILED',
      errorBody,
    )
  }

  return body as T
}

function jsonRequest<TPayload>(
  method: 'DELETE' | 'PATCH' | 'POST' | 'PUT',
  payload: TPayload,
) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

function postJson<TPayload>(payload: TPayload) {
  return jsonRequest('POST', payload)
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

async function createWorkflow(
  payload: CreateApprovalWorkflowPayload,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOWS_PATH),
    postJson(payload),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function updateWorkflowMeta(
  workflowId: string,
  payload: UpdateApprovalWorkflowMetaPayload,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_META_PATH(workflowId)),
    jsonRequest('PATCH', payload),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function createDraftVersion(
  workflowId: string,
  payload: CreateApprovalWorkflowVersionDraftPayload,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_VERSIONS_PATH(workflowId)),
    postJson(payload),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function replaceVersionDefinition(
  versionId: string,
  payload: ReplaceApprovalWorkflowVersionDefinitionPayload,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_VERSION_DEFINITION_PATH(versionId)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function publishVersion(
  versionId: string,
  payload: PublishApprovalWorkflowVersionPayload,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_VERSION_PUBLISH_PATH(versionId)),
    postJson(payload),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function deactivateVersion(
  versionId: string,
  payload: DeactivateApprovalWorkflowVersionPayload,
): Promise<ApprovalWorkflowDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_VERSION_DEACTIVATE_PATH(versionId)),
    postJson(payload),
  )

  return parseJsonResponse<ApprovalWorkflowDetailResponse>(response)
}

async function deleteWorkflow(
  workflowId: string,
  payload: DeleteApprovalWorkflowPayload,
): Promise<ApprovalWorkflowDeleteResponse> {
  const response = await apiClient.request(
    buildApiUrl(APPROVAL_WORKFLOW_META_PATH(workflowId)),
    jsonRequest('DELETE', payload),
  )

  return parseJsonResponse<ApprovalWorkflowDeleteResponse>(response)
}

export const approvalService = {
  getWorkflows,
  getWorkflowDetail,
  getConditionFields,
  getActionTemplates,
  validateWorkflowVersion,
  simulateWorkflowVersion,
  createWorkflow,
  updateWorkflowMeta,
  createDraftVersion,
  replaceVersionDefinition,
  publishVersion,
  deactivateVersion,
  deleteWorkflow,
}

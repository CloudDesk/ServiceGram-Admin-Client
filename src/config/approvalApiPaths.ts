export const APPROVAL_WORKFLOWS_PATH = '/admin/approvals/workflows'

export function APPROVAL_WORKFLOW_DETAIL_PATH(workflowId: string) {
  return `/admin/approvals/workflows/${workflowId}`
}

export const APPROVAL_CONDITION_FIELDS_PATH = '/admin/approvals/condition-fields'

export const APPROVAL_ACTION_TEMPLATES_PATH = '/admin/approvals/action-templates'

export function APPROVAL_WORKFLOW_VERSION_VALIDATE_PATH(versionId: string) {
  return `/admin/approvals/versions/${versionId}/validate`
}

export function APPROVAL_WORKFLOW_VERSION_SIMULATE_PATH(versionId: string) {
  return `/admin/approvals/versions/${versionId}/simulate`
}

export function APPROVAL_WORKFLOW_META_PATH(workflowId: string) {
  return `/admin/approvals/workflows/${workflowId}`
}

export function APPROVAL_WORKFLOW_VERSIONS_PATH(workflowId: string) {
  return `/admin/approvals/workflows/${workflowId}/versions`
}

export function APPROVAL_WORKFLOW_VERSION_DEFINITION_PATH(versionId: string) {
  return `/admin/approvals/versions/${versionId}/definition`
}

export function APPROVAL_WORKFLOW_VERSION_PUBLISH_PATH(versionId: string) {
  return `/admin/approvals/versions/${versionId}/publish`
}

export function APPROVAL_WORKFLOW_VERSION_DEACTIVATE_PATH(versionId: string) {
  return `/admin/approvals/versions/${versionId}/deactivate`
}

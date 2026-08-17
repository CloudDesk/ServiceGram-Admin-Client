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

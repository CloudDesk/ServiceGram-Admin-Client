import { CheckSquare, Square } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../utils/cn'
import type { PermissionGroup } from '../types/rbac.types'

interface PermissionMatrixProps {
  disabled?: boolean
  groups: PermissionGroup[]
  selectedPermissionIds: Set<string>
  onToggle: (permissionId: string, checked: boolean) => void
}

export function PermissionMatrix({
  disabled = false,
  groups,
  onToggle,
  selectedPermissionIds,
}: PermissionMatrixProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const selectedCount = group.permissions.filter((permission) =>
          selectedPermissionIds.has(permission.permissionId),
        ).length
        const allSelected =
          group.permissions.length > 0 && selectedCount === group.permissions.length

        return (
          <section
            className="rounded-[1rem] border border-border bg-background/40 p-4"
            key={group.groupId}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h3 className="break-words text-sm font-semibold text-foreground">
                  {group.groupName}
                </h3>
                <p className="text-xs text-muted">
                  {selectedCount} of {group.permissions.length} selected
                </p>
              </div>
              {!disabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={allSelected || group.permissions.length === 0}
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      group.permissions.forEach((permission) =>
                        onToggle(permission.permissionId, true),
                      )
                    }
                  >
                    <CheckSquare className="mr-2 size-4" />
                    Select
                  </Button>
                  <Button
                    disabled={selectedCount === 0}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      group.permissions.forEach((permission) =>
                        onToggle(permission.permissionId, false),
                      )
                    }
                  >
                    <Square className="mr-2 size-4" />
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {group.permissions.map((permission) => {
                const checked = selectedPermissionIds.has(permission.permissionId)

                return (
                  <label
                    className={cn(
                      'flex min-h-16 cursor-pointer items-start gap-3 rounded-[0.9rem] border border-border bg-surface p-3 text-sm transition-colors',
                      checked && 'border-primary/40 bg-primary/5',
                      disabled && 'cursor-default opacity-70',
                    )}
                    key={permission.permissionId}
                  >
                    <input
                      checked={checked}
                      className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
                      disabled={disabled}
                      type="checkbox"
                      onChange={(event) =>
                        onToggle(permission.permissionId, event.target.checked)
                      }
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="block break-words font-medium text-foreground">
                        {permission.permissionCode}
                      </span>
                      <span className="block break-words text-xs leading-5 text-muted">
                        {permission.description ??
                          `${permission.moduleCode}:${permission.actionCode}`}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

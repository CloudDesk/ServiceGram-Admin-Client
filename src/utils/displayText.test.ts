import { describe, expect, it } from 'vitest'
import {
  codeDisplayLabel,
  humanizeIdentifier,
  permissionDisplayLabel,
  permissionRequirementLabel,
} from './displayText'

describe('displayText', () => {
  it('humanizes backend codes while preserving known acronyms', () => {
    expect(humanizeIdentifier('VENDOR_APPROVED')).toBe('Vendor approved')
    expect(humanizeIdentifier('DELIVERY_OTP')).toBe('Delivery OTP')
    expect(humanizeIdentifier('reward_sla_hours')).toBe('Reward SLA hours')
    expect(humanizeIdentifier('vendor_discount_cap_bps')).toBe(
      'Vendor discount cap BPS',
    )
  })

  it('supports title capitalization for role names', () => {
    expect(
      humanizeIdentifier('OPERATIONS_ADMIN', { capitalization: 'title' }),
    ).toBe('Operations Admin')
    expect(
      humanizeIdentifier('operations-admin', { capitalization: 'title' }),
    ).toBe('Operations Admin')
  })

  it('formats permission codes as actions', () => {
    expect(permissionDisplayLabel('admin_users:create')).toBe(
      'Create admin users',
    )
    expect(permissionDisplayLabel('orders:update_status')).toBe(
      'Update status in orders',
    )
    expect(permissionRequirementLabel('feature-flags:update')).toBe(
      'Requires permission: Manage feature flags',
    )
    expect(permissionRequirementLabel('settings:update')).toBe(
      'Requires permission: Manage settings',
    )
  })

  it('uses explicit product wording for app configuration response codes', () => {
    expect(codeDisplayLabel('APP_CONFIG_LOADED')).toBe(
      'App configuration loaded',
    )
    expect(codeDisplayLabel('APP_CONFIG_DELIVERY_UNAVAILABLE')).toBe(
      'Delivery configuration unavailable',
    )
  })
})

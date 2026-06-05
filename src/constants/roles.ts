export const roles = [
  'super-admin',
  'operations-admin',
  'marketing-admin',
  'finance-admin',
  'customer-support',
  'content-moderator',
] as const

export type Role = (typeof roles)[number]

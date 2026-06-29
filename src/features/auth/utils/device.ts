import { storageKeys } from '../../../lib/storage'

function createDeviceId() {
  if (typeof window.crypto?.randomUUID === 'function') {
    return `admin-web-${window.crypto.randomUUID()}`
  }

  return `admin-web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getAdminDeviceId() {
  try {
    const existingDeviceId = window.localStorage.getItem(storageKeys.authDeviceId)

    if (existingDeviceId) {
      return existingDeviceId
    }

    const deviceId = createDeviceId()
    window.localStorage.setItem(storageKeys.authDeviceId, deviceId)

    return deviceId
  } catch {
    return createDeviceId()
  }
}

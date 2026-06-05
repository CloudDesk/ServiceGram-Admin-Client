import { mockConfig } from './mockConfig'

export async function delay(ms = mockConfig.latencyMs) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

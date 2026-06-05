import { delay } from '../mock/delay'
import { mockConfig } from '../mock/mockConfig'
import { MockNetworkError } from '../mock/errors'

export async function mockClient<T>(resolver: () => T | Promise<T>) {
  await delay()

  if (mockConfig.simulateNetworkError) {
    throw new MockNetworkError()
  }

  return resolver()
}

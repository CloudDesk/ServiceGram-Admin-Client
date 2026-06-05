import { messages } from '../constants/messages'

export function mapApiError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return messages.unknownError
}

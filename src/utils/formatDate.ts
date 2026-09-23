import { format } from 'date-fns'
import { DATE_TIME_FORMAT, DATE_FORMAT } from '../constants/dateFormats'

export function formatDate(value: string, withTime = false) {
  return format(new Date(value), withTime ? DATE_TIME_FORMAT : DATE_FORMAT)
}

export function formatCompactDateTime(value: string) {
  return format(new Date(value), 'd MMM yyyy, h:mm a')
}

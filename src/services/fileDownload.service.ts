import { downloadFile } from '../utils/downloadFile'

export async function startFileDownload(filename: string) {
  return downloadFile(filename)
}

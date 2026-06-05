export function downloadFile(filename: string) {
  return {
    filename,
    startedAt: new Date().toISOString(),
  }
}

import type { BackupPayload } from '../storage/types';

export function formatBackupFilename(payload: BackupPayload): string {
  const rawModuleId = payload.campaign.moduleId || 'campaign';
  const safeModuleId = rawModuleId.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const datePart = (payload.exportedAt || new Date().toISOString()).slice(0, 10);
  return `${safeModuleId}_${datePart}.json`;
}

export async function deliverBackupFile(
  payload: BackupPayload
): Promise<'shared' | 'downloaded'> {
  const filename = formatBackupFilename(payload);
  const jsonText = JSON.stringify(payload, null, 2);
  const file =
    typeof File !== 'undefined'
      ? new File([jsonText], filename, { type: 'application/json' })
      : null;

  if (
    file &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
  ) {
    try {
      await navigator.share({
        files: [file],
        title: `${payload.campaign.title} Backup`,
      });
      return 'shared';
    } catch (err) {
      // If user cancelled share sheet, rethrow AbortError? Or fall back if share failed for non-abort reason
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  const blob = new Blob([jsonText], { type: 'application/json' });
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return 'downloaded';
}

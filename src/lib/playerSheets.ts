import type { PlayerSheetKind, PlayerSheetRecord, PlayerSheetTrack } from '../storage/types';

export const ALLOWED_IMAGE_SHEET_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ALLOWED_IMAGE_SHEET_EXTS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

export interface SheetUploadValidationResult {
  ok: true;
  kind: 'image' | 'pdf';
  mimeType: string;
}

export interface SheetUploadValidationError {
  ok: false;
  error: string;
}

export function validateSheetUploadFile(
  file: { name: string; type?: string },
  expectedKind?: 'image' | 'pdf'
): SheetUploadValidationResult | SheetUploadValidationError {
  const lowerName = (file.name || '').trim().toLowerCase();
  const mime = (file.type || '').trim().toLowerCase();

  const isPdf = mime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage =
    ALLOWED_IMAGE_SHEET_MIMES.has(mime) ||
    ALLOWED_IMAGE_SHEET_EXTS.some((ext) => lowerName.endsWith(ext));

  if (expectedKind === 'pdf') {
    if (!isPdf) {
      return {
        ok: false,
        error: 'Please choose a PDF file (.pdf).',
      };
    }
    return {
      ok: true,
      kind: 'pdf',
      mimeType: 'application/pdf',
    };
  }

  if (expectedKind === 'image') {
    if (!isImage) {
      return {
        ok: false,
        error: 'Please choose a PNG, JPG, or WebP image (.png, .jpg, .webp).',
      };
    }
    const inferredMime = ALLOWED_IMAGE_SHEET_MIMES.has(mime)
      ? mime
      : lowerName.endsWith('.webp')
        ? 'image/webp'
        : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'image/png';
    return {
      ok: true,
      kind: 'image',
      mimeType: inferredMime,
    };
  }

  if (isPdf) {
    return { ok: true, kind: 'pdf', mimeType: 'application/pdf' };
  }
  if (isImage) {
    const inferredMime = ALLOWED_IMAGE_SHEET_MIMES.has(mime)
      ? mime
      : lowerName.endsWith('.webp')
        ? 'image/webp'
        : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'image/png';
    return { ok: true, kind: 'image', mimeType: inferredMime };
  }

  return {
    ok: false,
    error: 'Unsupported file type. Use .pdf, .png, .jpg, or .webp.',
  };
}

export function stripFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx <= 0) return trimmed || 'Character Sheet';
  return trimmed.slice(0, dotIdx).trim() || 'Character Sheet';
}

export function createPlayerSheetId(now = Date.now()): string {
  return `pc-${now}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createPlayerSheetTrackId(now = Date.now()): string {
  return `trk-${now}-${Math.random().toString(36).slice(2, 6)}`;
}

export function clampTrackValues(current: number, max: number): { current: number; max: number } {
  const safeMax = Number.isFinite(max) ? Math.max(1, Math.round(max)) : 1;
  const safeCurrent = Number.isFinite(current)
    ? Math.max(0, Math.min(safeMax, Math.round(current)))
    : 0;
  return { current: safeCurrent, max: safeMax };
}

export function createPrebuiltPlayerSheet(input: {
  id?: string;
  name: string;
  role?: string;
  statLine?: string;
  tracks?: Array<{ id?: string; label: string; current?: number; max: number }>;
  notes?: string;
  now?: number;
}): PlayerSheetRecord {
  const now = input.now ?? Date.now();
  const name = input.name.trim() || 'Unnamed Character';
  const tracks: PlayerSheetTrack[] = (input.tracks ?? [])
    .filter((t) => t.label.trim().length > 0)
    .map((t, idx) => {
      const clamped = clampTrackValues(t.current ?? t.max, t.max);
      return {
        id: t.id?.trim() || `trk-${now}-${idx}`,
        label: t.label.trim(),
        current: clamped.current,
        max: clamped.max,
      };
    });

  return {
    id: input.id?.trim() || createPlayerSheetId(now),
    kind: 'prebuilt',
    name,
    role: input.role?.trim() ?? '',
    statLine: input.statLine?.trim() ?? '',
    tracks,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };
}

export function adjustPlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  trackId: string,
  delta: number
): PlayerSheetTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track;
    const clamped = clampTrackValues(track.current + delta, track.max);
    return {
      ...track,
      current: clamped.current,
      max: clamped.max,
    };
  });
}

export function updatePlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  trackId: string,
  patch: { label?: string; current?: number; max?: number }
): PlayerSheetTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track;
    const nextMax = patch.max !== undefined ? patch.max : track.max;
    const nextCurrent = patch.current !== undefined ? patch.current : track.current;
    const clamped = clampTrackValues(nextCurrent, nextMax);
    const nextLabel = patch.label !== undefined ? patch.label.trim() || track.label : track.label;
    return {
      ...track,
      label: nextLabel,
      current: clamped.current,
      max: clamped.max,
    };
  });
}

export function addPlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  input: { label: string; max: number; current?: number; id?: string }
): PlayerSheetTrack[] {
  const label = input.label.trim();
  if (!label) return [...tracks];
  const clamped = clampTrackValues(input.current ?? input.max, input.max);
  return [
    ...tracks,
    {
      id: input.id?.trim() || createPlayerSheetTrackId(),
      label,
      current: clamped.current,
      max: clamped.max,
    },
  ];
}

export function removePlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  trackId: string
): PlayerSheetTrack[] {
  return tracks.filter((t) => t.id !== trackId);
}

export function playerSheetKindLabel(kind: PlayerSheetKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Image';
    case 'prebuilt':
      return 'Prebuilt';
  }
}

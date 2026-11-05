export const PROMO_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const PROMO_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const PROMO_MAX_BYTES = 25 * 1024 * 1024;
export const PROMO_TEXT_MAX = 90;

export type Promo = {
  id: number;
  kind: 'text' | 'image' | 'video';
  text: string;
  enabled: boolean;
  position: number;
  /** Address of the uploaded file (image/video), served from R2. */
  url: string | null;
};

export type PromoRow = { id: number; kind: Promo['kind']; text: string; mediaKey: string | null; enabled: number; position: number };

export const PROMO_SELECT = 'SELECT id, kind, text, media_key AS mediaKey, enabled, position FROM promos ORDER BY position ASC, id ASC';

export function toPromo(row: PromoRow): Promo {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    enabled: row.enabled !== 0,
    position: row.position,
    url: row.mediaKey ? `/api/promos/media/${encodeURIComponent(row.mediaKey)}` : null,
  };
}

export function cleanPromoText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, PROMO_TEXT_MAX) : '';
}

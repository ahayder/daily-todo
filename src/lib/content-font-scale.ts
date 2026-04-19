export const CONTENT_FONT_SCALE_DEFAULT = 1;
export const CONTENT_FONT_SCALE_MIN = 0.85;
export const CONTENT_FONT_SCALE_MAX = 1.25;
export const CONTENT_FONT_SCALE_STEP = 0.05;

function roundContentFontScale(value: number) {
  return Math.round(value * 100) / 100;
}

export function clampContentFontScale(value: number) {
  return Math.min(
    CONTENT_FONT_SCALE_MAX,
    Math.max(CONTENT_FONT_SCALE_MIN, roundContentFontScale(value)),
  );
}

export function increaseContentFontScale(value: number) {
  return clampContentFontScale(value + CONTENT_FONT_SCALE_STEP);
}

export function decreaseContentFontScale(value: number) {
  return clampContentFontScale(value - CONTENT_FONT_SCALE_STEP);
}

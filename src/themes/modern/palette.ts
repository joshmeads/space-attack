export const MODERN_PALETTE = {
  background: 0x080b19,
  panel: 0x10162b,
  border: 0x334365,
  muted: 0x8c9cbf,
  white: 0xedf7ff,
  cyan: 0x65e8ff,
  violet: 0xbf94ff,
  magenta: 0xff739c,
  mint: 0x76edbf,
  amber: 0xffce81,
  hull: 0x17273e,
  enemyHull: 0x201c39,
  grid: 0x566496,
} satisfies Record<string, number>;

export const MODERN_ENEMY_COLORS = {
  flagship: MODERN_PALETTE.magenta,
  scout: MODERN_PALETTE.violet,
  striker: MODERN_PALETTE.cyan,
  drone: MODERN_PALETTE.mint,
  manta: MODERN_PALETTE.amber,
} satisfies Record<string, number>;

export const CLASSIC_PALETTE = {
  background: 0x000000,
  panel: 0x000000,
  border: 0x00e51a,
  muted: 0xb8b800,
  white: 0xf4f4f4,
  yellow: 0xeeee00,
  red: 0xf01818,
  green: 0x00ed18,
  cyan: 0x00e5df,
  fuel: 0x00ed18,
  star: 0xcaca00,
} satisfies Record<string, number>;

export type PixelPalette = Readonly<Record<string, number>>;

export const CLASSIC_SPRITE_PALETTE: PixelPalette = {
  P: CLASSIC_PALETTE.red,
  C: CLASSIC_PALETTE.cyan,
  G: CLASSIC_PALETTE.green,
  W: CLASSIC_PALETTE.white,
  Y: CLASSIC_PALETTE.yellow,
  R: CLASSIC_PALETTE.red,
};

export const CLASSIC_ENEMY_PALETTES = {
  flagship: { ...CLASSIC_SPRITE_PALETTE, P: CLASSIC_PALETTE.yellow },
  scout: { ...CLASSIC_SPRITE_PALETTE, P: CLASSIC_PALETTE.red },
  striker: { ...CLASSIC_SPRITE_PALETTE, P: CLASSIC_PALETTE.green },
  drone: { ...CLASSIC_SPRITE_PALETTE, P: CLASSIC_PALETTE.red },
  manta: { ...CLASSIC_SPRITE_PALETTE, P: CLASSIC_PALETTE.red },
  raider: { ...CLASSIC_SPRITE_PALETTE, P: CLASSIC_PALETTE.red },
} satisfies Record<string, PixelPalette>;

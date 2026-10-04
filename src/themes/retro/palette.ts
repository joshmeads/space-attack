export const RETRO_PALETTE = {
  background: 0x080c1c,
  panel: 0x10182d,
  border: 0x293753,
  muted: 0x8194b1,
  white: 0xfff2d6,
  amber: 0xffbe55,
  yellow: 0xffe38a,
  red: 0xff6473,
  violet: 0xb69aff,
  cyan: 0x67ddeb,
  mint: 0x91e8b0,
  blue: 0x739dff,
} satisfies Record<string, number>;

export type PixelPalette = Readonly<Record<string, number>>;

export const SPRITE_PALETTE: PixelPalette = {
  W: RETRO_PALETTE.white,
  C: RETRO_PALETTE.cyan,
  A: RETRO_PALETTE.amber,
  R: RETRO_PALETTE.red,
  D: 0x536680,
  P: RETRO_PALETTE.violet,
  S: 0x7657b6,
  H: 0xe5d6ff,
};

export const RETRO_ENEMY_PALETTES = {
  flagship: { ...SPRITE_PALETTE, P: RETRO_PALETTE.red, S: 0xba3d64, H: 0xffbd9a },
  scout: { ...SPRITE_PALETTE, P: RETRO_PALETTE.violet, S: 0x7657b6, H: 0xe5d6ff },
  striker: { ...SPRITE_PALETTE, P: RETRO_PALETTE.cyan, S: 0x3285ae, H: 0xc5faff },
  drone: { ...SPRITE_PALETTE, P: RETRO_PALETTE.mint, S: 0x448e79, H: 0xd7ffd4 },
  manta: { ...SPRITE_PALETTE, P: RETRO_PALETTE.amber, S: 0xb77543, H: 0xffe9af },
  raider: { ...SPRITE_PALETTE, P: RETRO_PALETTE.blue, S: 0x3e55a4, H: 0xffa568 },
} satisfies Record<string, PixelPalette>;

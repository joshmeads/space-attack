export interface MusicScore {
  readonly name: string;
  readonly bpm: number;
  readonly lead: readonly (number | null)[];
  readonly bass: readonly number[];
  readonly leadWave: 'square' | 'sawtooth';
  readonly bassWave: 'triangle' | 'sawtooth';
  readonly leadVolume: number;
  readonly bassVolume: number;
  readonly drumVolume: number;
}

export type SoundName =
  | 'shot'
  | 'enemyShot'
  | 'kill'
  | 'hit'
  | 'dive'
  | 'wave'
  | 'bonus'
  | 'cancel';

export type SoundBank = Readonly<Record<SoundName, readonly number[]>>;

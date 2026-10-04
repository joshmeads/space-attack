import { EnemyMode, GamePhase } from '../core/types';
import type { DeepReadonly, GameEvent, GameState } from '../core/types';
import { classicMusic } from '../themes/classic/music';
import { classicSounds } from '../themes/classic/sounds';
import { modernMusic } from '../themes/modern/music';
import { modernSounds } from '../themes/modern/sounds';
import { retroMusic } from '../themes/retro/music';
import { retroSounds } from '../themes/retro/sounds';
import type { ThemeId } from '../themes/types';
import type { MusicScore, SoundBank, SoundName } from './types';

type ToneModule = typeof import('tone');
type Synth = InstanceType<ToneModule['Synth']>;
type Drum = InstanceType<ToneModule['MembraneSynth']>;

export interface AudioPreferences {
  readonly theme: ThemeId;
  readonly music: boolean;
  readonly sfx: boolean;
}

interface ThemeAudio {
  score: MusicScore;
  lead: Synth;
  bass: Synth;
  drum: Drum;
  buffers: Readonly<Record<SoundName, AudioBuffer>>;
}

const SOUND_NAMES: readonly SoundName[] = [
  'shot',
  'enemyShot',
  'kill',
  'hit',
  'dive',
  'wave',
  'bonus',
  'cancel',
];

function soundForEvent(event: DeepReadonly<GameEvent>): SoundName | null {
  switch (event.kind) {
    case 'shot':
      return event.owner === 'player' ? 'shot' : 'enemyShot';
    case 'kill':
    case 'hit':
    case 'dive':
    case 'wave':
    case 'bonus':
    case 'cancel':
      return event.kind;
    case 'phase':
      return null;
  }
}

export class AudioController {
  private context: AudioContext | null = null;
  private tone: ToneModule | null = null;
  private toneContext: InstanceType<ToneModule['Context']> | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private themes: Record<ThemeId, ThemeAudio> | null = null;
  private unlocking: Promise<void> | null = null;
  private scheduleId: number | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private currentTheme: ThemeId = 'classic';
  private noteIndex = 0;
  private bpm = 0;
  private musicPlaying = false;
  private sfxEnabled = false;
  private disposed = false;

  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.context) {
      void this.context.resume().catch(() => undefined);
    }
    if (this.tone) return this.tone.start().catch(() => undefined);
    if (this.unlocking) return this.unlocking;
    try {
      if (!this.context) {
        this.context = new AudioContext({ latencyHint: 'interactive' });
        void this.context.resume().catch(() => undefined);
        const silent = this.context.createBufferSource();
        silent.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
        silent.connect(this.context.destination);
        silent.start();
      }
      Object.defineProperty(window, 'TONE_SILENCE_LOGGING', { value: true, configurable: true });
      this.unlocking = this.initialize(this.context)
        .catch(() => {
          this.releaseNodes();
        })
        .finally(() => {
          this.unlocking = null;
        });
      return this.unlocking;
    } catch {
      return Promise.resolve();
    }
  }

  update(
    state: DeepReadonly<GameState>,
    events: readonly DeepReadonly<GameEvent>[],
    prefs: AudioPreferences,
  ): void {
    if (!this.tone || !this.context || !this.themes || this.disposed) return;
    if (prefs.theme !== this.currentTheme) {
      const prior = this.themes[this.currentTheme];
      prior.lead.triggerRelease();
      prior.bass.triggerRelease();
      this.currentTheme = prefs.theme;
    }
    const active =
      state.phase === GamePhase.Playing ||
      state.phase === GamePhase.Respawning ||
      state.phase === GamePhase.WaveClear;
    if (
      state.phase === GamePhase.Paused ||
      state.phase === GamePhase.Title ||
      state.phase === GamePhase.Screensaver
    ) {
      this.pause();
      return;
    }
    const score = this.themes[this.currentTheme].score;
    const defeated = state.enemies.reduce(
      (count, enemy) => count + Number(enemy.mode === EnemyMode.Dead),
      0,
    );
    const thinning = defeated / Math.max(1, state.enemies.length);
    const nextBpm = Math.min(
      192,
      score.bpm + Math.max(0, state.wave - 1) * 5 + Math.round(thinning * 18),
    );
    if (nextBpm !== this.bpm) {
      this.tone.getTransport().bpm.rampTo(nextBpm, 0.3);
      this.bpm = nextBpm;
    }
    const music = active && prefs.music;
    if (music !== this.musicPlaying) {
      this.setBus(this.musicBus, music ? 0.65 : 0, this.currentTheme === 'modern' ? 0.12 : 0);
      if (music) this.tone.getTransport().start();
      else this.tone.getTransport().pause();
      this.musicPlaying = music;
    }
    if (prefs.sfx !== this.sfxEnabled) {
      this.setBus(this.sfxBus, prefs.sfx ? 0.28 : 0, 0);
      this.sfxEnabled = prefs.sfx;
      if (!prefs.sfx) this.stopEffects(0);
    }
    if (!prefs.sfx) return;
    for (const event of events) {
      const sound = soundForEvent(event);
      if (sound) this.playSound(this.themes[this.currentTheme].buffers[sound]);
    }
  }

  pause(): void {
    if (!this.tone || (!this.musicPlaying && !this.sfxEnabled)) return;
    const fade = this.currentTheme === 'modern' ? 0.12 : 0;
    this.setBus(this.musicBus, 0, fade);
    this.setBus(this.sfxBus, 0, fade);
    this.tone.getTransport().pause();
    this.stopEffects(fade);
    this.musicPlaying = false;
    this.sfxEnabled = false;
  }

  dispose(): void {
    this.disposed = true;
    this.releaseNodes();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }

  private async initialize(context: AudioContext): Promise<void> {
    const [tone, { ZZFX }] = await Promise.all([import('tone'), import('zzfx')]);
    if (ZZFX.audioContext !== context) void ZZFX.audioContext.close().catch(() => undefined);
    ZZFX.audioContext = context;
    if (this.disposed) return;
    this.toneContext = new tone.Context({ context, lookAhead: 0.05, updateInterval: 0.025 });
    tone.setContext(this.toneContext);
    await tone.start();
    if (this.disposed) {
      this.toneContext.dispose();
      return;
    }
    this.tone = tone;
    this.musicBus = context.createGain();
    this.sfxBus = context.createGain();
    this.musicBus.gain.value = 0;
    this.sfxBus.gain.value = 0;
    this.musicBus.connect(context.destination);
    this.sfxBus.connect(context.destination);
    const buildBuffers = (bank: SoundBank): Record<SoundName, AudioBuffer> => {
      const build = (name: SoundName): AudioBuffer => {
        const samples = ZZFX.buildSamples(...bank[name]);
        const buffer = context.createBuffer(1, samples.length, ZZFX.sampleRate);
        buffer.getChannelData(0).set(samples);
        return buffer;
      };
      return {
        shot: build('shot'),
        enemyShot: build('enemyShot'),
        kill: build('kill'),
        hit: build('hit'),
        dive: build('dive'),
        wave: build('wave'),
        bonus: build('bonus'),
        cancel: build('cancel'),
      };
    };
    const createTheme = (score: MusicScore, bank: SoundBank): ThemeAudio => {
      const lead = new tone.Synth({
        oscillator: { type: score.leadWave },
        envelope: { attack: 0.005, decay: 0.07, sustain: 0.12, release: 0.08 },
        volume: score.leadVolume,
      });
      const bass = new tone.Synth({
        oscillator: { type: score.bassWave },
        envelope: { attack: 0.006, decay: 0.1, sustain: 0.2, release: 0.1 },
        volume: score.bassVolume,
      });
      const drum = new tone.MembraneSynth({
        pitchDecay: 0.035,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 },
        volume: score.drumVolume,
      });
      if (this.musicBus) {
        lead.connect(this.musicBus);
        bass.connect(this.musicBus);
        drum.connect(this.musicBus);
      }
      return { score, lead, bass, drum, buffers: buildBuffers(bank) };
    };
    this.themes = {
      classic: createTheme(classicMusic, classicSounds),
      retro: createTheme(retroMusic, retroSounds),
      modern: createTheme(modernMusic, modernSounds),
    };
    this.scheduleId = tone.getTransport().scheduleRepeat((time) => {
      if (!this.themes || !this.musicPlaying) return;
      const theme = this.themes[this.currentTheme];
      const index = this.noteIndex % theme.score.lead.length;
      const note = theme.score.lead[index];
      if (typeof note === 'number')
        theme.lead.triggerAttackRelease(this.frequency(note), '16n', time);
      if (index % 4 === 0) {
        const bass = theme.score.bass[Math.floor(index / 4) % theme.score.bass.length];
        if (typeof bass === 'number')
          theme.bass.triggerAttackRelease(this.frequency(bass), '8n', time);
      }
      if (index % 2 === 0)
        theme.drum.triggerAttackRelease(index % 4 === 0 ? 'C2' : 'G2', '32n', time);
      this.noteIndex += 1;
    }, '8n');
  }

  private frequency(midi: number): number {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  private setBus(bus: GainNode | null, value: number, fade: number): void {
    if (!bus || !this.context) return;
    const now = this.context.currentTime;
    bus.gain.cancelScheduledValues(now);
    if (fade > 0) {
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(value, now + fade);
    } else {
      bus.gain.setValueAtTime(value, now);
    }
  }

  private playSound(buffer: AudioBuffer): void {
    if (
      !this.context ||
      !this.sfxBus ||
      this.context.state !== 'running' ||
      this.activeSources.size >= 24
    )
      return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxBus);
    this.activeSources.add(source);
    source.onended = () => {
      source.disconnect();
      this.activeSources.delete(source);
    };
    source.start();
  }

  private stopEffects(fade: number): void {
    if (!this.context) return;
    for (const source of this.activeSources) source.stop(this.context.currentTime + fade);
  }

  private releaseNodes(): void {
    this.pause();
    if (this.tone && this.scheduleId !== null) this.tone.getTransport().clear(this.scheduleId);
    this.scheduleId = null;
    if (this.themes) {
      for (const theme of Object.values(this.themes)) {
        theme.lead.dispose();
        theme.bass.dispose();
        theme.drum.dispose();
      }
    }
    this.stopEffects(0);
    this.themes = null;
    this.musicBus?.disconnect();
    this.sfxBus?.disconnect();
    this.musicBus = null;
    this.sfxBus = null;
    this.toneContext?.dispose();
    this.toneContext = null;
    this.tone = null;
  }
}

export { SOUND_NAMES };

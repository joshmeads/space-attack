import { Command, type Direction, type InputFrame } from '../core/types';

export type MenuAction =
  | 'start'
  | 'pause'
  | 'music'
  | 'sfx'
  | 'theme'
  | 'title'
  | 'invulnerable'
  | 'skipwave';

export class InputController {
  private readonly keys = new Set<string>();
  private readonly touch = new Set<string>();
  private activity = false;

  constructor(onAction: (action: MenuAction) => void, onGesture: () => void) {
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      const controlled = [
        'a',
        'd',
        'w',
        'arrowleft',
        'arrowright',
        'arrowup',
        ' ',
        'enter',
        'p',
        'escape',
        'm',
        'n',
        't',
        'i',
        'k',
      ];
      if (event.target instanceof HTMLInputElement) return;
      if (event.target instanceof HTMLButtonElement && (key === 'enter' || key === ' ')) {
        this.activity = true;
        onGesture();
        return;
      }
      if (!controlled.includes(key)) return;
      event.preventDefault();
      this.keys.add(key);
      this.activity = true;
      onGesture();
      if (event.repeat) return;
      const actions: Record<string, MenuAction> = {
        enter: 'start',
        p: 'pause',
        escape: 'pause',
        m: 'music',
        n: 'sfx',
        t: 'theme',
        i: 'invulnerable',
        k: 'skipwave',
      };
      const action = actions[key];
      if (action) onAction(action);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener(
      'touchstart',
      () => {
        this.activity = true;
        onGesture();
      },
      { passive: true },
    );
  }

  bindTouch(button: HTMLElement, action: string): void {
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.touch.add(action);
      this.activity = true;
    });
    const release = () => this.touch.delete(action);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  read(): InputFrame {
    const left = this.keys.has('a') || this.keys.has('arrowleft') || this.touch.has('left');
    const right = this.keys.has('d') || this.keys.has('arrowright') || this.touch.has('right');
    const move: Direction = left === right ? 0 : left ? -1 : 1;
    const input: InputFrame = {
      move,
      fire:
        this.keys.has('w') ||
        this.keys.has('arrowup') ||
        this.keys.has(' ') ||
        this.touch.has('fire'),
      command: Command.None,
      activity: this.activity,
      debugInvulnerable: false,
      debugSkipWave: false,
    };
    this.activity = false;
    return input;
  }

  clear(): void {
    this.keys.clear();
    this.touch.clear();
  }
}

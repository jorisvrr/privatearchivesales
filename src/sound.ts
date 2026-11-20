// Mino sound: three short CC0 cues (public/media/sound/CREDITS.md), one shared Howl per clip.
// Starts muted. Audio is enabled only by an explicit click or tap, and only cues that happen after that
// gesture play. A cue whose clip has not loaded yet is skipped, never played late. Muting fades any
// active sound quickly and silences what follows. The choice lasts while the visitor moves between pages.
import { Howl, Howler } from 'howler';

export type Cue = 'paper' | 'fabric' | 'click';

const SOURCES: Record<Cue, string[]> = {
  paper: ['/media/sound/paper-shuffle.webm', '/media/sound/paper-shuffle.m4a'],
  fabric: ['/media/sound/fabric-sweep.webm', '/media/sound/fabric-sweep.m4a'],
  click: ['/media/sound/garment-click.webm', '/media/sound/garment-click.m4a'],
};
/** The files are loudness-balanced already (click quietest); this is the overall level. */
const MASTER = 0.8;
const FADE_MS = 140;
/** Two triggers of the same cue closer than this are one event (guards against double firing). */
const DEDUPE_MS = 150;

export interface CueLogEntry { cue: Cue; at: number; result: 'played' | 'muted' | 'not-loaded' | 'duplicate' }

type Listener = (enabled: boolean) => void;

class Sound {
  private enabled_ = false;
  private howls: Partial<Record<Cue, Howl>> = {};
  private last: Partial<Record<Cue, number>> = {};
  private listeners = new Set<Listener>();
  /** Every cue request and what happened to it (read by the test suite). */
  readonly log: CueLogEntry[] = [];

  /** Start fetching and decoding the clips; safe before any gesture (the context stays suspended). */
  preload() {
    Howler.autoUnlock = true;
    for (const cue of Object.keys(SOURCES) as Cue[]) {
      this.howls[cue] ??= new Howl({ src: SOURCES[cue], format: ['webm', 'm4a'], preload: true, volume: MASTER });
    }
  }

  get enabled() {
    return this.enabled_;
  }

  /** Call from inside a click/tap handler so the browser allows audio to start. */
  enable() {
    if (this.enabled_) return;
    this.preload();
    this.enabled_ = true;
    void Howler.ctx?.resume?.();
    this.emit();
  }

  disable() {
    if (!this.enabled_) return;
    this.enabled_ = false;
    for (const howl of Object.values(this.howls)) {
      if (!howl?.playing()) continue;
      howl.fade(howl.volume(), 0, FADE_MS);
      howl.once('fade', () => { if (!this.enabled_) howl.stop(); howl.volume(MASTER); });
    }
    this.emit();
  }

  toggle() {
    if (this.enabled_) this.disable();
    else this.enable();
  }

  /** Play a cue now, if audio is on and the clip is ready. */
  cue(cue: Cue) {
    const at = performance.now();
    const record = (result: CueLogEntry['result']) => { this.log.push({ cue, at, result }); return result; };
    if (!this.enabled_) return record('muted');
    const prev = this.last[cue];
    if (prev !== undefined && at - prev < DEDUPE_MS) return record('duplicate');
    const howl = this.howls[cue];
    if (!howl || howl.state() !== 'loaded') return record('not-loaded');
    this.last[cue] = at;
    howl.volume(MASTER);
    howl.play();
    return record('played');
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.enabled_);
  }
}

export const sound = new Sound();

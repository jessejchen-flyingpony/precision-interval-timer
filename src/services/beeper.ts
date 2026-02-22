/**
 * Simple Web Audio Beeper with presets
 */
export type SoundPreset = 'classic' | 'high' | 'low' | 'pulse' | 'digital' | 'ding' | 'alarm';

export class Beeper {
  private audioCtx: AudioContext | null = null;

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  play(preset: SoundPreset = 'classic') {
    this.init();
    if (!this.audioCtx) return;

    const gainNode = this.audioCtx.createGain();
    gainNode.connect(this.audioCtx.destination);

    switch (preset) {
      case 'ding':
        this.beep(1500, 0.5, 'sine', gainNode, 0.2);
        this.beep(2200, 0.3, 'sine', gainNode, 0.1);
        break;
      case 'alarm':
        this.beep(660, 0.1, 'sawtooth', gainNode, 0.15);
        setTimeout(() => this.beep(880, 0.1, 'sawtooth', gainNode, 0.15), 150);
        setTimeout(() => this.beep(660, 0.1, 'sawtooth', gainNode, 0.15), 300);
        break;
      case 'high':
        this.beep(880 * 2, 0.1, 'sine', gainNode);
        break;
      case 'low':
        this.beep(440, 0.2, 'sine', gainNode);
        break;
      case 'pulse':
        this.beep(880, 0.05, 'square', gainNode);
        setTimeout(() => this.beep(880, 0.05, 'square', gainNode), 100);
        break;
      case 'digital':
        this.beep(1200, 0.15, 'triangle', gainNode);
        break;
      case 'classic':
      default:
        this.beep(880, 0.15, 'square', gainNode);
        break;
    }
  }

  private beep(freq: number, duration: number, type: OscillatorType, gainNode: GainNode, volume = 0.1) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    
    g.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + duration);
    
    osc.connect(g);
    g.connect(gainNode);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }
}

export const beeper = new Beeper();

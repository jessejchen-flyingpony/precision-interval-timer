/**
 * Simple Web Audio Beeper with presets
 */
export type SoundPreset = 'classic' | 'high' | 'low' | 'pulse' | 'digital' | 'ding' | 'alarm' | 'chime' | 'buzzer' | 'sonar' | 'voice';

export class Beeper {
  private audioCtx: AudioContext | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    // Preload voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice = voices.find(v => v.lang.startsWith('en') && v.localService) ||
          voices.find(v => v.lang.startsWith('en')) || null;
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  play(preset: SoundPreset = 'classic', globalVolume: number = 1.0, textToSpeak?: string) {
    if (preset === 'voice') {
      this.speak(textToSpeak || 'Voice alert', globalVolume);
      return;
    }

    this.init();
    if (!this.audioCtx) return;

    const gainNode = this.audioCtx.createGain();
    // Scale the overall output by the globalVolume parameter
    gainNode.gain.value = globalVolume;
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
      case 'chime':
        this.beep(1046.50, 0.4, 'sine', gainNode, 0.2); // C6
        setTimeout(() => this.beep(1318.51, 0.6, 'sine', gainNode, 0.2), 200); // E6
        break;
      case 'buzzer':
        this.beep(150, 0.3, 'sawtooth', gainNode, 0.3);
        setTimeout(() => this.beep(150, 0.4, 'sawtooth', gainNode, 0.3), 350);
        break;
      case 'sonar':
        this.beep(1200, 1.5, 'sine', gainNode, 0.3);
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

  private speak(text: string, volume: number) {
    if ('speechSynthesis' in window) {
      // We do not call cancel() or setTimeout() here because in Chrome/Safari that
      // can cause the TTS engine to stall for several seconds or drop the utterance.

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.volume = volume;

      if (this.voice) {
        this.currentUtterance.voice = this.voice;
      } else {
        const voices = window.speechSynthesis.getVoices();
        this.currentUtterance.voice = voices.find(v => v.lang.startsWith('en') && v.localService) ||
          voices.find(v => v.lang.startsWith('en')) || null;
      }

      window.speechSynthesis.speak(this.currentUtterance);
    } else {
      console.warn("Speech Synthesis API not supported in this browser.");
      // Fallback
      this.play('ding', volume);
    }
  }
}

export const beeper = new Beeper();

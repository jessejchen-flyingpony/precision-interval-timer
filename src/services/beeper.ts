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
    } else if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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
      // 1. Wake up the AudioContext immediately
      this.init();

      // 2. Play a silent 'wake-up' tone to ensure the browser's audio engine 
      // isn't in a power-saving or ducked state for this tab.
      if (this.audioCtx) {
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0;
        silentGain.connect(this.audioCtx.destination);
        this.beep(440, 0.01, 'sine', silentGain, 0);
      }

      // 3. Handle overlapping speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      // 4. Boost volume logic. Since it's still "extremely low", 
      // let's ensure we use the maximum possible volume for the utterance.
      const effectiveVolume = Math.min(1.0, volume * 2.0);

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.volume = effectiveVolume;

      // 5. Explicitly search for high-quality local voices (Microsoft/Apple local vs Google Cloud)
      const voices = window.speechSynthesis.getVoices();
      const bestVoice =
        voices.find(v => v.lang.startsWith('en') && v.localService && (v.name.includes('David') || v.name.includes('Zira') || v.name.includes('Samantha'))) ||
        voices.find(v => v.lang.startsWith('en') && v.localService) ||
        voices.find(v => v.lang.startsWith('en')) || null;

      if (bestVoice) {
        this.currentUtterance.voice = bestVoice;
      }

      window.speechSynthesis.speak(this.currentUtterance);
    } else {
      console.warn("Speech Synthesis API not supported in this browser.");
      this.play('ding', volume);
    }
  }
}

export const beeper = new Beeper();

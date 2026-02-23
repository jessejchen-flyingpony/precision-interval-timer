/**
 * Simple Web Audio Beeper with presets
 */
export type SoundPreset = 'classic' | 'high' | 'low' | 'pulse' | 'digital' | 'ding' | 'alarm' | 'chime' | 'buzzer' | 'sonar' | 'voice';

export class Beeper {
  private audioCtx: AudioContext | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private lastSpeakCallTime: number = 0;
  // A silent OscillatorNode keeps the AudioContext active and prevents Chrome
  // from freezing the tab (active-audio tabs are exempt from background
  // throttling and tab-freeze).
  private keepaliveSrc: AudioScheduledSourceNode | null = null;

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

    // Resume AudioContext when the user returns to the tab.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.audioCtx?.state === 'suspended') {
          this.audioCtx.resume().then(() => this.startKeepalive());
        }
      });

      // Activate AudioContext + keepalive on the first user interaction so
      // the tab is marked as audio-active before the first alarm fires.
      // Without this, Chrome can throttle the tab to 1 Hz (or freeze it)
      // while the user waits for the first trigger mark.
      const onFirstInteraction = () => {
        this.init();
        this.startKeepalive(); // no-op if still suspended; init()'s resume().then() handles that case
        document.removeEventListener('click', onFirstInteraction, true);
        document.removeEventListener('keydown', onFirstInteraction, true);
      };
      document.addEventListener('click', onFirstInteraction, true);
      document.addEventListener('keydown', onFirstInteraction, true);
    }
  }

  // Starts a silent oscillator that keeps Chrome's audio-activity detector
  // satisfied so the tab is never background-throttled or the AudioContext
  // suspended between beeps.
  //
  // Why OscillatorNode instead of ConstantSourceNode:
  //   A DC offset (ConstantSourceNode) is typically filtered out by the OS
  //   audio pipeline before it reaches Chrome's audio-activity detector.
  //   Chrome requires a *varying* (AC) signal to classify the tab as
  //   "playing audio".  A 440 Hz sine at −80 dBFS (gain 0.0001) is
  //   inaudible in virtually all real environments but produces non-zero,
  //   varying PCM samples that Chrome reliably detects.
  //
  // Called AFTER audio is scheduled so it never races with beep graph setup.
  private startKeepalive() {
    if (!this.audioCtx || this.keepaliveSrc || this.audioCtx.state !== 'running') return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.frequency.value = 440;
      gain.gain.value = 0.0001; // −80 dBFS: inaudible, non-zero AC samples
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      this.keepaliveSrc = osc;
    } catch (_) {
      this.keepaliveSrc = null;
    }
  }

  private stopKeepalive() {
    try { this.keepaliveSrc?.stop(); } catch (_) {}
    try { this.keepaliveSrc?.disconnect(); } catch (_) {}
    this.keepaliveSrc = null;
  }

  private init() {
    // Bug fix #2: recreate if closed.
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.stopKeepalive();
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Bug fix #1: sequential check so freshly-created suspended contexts are resumed too.
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => this.startKeepalive());
    }
    // Note: startKeepalive() is NOT called here for the running case.
    // It is called from play() AFTER audio nodes are fully set up,
    // so the keepalive never races with beep graph construction.
  }

  play(preset: SoundPreset = 'classic', globalVolume: number = 1.0, textToSpeak?: string) {
    if (preset === 'voice') {
      this.speak(textToSpeak || 'Voice alert', globalVolume);
      return;
    }

    this.init();
    // If the context is still suspended (e.g. Chrome suspended it in background
    // despite the keepalive), do NOT schedule audio on it.  Scheduling on a
    // suspended context queues the sound and plays it the instant the user
    // returns to the tab — producing a "ghost beep" at an unexpected time.
    // Dropping the beep here is preferable; with the AC keepalive active the
    // context should stay running and this guard should almost never fire.
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    // Bug fix #4: factory creates a fresh gainNode per call so setTimeout callbacks
    // always reference the live context, not a stale one.
    const makeGain = (): GainNode | null => {
      if (!this.audioCtx || this.audioCtx.state === 'closed') return null;
      const g = this.audioCtx.createGain();
      g.gain.value = globalVolume;
      g.connect(this.audioCtx.destination);
      return g;
    };

    const gainNode = makeGain();
    if (!gainNode) return;

    switch (preset) {
      case 'ding':
        this.beep(1500, 0.5, 'sine', gainNode, 0.2);
        this.beep(2200, 0.3, 'sine', gainNode, 0.1);
        break;
      case 'alarm':
        this.beep(660, 0.1, 'sawtooth', gainNode, 0.15);
        setTimeout(() => { const g = makeGain(); if (g) this.beep(880, 0.1, 'sawtooth', g, 0.15); }, 150);
        setTimeout(() => { const g = makeGain(); if (g) this.beep(660, 0.1, 'sawtooth', g, 0.15); }, 300);
        break;
      case 'high':
        this.beep(880 * 2, 0.1, 'sine', gainNode);
        break;
      case 'low':
        this.beep(440, 0.2, 'sine', gainNode);
        break;
      case 'pulse':
        this.beep(880, 0.05, 'square', gainNode);
        setTimeout(() => { const g = makeGain(); if (g) this.beep(880, 0.05, 'square', g); }, 100);
        break;
      case 'digital':
        this.beep(1200, 0.15, 'triangle', gainNode);
        break;
      case 'chime':
        this.beep(1046.50, 0.4, 'sine', gainNode, 0.2); // C6
        setTimeout(() => { const g = makeGain(); if (g) this.beep(1318.51, 0.6, 'sine', g, 0.2); }, 200); // E6
        break;
      case 'buzzer':
        this.beep(150, 0.3, 'sawtooth', gainNode, 0.3);
        setTimeout(() => { const g = makeGain(); if (g) this.beep(150, 0.4, 'sawtooth', g, 0.3); }, 350);
        break;
      case 'sonar':
        this.beep(1200, 1.5, 'sine', gainNode, 0.3);
        break;
      case 'classic':
      default:
        this.beep(880, 0.15, 'square', gainNode);
        break;
    }

    // Start keepalive AFTER all audio nodes are scheduled, never before,
    // so it cannot interfere with the beep graph being set up above.
    this.startKeepalive();
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
    if (!('speechSynthesis' in window)) {
      console.warn("Speech Synthesis API not supported in this browser.");
      this.play('ding', volume);
      return;
    }

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

    // 3. Boost volume logic.
    const effectiveVolume = Math.min(1.0, volume * 2.0);

    // 4. Explicitly search for high-quality local voices (Microsoft/Apple local vs Google Cloud)
    const voices = window.speechSynthesis.getVoices();
    const bestVoice =
      voices.find(v => v.lang.startsWith('en') && v.localService && (v.name.includes('David') || v.name.includes('Zira') || v.name.includes('Samantha'))) ||
      voices.find(v => v.lang.startsWith('en') && v.localService) ||
      voices.find(v => v.lang.startsWith('en')) || null;

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.volume = effectiveVolume;
    this.currentUtterance.lang = 'en-US';
    if (bestVoice) this.currentUtterance.voice = bestVoice;

    // 5. Detect a *stuck* synthesis engine without cancelling before every speak()
    // call. cancel() forces a full engine teardown in Chrome, causing a 2-3 s
    // restart delay and truncating the start of the new utterance.
    //
    // Our utterances are short (< ~8 s). If speechSynthesis.speaking is still
    // true but more than 12 s have elapsed since the last speak() call, the
    // engine is stuck. Only then do we cancel and retry after a short delay.
    const now = Date.now();
    const timeSinceLastCall = now - this.lastSpeakCallTime;
    this.lastSpeakCallTime = now;

    if (window.speechSynthesis.speaking && timeSinceLastCall > 12000) {
      window.speechSynthesis.cancel();
      setTimeout(() => window.speechSynthesis.speak(this.currentUtterance!), 50);
    } else {
      window.speechSynthesis.speak(this.currentUtterance);
    }

    // Start keepalive after speak so the AudioContext stays active.
    this.startKeepalive();
  }
}

export const beeper = new Beeper();

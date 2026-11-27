import type { BinauralMode } from '../types';

class MindfulAudioEngine {
  private ctx: AudioContext | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private binauralGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private volume = 0.08;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) {
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setVolume(val: number) {
    this.volume = Math.max(0.01, Math.min(0.4, val));
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.binauralGain) {
      this.binauralGain.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.08);
    }
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(this.volume * 1.4, ctx.currentTime, 0.08);
    }
  }

  startBinaural(mode: BinauralMode) {
    this.stopBinaural();
    if (mode === 'none') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const diff = mode === 'alpha' ? 10 : mode === 'beta' ? 18 : 6;
    const baseFreq = 200;

    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    gain.connect(ctx.destination);

    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    leftOsc.type = 'sine';
    rightOsc.type = 'sine';
    leftOsc.frequency.value = baseFreq;
    rightOsc.frequency.value = baseFreq + diff;

    if (ctx.createStereoPanner) {
      const panL = ctx.createStereoPanner();
      const panR = ctx.createStereoPanner();
      panL.pan.value = -0.8;
      panR.pan.value = 0.8;
      leftOsc.connect(panL).connect(gain);
      rightOsc.connect(panR).connect(gain);
    } else {
      leftOsc.connect(gain);
      rightOsc.connect(gain);
    }

    leftOsc.start();
    rightOsc.start();

    this.leftOsc = leftOsc;
    this.rightOsc = rightOsc;
    this.binauralGain = gain;
  }

  stopBinaural() {
    try {
      this.leftOsc?.stop();
      this.rightOsc?.stop();
      this.leftOsc?.disconnect();
      this.rightOsc?.disconnect();
      this.binauralGain?.disconnect();
    } catch {
      // ignore stopped nodes
    }
    this.leftOsc = null;
    this.rightOsc = null;
    this.binauralGain = null;
  }

  startRain() {
    this.stopRain();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;

    const gain = ctx.createGain();
    gain.gain.value = this.volume * 1.4;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();

    this.rainSource = source;
    this.rainGain = gain;
  }

  stopRain() {
    try {
      this.rainSource?.stop();
      this.rainSource?.disconnect();
      this.rainGain?.disconnect();
    } catch {
      // ignore stopped nodes
    }
    this.rainSource = null;
    this.rainGain = null;
  }

  stopAll() {
    this.stopBinaural();
    this.stopRain();
  }

  playCompletionChime() {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.17);
        gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.17 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.17 + 0.42);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.17);
        osc.stop(now + i * 0.17 + 0.45);
      });
    } catch {
      // ignore audio context errors
    }
  }

  playAwakeningBell() {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [440, 587.33].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.58);
      });
    } catch {
      // ignore audio context errors
    }
  }

  playTactilePress(kind: 'start' | 'pause' | 'reset' | 'tick' = 'start') {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (kind === 'start') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (kind === 'pause') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(135, now + 0.05);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(kind === 'reset' ? 190 : 380, now);
        osc.frequency.exponentialRampToValueAtTime(kind === 'reset' ? 110 : 280, now + 0.032);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.075, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {
      // ignore audio context errors
    }
  }

  playTreeTouchSparkle(boosted = false) {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = boosted ? [587.33, 783.99, 1046.5, 1318.51] : [523.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.065);
        gain.gain.setValueAtTime(0.0001, now + i * 0.065);
        gain.gain.exponentialRampToValueAtTime(boosted ? 0.11 : 0.075, now + i * 0.065 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + (boosted ? 0.42 : 0.28));
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.065);
        osc.stop(now + i * 0.065 + (boosted ? 0.45 : 0.3));
      });
    } catch {
      // ignore audio context errors
    }
  }
}

export function triggerHapticFeedback(pattern: number | number[] = 14) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported vibration environments
  }
}

export const audioEngine = new MindfulAudioEngine();

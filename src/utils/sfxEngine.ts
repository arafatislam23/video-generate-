/**
 * High-fidelity Web Audio Procedural SFX Engine
 * Generates studio-grade sound effects in real-time (preview) and renders into
 * OfflineAudioContext (for video & master audio export) with zero external asset dependencies.
 */

import { MotionScene } from '../data/defaultProject';

export type SfxType = 'whoosh' | 'pop' | 'impact' | 'chime' | 'click';

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

/**
 * Procedural Whoosh/Swish: Fast gentle bandpass-filtered noise sweep for scene transitions (Soft & subtle)
 */
export function playWhooshSfx(ctx: BaseAudioContext, startTime = 0, masterVolume = 0.4): void {
  const duration = 0.32;
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = noiseBuffer.getChannelData(0);

  // Pink-ish noise generation with smoother frequency response
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < frameCount; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.22;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // Bandpass filter that sweeps rapidly up then down (whoosh curve)
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(2.8, startTime);
  filter.frequency.setValueAtTime(260, startTime);
  filter.frequency.exponentialRampToValueAtTime(1400, startTime + duration * 0.45);
  filter.frequency.exponentialRampToValueAtTime(300, startTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(0.24 * masterVolume, startTime + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noiseSource.start(startTime);
}

/**
 * Procedural Pop / Bubble Pluck: Gentle soft sine with rapid downward pitch drop for speech elements
 */
export function playPopSfx(ctx: BaseAudioContext, startTime = 0, masterVolume = 0.4, pitchMultiplier = 1.0): void {
  const duration = 0.14;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  const startFreq = 620 * pitchMultiplier;
  const endFreq = 180 * pitchMultiplier;

  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(0.22 * masterVolume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Procedural Impact / Punch: Low-frequency gentle thump for kinetic beats (Warm & soft)
 */
export function playImpactSfx(ctx: BaseAudioContext, startTime = 0, masterVolume = 0.4): void {
  const duration = 0.22;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(125, startTime);
  osc.frequency.exponentialRampToValueAtTime(45, startTime + duration);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(0.28 * masterVolume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Procedural Tech Chime / Bell: Dual harmonic sine tones (Soft shimmer)
 */
export function playChimeSfx(ctx: BaseAudioContext, startTime = 0, masterVolume = 0.4): void {
  const duration = 0.38;
  const frequencies = [1046.5, 1567.98]; // C6 & G6 harmonic

  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime((0.16 / (idx + 1)) * masterVolume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  });
}

/**
 * Procedural Digital Click / Tick (Soft micro-cue)
 */
export function playClickSfx(ctx: BaseAudioContext, startTime = 0, masterVolume = 0.4): void {
  const duration = 0.03;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(900, startTime);
  osc.frequency.exponentialRampToValueAtTime(350, startTime + duration);

  gain.gain.setValueAtTime(0.10 * masterVolume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Triggers a real-time sound effect in browser preview
 */
export function triggerLiveSfx(type: SfxType, volume = 0.7): void {
  if (volume <= 0) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  switch (type) {
    case 'whoosh':
      playWhooshSfx(ctx, now, volume);
      break;
    case 'pop':
      playPopSfx(ctx, now, volume);
      break;
    case 'impact':
      playImpactSfx(ctx, now, volume);
      break;
    case 'chime':
      playChimeSfx(ctx, now, volume);
      break;
    case 'click':
      playClickSfx(ctx, now, volume);
      break;
  }
}

export interface SfxSceneTiming {
  start: number;
  end: number;
  duration: number;
}

/**
 * Mixes all scene-synced sound effects directly into an OfflineAudioContext for video & audio export!
 */
export function renderSceneSfxIntoBuffer(
  offlineCtx: OfflineAudioContext,
  scenes: MotionScene[],
  sceneTimings: SfxSceneTiming[],
  sfxVolume: number
): void {
  if (sfxVolume <= 0) return;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const timing = sceneTimings[i];
    if (!timing) continue;

    const preset = scene.motionPreset || 'smooth-ease';

    // 1. Scene Transition Whoosh (for scene 1 and above, or dynamic pan/intro)
    if (i > 0) {
      // Whoosh starts slightly before scene boundary to bridge the cut smoothly
      const whooshTime = Math.max(0, timing.start - 0.12);
      playWhooshSfx(offlineCtx, whooshTime, sfxVolume * 0.85);
    }

    // 2. Scene Entry Punch / Impact
    if (preset === 'aggressive-linear') {
      playImpactSfx(offlineCtx, timing.start + 0.05, sfxVolume * 0.9);
    } else if (preset === 'bouncy-elastic' || preset === 'kinetic-snap') {
      playPopSfx(offlineCtx, timing.start + 0.04, sfxVolume * 0.75, 1.25);
    }

    // 3. Floating 3D Callout Cards pop sounds staggered along spoken narration
    const elements = scene.floatingElements || [];
    const cardTriggers = [0.22, 0.48, 0.72];
    elements.slice(0, 3).forEach((_, idx) => {
      const speechFraction = cardTriggers[idx] || (0.22 + idx * 0.25);
      const cardPopTime = timing.start + timing.duration * speechFraction;
      if (cardPopTime < timing.end - 0.2) {
        // Vary pitch slightly for each sequential card
        const pitch = 0.95 + idx * 0.18;
        playPopSfx(offlineCtx, cardPopTime, sfxVolume * 0.65, pitch);
      }
    });

    // 4. Special visual type cues
    if (scene.visualType === 'audio-sync') {
      playChimeSfx(offlineCtx, timing.start + timing.duration * 0.4, sfxVolume * 0.65);
    } else if (scene.visualType === 'no-editing-clock') {
      playClickSfx(offlineCtx, timing.start + timing.duration * 0.3, sfxVolume * 0.6);
    }
  }
}

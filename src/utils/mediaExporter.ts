import { MotionScene } from '../data/defaultProject';
import { renderSceneSfxIntoBuffer } from './sfxEngine';

export interface SceneTiming {
  start: number;
  end: number;
  duration: number;
}

/**
 * Converts an AudioBuffer to a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const numSamples = channelData.length;

  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Renders a complete mixed AudioBuffer combining all scene voiceovers (at their exact start times),
 * procedural sound effects (synced with animation events), and background music track using OfflineAudioContext.
 */
export async function renderMixedMasterAudioBuffer(params: {
  scenes: MotionScene[];
  sceneTimings: SceneTiming[];
  totalDuration: number;
  musicAudioUrl: string;
  musicVolume: number;
  voiceMuted: boolean;
  musicMuted: boolean;
  sfxVolume?: number;
  sfxMuted?: boolean;
}): Promise<AudioBuffer> {
  const {
    scenes,
    sceneTimings,
    totalDuration,
    musicAudioUrl,
    musicVolume,
    voiceMuted,
    musicMuted,
    sfxVolume = 0.7,
    sfxMuted = false,
  } = params;

  const sampleRate = 24000;
  const safeDuration = Math.max(1, totalDuration);
  const totalFrames = Math.ceil(safeDuration * sampleRate);
  const offlineCtx = new OfflineAudioContext(1, totalFrames, sampleRate);

  // 1. Mix Background Music Track (if enabled and present)
  if (!musicMuted && musicAudioUrl && musicVolume > 0) {
    try {
      const resp = await fetch(musicAudioUrl);
      const arrayBuf = await resp.arrayBuffer();
      const decodedMusic = await offlineCtx.decodeAudioData(arrayBuf.slice(0));

      const musicSource = offlineCtx.createBufferSource();
      musicSource.buffer = decodedMusic;
      musicSource.loop = true;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(musicVolume, 0);
      // Smooth fade-out at end of video
      if (safeDuration > 1.5) {
        gainNode.gain.setValueAtTime(musicVolume, safeDuration - 1.2);
        gainNode.gain.linearRampToValueAtTime(0.01, safeDuration);
      }

      musicSource.connect(gainNode);
      gainNode.connect(offlineCtx.destination);
      musicSource.start(0);
    } catch {
      // Ignore if music decode fails
    }
  }

  // 2. Mix Every Scene's Voiceover at its exact scene start timestamp
  if (!voiceMuted) {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const timing = sceneTimings[i];
      const voiceUrl =
        scene.voiceAudioUrl ||
        (scene.narration && /[\u0980-\u09FF]/.test(scene.narration)
          ? `/api/bengali-tts?text=${encodeURIComponent(scene.narration.trim())}`
          : undefined);

      if (!voiceUrl || !timing) continue;

      try {
        const resp = await fetch(voiceUrl);
        const arrayBuf = await resp.arrayBuffer();
        const decodedVoice = await offlineCtx.decodeAudioData(arrayBuf.slice(0));

        const voiceSource = offlineCtx.createBufferSource();
        voiceSource.buffer = decodedVoice;

        const voiceGain = offlineCtx.createGain();
        voiceGain.gain.setValueAtTime(1.0, timing.start);

        voiceSource.connect(voiceGain);
        voiceGain.connect(offlineCtx.destination);
        voiceSource.start(timing.start);
      } catch {
        // Ignore individual decode failure
      }
    }
  }

  // 3. Mix Motion-Synced Procedural Sound Effects (Whooshes, Pops, Impacts, Chimes)
  if (!sfxMuted && sfxVolume > 0) {
    try {
      renderSceneSfxIntoBuffer(offlineCtx, scenes, sceneTimings, sfxVolume);
    } catch {
      // Ignore if sfx synthesis encounters unexpected issue
    }
  }

  return await offlineCtx.startRendering();
}

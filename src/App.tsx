import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  Wand2,
  Mic,
  Music,
  Layers,
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Sliders,
  Grid,
  Captions,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  INITIAL_BENGALI_SCRIPT,
  INITIAL_SCENES,
  PROJECT_TEMPLATES,
  LYRIA_PRESET_PROMPTS,
  MotionScene,
  VisualType,
  AnimationStyle,
  CameraAngle,
  VoiceEmotion,
  VOICE_EMOTIONS,
  createProceduralSoundtrackWav,
} from './data/defaultProject';
import { MotionStage } from './components/MotionStage';
import {
  renderMixedMasterAudioBuffer,
  audioBufferToWavBlob,
} from './utils/mediaExporter';

type WorkspaceTab = 'script' | 'editor' | 'voiceover' | 'music' | 'templates';

const ACCENT_PALETTE = [
  '#F59E0B',
  '#38BDF8',
  '#10B981',
  '#A855F7',
  '#F43F5E',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
];

const VISUAL_TYPES: { value: VisualType; label: string }[] = [
  { value: 'kinetic-intro', label: '3D Prism & Orbit Rings' },
  { value: '3d-layers', label: 'Isometric 3D Layer Stack' },
  { value: 'no-editing-clock', label: 'Speed & Workflow Dial' },
  { value: 'script-to-voice', label: 'Script-to-Voice Neural Bridge' },
  { value: 'audio-sync', label: 'Beat-Locked Spectrum Sync' },
  { value: 'live-editor', label: 'Multi-Track Timeline Deck' },
];

const ANIMATION_STYLES: { value: AnimationStyle; label: string }[] = [
  { value: 'spring-pop', label: 'Spring Pop Physics' },
  { value: 'isometric-stack', label: 'Isometric Depth Float' },
  { value: '3d-orbit', label: '3D Orbital Rotation' },
  { value: 'kinetic-slide', label: 'Kinetic Velocity Slide' },
  { value: 'typewriter-glow', label: 'Progressive Reveal' },
];

const CAMERA_ANGLES: { value: CameraAngle; label: string }[] = [
  { value: 'isometric-tilt', label: 'Isometric Tilt' },
  { value: 'deep-perspective', label: 'Deep Perspective' },
  { value: 'front-cinematic', label: 'Front Cinematic' },
  { value: 'dynamic-pan', label: 'Dynamic Horizontal Pan' },
];

const VOICE_OPTIONS = [
  { name: 'Puck', desc: 'প্রাণবন্ত ও প্রফেশনাল পুরুষ উপস্থাপক (Lively Human Presenter)' },
  { name: 'Kore', desc: 'শান্ত, সুস্পষ্ট স্টুডিও নারী কণ্ঠ (Articulate Studio Voice)' },
  { name: 'Charon', desc: 'গম্ভীর ও প্রফেশনাল ব্রডকাস্টার (Deep Broadcast Voice)' },
  { name: 'Aoede', desc: 'উষ্ণ, আবেগপূর্ণ স্টোরিটেলার (Warm Storyteller Voice)' },
  { name: 'Fenrir', desc: 'দৃঢ় ও স্পষ্ট টেক ভয়েস (Confident Tech Narrator)' },
];

function base64ToBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export default function App() {
  // Workspace Navigation State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('script');

  // Project Script & Scenes State
  const [scriptText, setScriptText] = useState<string>(INITIAL_BENGALI_SCRIPT);
  const [stylePreset, setStylePreset] = useState<string>('3D Isometric & Kinetic');
  const [scenes, setScenes] = useState<MotionScene[]>(INITIAL_SCENES);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);

  // Playback & Timeline State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [show3DGrid, setShow3DGrid] = useState<boolean>(true);

  // Voiceover State
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [voiceStyle, setVoiceStyle] = useState<string>(
    'Clear, engaging, professional motion graphics narrator'
  );
  const [isGeneratingScenes, setIsGeneratingScenes] = useState<boolean>(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState<boolean>(false);
  const [voiceGeneratingSceneId, setVoiceGeneratingSceneId] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState<boolean>(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);

  // Music Generation State (Lyria 3)
  const [musicPrompt, setMusicPrompt] = useState<string>(
    LYRIA_PRESET_PROMPTS[0].prompt
  );
  const [lyriaModel, setLyriaModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>(
    'lyria-3-clip-preview'
  );
  const [isGeneratingMusic, setIsGeneratingMusic] = useState<boolean>(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string>('');
  const [musicTrackTitle, setMusicTrackTitle] = useState<string>(
    'Modern Motion Synth (120 BPM)'
  );
  const [musicLyrics, setMusicLyrics] = useState<string>('');
  const [musicMuted, setMusicMuted] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.35);

  // Export & Notification State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [templateSearch, setTemplateSearch] = useState<string>('');

  // Refs for Canvas & Audio Elements
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTimeRef = useRef<number>(0);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedSceneIdRef = useRef<string | null>(null);
  const preloadedAudioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const seekToTime = (newTime: number) => {
    currentTimeRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying && !voiceMuted && !isExporting) {
      for (let i = 0; i < sceneTimings.length; i++) {
        const slot = sceneTimings[i];
        if (newTime >= slot.start && newTime < slot.end) {
          lastPlayedSceneIdRef.current = scenes[i]?.id || null;
          playVoiceForScene(scenes[i], newTime - slot.start);
          break;
        }
      }
    }
  };

  const getSceneAudioUrl = (scene: MotionScene | undefined): string | null => {
    if (!scene) return null;
    if (scene.voiceAudioUrl) return scene.voiceAudioUrl;
    if (scene.narration && /[\u0980-\u09FF]/.test(scene.narration)) {
      return `/api/bengali-tts?text=${encodeURIComponent(scene.narration.trim())}`;
    }
    return null;
  };

  // Pre-buffer scene voiceover Audio objects so scene transitions never stutter loading audio
  useEffect(() => {
    scenes.forEach((s) => {
      const url = getSceneAudioUrl(s);
      if (url && !preloadedAudioMapRef.current.has(url)) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.load();
        preloadedAudioMapRef.current.set(url, audio);
      }
    });
  }, [scenes]);

  // Initialize default procedural backing track on mount so playback immediately has music ready
  useEffect(() => {
    const initialUrl = createProceduralSoundtrackWav(24, 'upbeat');
    setMusicAudioUrl(initialUrl);
    return () => {
      URL.revokeObjectURL(initialUrl);
    };
  }, []);

  // Total duration and cumulative scene start times
  const sceneTimings = useMemo(() => {
    let accumulated = 0;
    return scenes.map((scene) => {
      const start = accumulated;
      const end = accumulated + scene.duration;
      accumulated = end;
      return { start, end, duration: scene.duration };
    });
  }, [scenes]);

  const totalDuration = useMemo(() => {
    return sceneTimings.length > 0 ? sceneTimings[sceneTimings.length - 1].end : 0;
  }, [sceneTimings]);

  // Determine active scene and progress from `currentTime`
  const activePlaybackState = useMemo(() => {
    if (scenes.length === 0) {
      return { index: 0, progress: 0 };
    }
    for (let i = 0; i < sceneTimings.length; i++) {
      const { start, end, duration } = sceneTimings[i];
      if (currentTime >= start && currentTime < end) {
        return {
          index: i,
          progress: Math.max(0, Math.min(1, (currentTime - start) / duration)),
        };
      }
    }
    return { index: scenes.length - 1, progress: 1 };
  }, [currentTime, sceneTimings, scenes.length]);

  const currentScene = scenes[selectedSceneIndex] || scenes[0];
  const stageSceneIndex = isPlaying ? activePlaybackState.index : selectedSceneIndex;
  const stageScene = scenes[stageSceneIndex] || scenes[0];

  // Sync Background Music Element with `isPlaying`
  useEffect(() => {
    const musicEl = musicAudioRef.current;
    if (!musicEl || !musicAudioUrl) return;
    musicEl.volume = musicMuted ? 0 : musicVolume;
    if (isPlaying && !isExporting) {
      musicEl.play().catch(() => {});
    } else {
      musicEl.pause();
    }
  }, [isPlaying, isExporting, musicAudioUrl, musicMuted, musicVolume]);

  // Sync voice volume to all cached audio instances
  useEffect(() => {
    preloadedAudioMapRef.current.forEach((audio) => {
      audio.volume = voiceMuted ? 0 : voiceVolume;
    });
  }, [voiceMuted, voiceVolume]);

  const speakWithBrowserSynthesis = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const hasBengali = /[\u0980-\u09FF]/.test(text);
    utterance.lang = hasBengali ? 'bn-BD' : 'en-US';

    const voices = window.speechSynthesis.getVoices();
    if (hasBengali) {
      const bnVoice = voices.find(
        (v) =>
          v.lang.startsWith('bn') ||
          v.name.toLowerCase().includes('bangla') ||
          v.name.toLowerCase().includes('bengali')
      );
      if (bnVoice) utterance.voice = bnVoice;
    }
    utterance.volume = voiceMuted ? 0 : voiceVolume;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const playVoiceForScene = (scene: MotionScene | undefined, offsetSec = 0) => {
    if (!scene || !isPlaying || voiceMuted || isExporting || voiceVolume <= 0) return;

    // Cancel any previous browser speech
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const effectiveAudioUrl = getSceneAudioUrl(scene);

    // Pause all other playing cached audio
    preloadedAudioMapRef.current.forEach((audio, url) => {
      if (url !== effectiveAudioUrl && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    if (effectiveAudioUrl) {
      let cachedAudio = preloadedAudioMapRef.current.get(effectiveAudioUrl);
      if (!cachedAudio) {
        cachedAudio = new Audio(effectiveAudioUrl);
        preloadedAudioMapRef.current.set(effectiveAudioUrl, cachedAudio);
      }
      cachedAudio.volume = voiceVolume;
      cachedAudio.currentTime = Math.max(0, offsetSec);
      cachedAudio.play().catch(() => {});
    } else if (scene.narration) {
      // If Studio WAV is not generated yet, automatically speak the narration via browser TTS!
      speakWithBrowserSynthesis(scene.narration);
    }
  };

  // Trigger voice whenever Play starts or resumes
  useEffect(() => {
    if (isPlaying && !voiceMuted && !isExporting) {
      const currentIdx = stageSceneIndex;
      const curScene = scenes[currentIdx];
      const slot = sceneTimings[currentIdx];
      const offset = slot ? Math.max(0, currentTimeRef.current - slot.start) : 0;
      lastPlayedSceneIdRef.current = curScene?.id || null;
      playVoiceForScene(curScene, offset);
    }
  }, [isPlaying]);

  // Stop voiceover when paused or muted
  useEffect(() => {
    if (!isPlaying || voiceMuted || isExporting) {
      preloadedAudioMapRef.current.forEach((audio) => {
        audio.pause();
      });
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      lastPlayedSceneIdRef.current = null;
    }
  }, [isPlaying, voiceMuted, isExporting]);

  // Gapless Scene Transition Callback triggered directly from MotionStage 60FPS loop
  const handleStageSceneChange = (newIdx: number) => {
    setSelectedSceneIndex(newIdx);
    if (!isPlaying || voiceMuted || isExporting) return;

    const nextScene = scenes[newIdx];
    if (!nextScene || lastPlayedSceneIdRef.current === nextScene.id) return;
    lastPlayedSceneIdRef.current = nextScene.id;

    playVoiceForScene(nextScene, 0);
  };

  // Handler: Generate Motion Graphics Scenes from Script using Gemini 4 Argon
  const handleGenerateScenesFromScript = async () => {
    if (!scriptText.trim()) {
      setStatusBanner({
        type: 'error',
        message: 'অনুগ্রহ করে প্রথমে একটি স্ক্রিপ্ট লিখুন (Please enter a script first).',
      });
      return;
    }

    setIsGeneratingScenes(true);
    setStatusBanner({
      type: 'info',
      message: 'AI আপনার স্ক্রিপ্ট বিশ্লেষণ করে 2D ও 3D মোশন গ্রাফিক্স সিন তৈরি করছে...',
    });

    try {
      const response = await fetch('/api/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptText,
          stylePreset,
        }),
      });
      const data = await response.json();

      if (!response.ok || !Array.isArray(data.scenes) || data.scenes.length === 0) {
        throw new Error(data.error || 'Could not generate scenes.');
      }

      setScenes(data.scenes);
      setSelectedSceneIndex(0);
      seekToTime(0);
      setIsPlaying(true);
      setStatusBanner({
        type: 'success',
        message: `${data.scenes.length}টি মোশন গ্রাফিক্স সিন সফলভাবে তৈরি হয়েছে!`,
      });
    } catch (error: any) {
      setStatusBanner({
        type: 'error',
        message: error?.message || 'Scene generation failed.',
      });
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  // Handler: Generate AI Voiceover for a single scene
  const handleGenerateSceneVoiceover = async (sceneIndex: number) => {
    const targetScene = scenes[sceneIndex];
    if (!targetScene) return;

    const targetEmotion = targetScene.voiceEmotion || 'Energetic';

    setVoiceGeneratingSceneId(targetScene.id);
    setStatusBanner({
      type: 'info',
      message: `সিন ${sceneIndex + 1}-এর জন্য AI ভয়েসওভার তৈরি হচ্ছে (${selectedVoice} - ${targetEmotion})...`,
    });

    try {
      const response = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: targetScene.narration,
          voiceName: selectedVoice,
          style: voiceStyle,
          emotion: targetEmotion,
        }),
      });
      const data = await response.json();

      if (data.rateLimited || !data.audioBase64) {
        const fallbackUrl = /[\u0980-\u09FF]/.test(targetScene.narration)
          ? `/api/bengali-tts?text=${encodeURIComponent(targetScene.narration)}`
          : undefined;

        if (fallbackUrl) {
          setScenes((prev) =>
            prev.map((s, idx) => (idx === sceneIndex ? { ...s, voiceAudioUrl: fallbackUrl } : s))
          );
          playVoiceForScene({ ...targetScene, voiceAudioUrl: fallbackUrl }, 0);
          setStatusBanner({
            type: 'success',
            message: `সিন ${sceneIndex + 1}-এর জন্য নিখুঁত বাংলা ভয়েসওভার সংযুক্ত করা হয়েছে (${targetEmotion})!`,
          });
        } else {
          speakWithBrowserSynthesis(targetScene.narration);
          setStatusBanner({
            type: 'info',
            message: 'ব্রাউজারের ভয়েস ইঞ্জিন দিয়ে ভয়েসওভার চালানো হচ্ছে।',
          });
        }
        return;
      }

      const wavUrl = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');

      // Measure actual audio duration to lock scene duration tightly to spoken narration
      const tempAudio = new Audio(wavUrl);
      await new Promise<void>((resolve) => {
        tempAudio.onloadedmetadata = () => resolve();
        tempAudio.onerror = () => resolve();
      });
      const exactDuration =
        tempAudio.duration && isFinite(tempAudio.duration) && tempAudio.duration > 1.2
          ? Number(tempAudio.duration.toFixed(2))
          : targetScene.duration;

      setScenes((prev) =>
        prev.map((s, idx) =>
          idx === sceneIndex
            ? { ...s, voiceAudioUrl: wavUrl, duration: exactDuration }
            : s
        )
      );

      setStatusBanner({
        type: 'success',
        message: `সিন ${sceneIndex + 1}-এর ভয়েসওভার তৈরি ও অ্যানিমেশনের সাথে সিঙ্ক করা হয়েছে (${exactDuration}s - ${targetEmotion})!`,
      });
    } catch (error: any) {
      setStatusBanner({
        type: 'error',
        message: error?.message || 'AI Voiceover generation failed.',
      });
    } finally {
      setVoiceGeneratingSceneId(null);
    }
  };

  // Handler: Generate AI Voiceover for ALL scenes in a SINGLE batch request (avoids 429 rate limits!)
  const handleGenerateAllVoiceovers = async () => {
    setIsGeneratingVoice(true);
    setIsPlaying(false);
    setStatusBanner({
      type: 'info',
      message: `একক ব্যাচ রিকোয়েস্টে সবগুলো সিনের (${scenes.length}টি সিন) AI ভয়েসওভার তৈরি হচ্ছে...`,
    });

    try {
      const response = await fetch('/api/generate-batch-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrations: scenes.map((s) => s.narration),
          voiceName: selectedVoice,
          style: voiceStyle,
          emotions: scenes.map((s) => s.voiceEmotion || 'Energetic'),
        }),
      });
      const data = await response.json();

      if (data.rateLimited || !Array.isArray(data.audioSegments)) {
        const hasBengali = scenes.some((s) => /[\u0980-\u09FF]/.test(s.narration));
        if (hasBengali) {
          setScenes((prev) =>
            prev.map((s) => ({
              ...s,
              voiceAudioUrl:
                s.voiceAudioUrl ||
                (/[\u0980-\u09FF]/.test(s.narration)
                  ? `/api/bengali-tts?text=${encodeURIComponent(s.narration.trim())}`
                  : undefined),
            }))
          );
          seekToTime(0);
          setIsPlaying(true);
          setStatusBanner({
            type: 'success',
            message: 'সবগুলো সিনের জন্য নিখুঁত বাংলা ভয়েসওভার সফলভাবে প্রস্তুত ও সিঙ্ক করা হয়েছে!',
          });
        } else {
          if (scenes[0]) {
            speakWithBrowserSynthesis(scenes.map((s) => s.narration).join(' '));
          }
          setIsPlaying(true);
          setStatusBanner({
            type: 'info',
            message: 'ব্রাউজার ভয়েস সিন্থেসিস চালু করা হয়েছে।',
          });
        }
        return;
      }

      const mime = data.mimeType || 'audio/wav';
      const updatedScenes = await Promise.all(
        scenes.map(async (scene, idx) => {
          const segBase64 = data.audioSegments[idx];
          if (!segBase64) return scene;
          const wavUrl = base64ToBlobUrl(segBase64, mime);
          const tempAudio = new Audio(wavUrl);
          await new Promise<void>((resolve) => {
            tempAudio.onloadedmetadata = () => resolve();
            tempAudio.onerror = () => resolve();
          });
          const exactDuration =
            tempAudio.duration && isFinite(tempAudio.duration) && tempAudio.duration > 1.2
              ? Number(tempAudio.duration.toFixed(2))
              : scene.duration;
          return {
            ...scene,
            voiceAudioUrl: wavUrl,
            duration: exactDuration,
          };
        })
      );

      setScenes(updatedScenes);
      seekToTime(0);
      setIsPlaying(true);
      setStatusBanner({
        type: 'success',
        message: `সবগুলো সিনের (${updatedScenes.length}টি সিন) ভয়েসওভার মাত্র ১টি কলের মাধ্যমে তৈরি ও অ্যানিমেশনের সাথে সিঙ্ক হয়েছে!`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'ভয়েসওভার তৈরি করা যায়নি।',
      });
    } finally {
      setVoiceGeneratingSceneId(null);
      setIsGeneratingVoice(false);
    }
  };

  // Handler: Generate AI Background Music using Lyria (`lyria-3-clip-preview` or `lyria-3-pro-preview`)
  const handleGenerateLyriaMusic = async () => {
    if (!musicPrompt.trim()) return;
    setIsGeneratingMusic(true);
    setStatusBanner({
      type: 'info',
      message: `${lyriaModel} ব্যবহার করে ব্যাকগ্রাউন্ড মিউজিক তৈরি হচ্ছে...`,
    });

    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: lyriaModel,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.audioBase64) {
        throw new Error(
          data.error ||
            'Lyria music generation requires a paid API key. Switched to Studio Synth Engine.'
        );
      }

      const blobUrl = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
      setMusicAudioUrl(blobUrl);
      setMusicTrackTitle(`Lyria AI: ${musicPrompt.slice(0, 32)}...`);
      setMusicLyrics(data.lyrics || '');
      setStatusBanner({
        type: 'success',
        message: `${lyriaModel} দিয়ে নতুন ব্যাকগ্রাউন্ড মিউজিক সফলভাবে তৈরি হয়েছে!`,
      });
    } catch (error: any) {
      // Synthesize a new procedural studio track so the user still gets fresh music immediately
      const fallbackStyle = musicPrompt.toLowerCase().includes('cinematic')
        ? 'cinematic'
        : musicPrompt.toLowerCase().includes('lo-fi')
        ? 'lofi'
        : 'upbeat';
      const synthUrl = createProceduralSoundtrackWav(24, fallbackStyle);
      setMusicAudioUrl(synthUrl);
      setMusicTrackTitle(`Studio Synth (${fallbackStyle.toUpperCase()}): ${musicPrompt.slice(0, 24)}...`);
      setStatusBanner({
        type: 'info',
        message: `${error?.message || 'Lyria API error.'} — বিল্ট-ইন স্টুডিও সিন্থ ইঞ্জিন দিয়ে মিউজিক ট্র্যাক জেনারেট করা হয়েছে।`,
      });
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  // Scene Editing Helpers
  const updateSelectedScene = (patch: Partial<MotionScene>) => {
    setScenes((prev) =>
      prev.map((scene, idx) => {
        if (idx !== selectedSceneIndex) return scene;
        const updated = { ...scene, ...patch };
        if (patch.narration && patch.narration !== scene.narration) {
          if (/[\u0980-\u09FF]/.test(patch.narration)) {
            updated.voiceAudioUrl = `/api/bengali-tts?text=${encodeURIComponent(patch.narration.trim())}`;
          }
        }
        return updated;
      })
    );
  };

  const handleAddScene = () => {
    const defaultText = 'নতুন সিনের ভয়েসওভার স্ক্রিপ্ট এখানে লিখুন।';
    const newScene: MotionScene = {
      id: `scene-${Date.now()}`,
      narration: defaultText,
      headline: 'নতুন মোশন গ্রাফিক্স সিন',
      subheadline: 'আপনার পছন্দমতো টেক্সট ও অ্যানিমেশন পরিবর্তন করুন',
      visualType: '3d-layers',
      animationStyle: 'spring-pop',
      accentColor: ACCENT_PALETTE[scenes.length % ACCENT_PALETTE.length],
      duration: 4.5,
      floatingElements: ['2D অ্যানিমেশন', '3D লেয়ার', 'কাস্টম ইফেক্ট'],
      cameraAngle: 'isometric-tilt',
      voiceAudioUrl: `/api/bengali-tts?text=${encodeURIComponent(defaultText)}`,
    };
    const nextScenes = [...scenes];
    nextScenes.splice(selectedSceneIndex + 1, 0, newScene);
    setScenes(nextScenes);
    setSelectedSceneIndex(selectedSceneIndex + 1);
  };

  const handleDuplicateScene = () => {
    if (!currentScene) return;
    const copy: MotionScene = {
      ...currentScene,
      id: `scene-${Date.now()}`,
      floatingElements: [...currentScene.floatingElements],
    };
    const nextScenes = [...scenes];
    nextScenes.splice(selectedSceneIndex + 1, 0, copy);
    setScenes(nextScenes);
    setSelectedSceneIndex(selectedSceneIndex + 1);
  };

  const handleDeleteScene = (idx: number) => {
    if (scenes.length <= 1) return;
    const nextScenes = scenes.filter((_, i) => i !== idx);
    setScenes(nextScenes);
    setSelectedSceneIndex(Math.max(0, Math.min(selectedSceneIndex, nextScenes.length - 1)));
  };

  // Download standalone mixed Master Audio (.wav) (Voiceover + Music)
  const handleDownloadMasterAudioWav = async (
    customScenes = scenes,
    customTimings = sceneTimings,
    customTotal = totalDuration
  ) => {
    try {
      const mixedBuffer = await renderMixedMasterAudioBuffer({
        scenes: customScenes,
        sceneTimings: customTimings,
        totalDuration: customTotal,
        musicAudioUrl,
        musicVolume,
        voiceMuted,
        musicMuted,
      });
      const wavBlob = audioBufferToWavBlob(mixedBuffer);
      const wavUrl = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = wavUrl;
      a.download = `kinetix-master-audio-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export WAV:', err);
    }
  };

  // Real Multiplexed Video + Audio Export (.webm with embedded Opus audio + optional .wav bundle)
  const handleExportVideo = async (alsoDownloadSeparateWav = false) => {
    const canvas = canvasRef.current;
    if (!canvas || isExporting) return;

    setIsExporting(true);
    setExportProgress(2);
    setIsPlaying(false);

    // Pause background HTML audio elements during dedicated export render so they don't double-play
    if (voiceAudioRef.current) voiceAudioRef.current.pause();
    if (musicAudioRef.current) musicAudioRef.current.pause();

    let exportScenes = scenes;

    // Step 1: If no scene has a generated WAV voiceover yet and voice is not muted, try 1 batch call first
    const hasAnyVoiceWav = exportScenes.some((s) => Boolean(s.voiceAudioUrl));
    if (!hasAnyVoiceWav && !voiceMuted) {
      setStatusBanner({
        type: 'info',
        message: 'এক্সপোর্টের জন্য AI ভয়েসওভার অডিও প্রস্তুত করা হচ্ছে (১/২)...',
      });
      try {
        const voRes = await fetch('/api/generate-batch-voiceover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            narrations: exportScenes.map((s) => s.narration),
            voiceName: selectedVoice,
            style: voiceStyle,
          }),
        });
        const voData = await voRes.json();
        if (!voData.rateLimited && Array.isArray(voData.audioSegments)) {
          const mime = voData.mimeType || 'audio/wav';
          exportScenes = await Promise.all(
            exportScenes.map(async (scene, idx) => {
              const segBase64 = voData.audioSegments[idx];
              if (!segBase64) return scene;
              const wavUrl = base64ToBlobUrl(segBase64, mime);
              const tempAudio = new Audio(wavUrl);
              await new Promise<void>((resolve) => {
                tempAudio.onloadedmetadata = () => resolve();
                tempAudio.onerror = () => resolve();
              });
              const exactDuration =
                tempAudio.duration && isFinite(tempAudio.duration) && tempAudio.duration > 1.5
                  ? Number((tempAudio.duration + 0.4).toFixed(1))
                  : scene.duration;
              return {
                ...scene,
                voiceAudioUrl: wavUrl,
                duration: exactDuration,
              };
            })
          );
          setScenes(exportScenes);
        }
      } catch {
        // Proceed with existing scenes and background music
      }
    }

    // Recompute timings in case voiceover durations updated
    let acc = 0;
    const exportTimings = exportScenes.map((s) => {
      const start = acc;
      const end = acc + s.duration;
      acc = end;
      return { start, end, duration: s.duration };
    });
    const exportTotalDuration =
      exportTimings.length > 0 ? exportTimings[exportTimings.length - 1].end : totalDuration;

    setStatusBanner({
      type: 'info',
      message: 'ভিডিও এবং অডিও (ভয়েসওভার + মিউজিক) একসাথে মিক্স ও রেকর্ড করা হচ্ছে...',
    });

    let liveAudioCtx: AudioContext | null = null;

    try {
      // Step 2: Render sample-accurate Master AudioBuffer (Voiceover + Background Music)
      const masterAudioBuffer = await renderMixedMasterAudioBuffer({
        scenes: exportScenes,
        sceneTimings: exportTimings,
        totalDuration: exportTotalDuration,
        musicAudioUrl,
        musicVolume,
        voiceMuted,
        musicMuted,
      });

      // Step 3: Route Master AudioBuffer into a live MediaStreamAudioDestinationNode
      liveAudioCtx = new AudioContext({ sampleRate: 24000 });
      const streamDest = liveAudioCtx.createMediaStreamDestination();
      const masterSource = liveAudioCtx.createBufferSource();
      masterSource.buffer = masterAudioBuffer;
      masterSource.connect(streamDest);
      // Also connect to speakers at gentle volume so the user can monitor the export live
      const monitorGain = liveAudioCtx.createGain();
      monitorGain.gain.value = 0.5;
      masterSource.connect(monitorGain);
      monitorGain.connect(liveAudioCtx.destination);

      // Step 4: Combine Canvas 30fps Video Track + Mixed Audio Track into ONE MediaStream
      const canvasVideoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasVideoStream.getVideoTracks(),
        ...streamDest.stream.getAudioTracks(),
      ]);

      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const chosenMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: chosenMime,
        videoBitsPerSecond: 6000000,
        audioBitsPerSecond: 128000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Step 5: Start synchronized playback & recording from 0.0s
      seekToTime(0);
      setIsPlaying(true);
      recorder.start(200);
      masterSource.start(0);

      const recordDurationMs = exportTotalDuration * 1000;
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const elapsed = performance.now() - startTime;
          const pct = Math.min(99, Math.round((elapsed / recordDurationMs) * 100));
          setExportProgress(pct);
          if (elapsed >= recordDurationMs) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      masterSource.stop();

      // Step 6: Download the Combined Video + Audio (.webm) file
      const videoBlob = new Blob(chunks, { type: chosenMime });
      const downloadUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `kinetix-video-with-audio-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Step 7: If user requested both Video (.webm) and standalone Audio (.wav) files together
      if (alsoDownloadSeparateWav) {
        const wavBlob = audioBufferToWavBlob(masterAudioBuffer);
        const wavUrl = URL.createObjectURL(wavBlob);
        const wavLink = document.createElement('a');
        wavLink.href = wavUrl;
        wavLink.download = `kinetix-master-audio-${Date.now()}.wav`;
        document.body.appendChild(wavLink);
        wavLink.click();
        document.body.removeChild(wavLink);
      }

      setExportProgress(100);
      setStatusBanner({
        type: 'success',
        message: alsoDownloadSeparateWav
          ? 'ভিডিও+অডিও (.webm) এবং মাস্টার অডিও (.wav) দুটি ফাইলই একসাথে ডাউনলোড হয়েছে!'
          : 'ভিডিও এবং অডিও একসাথে (.webm ফাইলে) সফলভাবে ডাউনলোড হয়েছে!',
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Video + Audio export encountered an error.',
      });
    } finally {
      if (liveAudioCtx) {
        liveAudioCtx.close().catch(() => {});
      }
      setIsExporting(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return PROJECT_TEMPLATES;
    const q = templateSearch.toLowerCase();
    return PROJECT_TEMPLATES.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.language.toLowerCase().includes(q)
    );
  }, [templateSearch]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      {/* Hidden Audio Elements for Voiceover & Background Music */}
      <audio ref={voiceAudioRef} className="hidden" />
      <audio ref={musicAudioRef} src={musicAudioUrl || undefined} loop className="hidden" />

      {/* Top Navigation Bar — Strict 3-Zone Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/90 bg-[#0B0F17]">
        {/* Zone 1: Brand Title (single text element) */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('script');
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Kinetix Studio
        </a>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('script')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'script'
                ? 'text-white border-b-2 border-amber-500'
                : ''
            }`}
          >
            Script & AI
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'editor'
                ? 'text-white border-b-2 border-amber-500'
                : ''
            }`}
          >
            Scene Editor
          </button>
          <button
            onClick={() => setActiveTab('voiceover')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'voiceover'
                ? 'text-white border-b-2 border-amber-500'
                : ''
            }`}
          >
            Voiceover
          </button>
          <button
            onClick={() => setActiveTab('music')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'music'
                ? 'text-white border-b-2 border-amber-500'
                : ''
            }`}
          >
            Music Studio
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'templates'
                ? 'text-white border-b-2 border-amber-500'
                : ''
            }`}
          >
            Templates
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleExportVideo(false)}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting {exportProgress}%</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Video + Audio</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Status Notification Bar (when active) */}
      {statusBanner && (
        <div
          className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
            statusBanner.type === 'error'
              ? 'bg-rose-950/60 border-rose-800/60 text-rose-200'
              : statusBanner.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
              : 'bg-amber-950/50 border-amber-800/50 text-amber-200'
          }`}
        >
          <span>{statusBanner.message}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-white ml-4 whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Workspace Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Control & Inspector Column (5 cols on 1440px desktop) */}
        <aside className="lg:col-span-5 border-r border-slate-800/90 bg-[#0E131F] flex flex-col">
          {/* Segmented Mode Switcher for Mobile & Quick Access */}
          <div className="p-3 border-b border-slate-800/80 flex items-center gap-1 bg-[#0B0F17]">
            {[
              { id: 'script', label: 'স্ক্রিপ্ট ও AI', icon: FileText },
              { id: 'editor', label: 'সিন এডিটর', icon: Sliders },
              { id: 'voiceover', label: 'ভয়েসওভার', icon: Mic },
              { id: 'music', label: 'মিউজিক (Lyria)', icon: Music },
              { id: 'templates', label: 'টেমপ্লেট', icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                  className={`flex-1 py-2 px-2.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-amber-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Left Panel Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: SCRIPT & AI GENERATOR */}
            {activeTab === 'script' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold text-white">
                      01. মোশন গ্রাফিক্স স্ক্রিপ্ট (Script to Motion Video)
                    </h2>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {scenes.length} Scenes · {totalDuration.toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    আপনার পছন্দমতো বাংলা বা ইংরেজি স্ক্রিপ্ট লিখুন। AI স্বয়ংক্রিয়ভাবে প্রতিটি বাক্যের জন্য 2D ও 3D অ্যানিমেশন, টেক্সট ইফেক্ট এবং ভিজ্যুয়াল তৈরি করবে।
                  </p>
                  <textarea
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    rows={7}
                    placeholder="আপনার মোশন গ্রাফিক্স ভিডিওর স্ক্রিপ্ট এখানে লিখুন..."
                    className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 p-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed resize-y"
                  />
                </div>

                {/* Visual Direction Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    ভিজ্যুয়াল অ্যানিমেশন স্টাইল (Motion Direction)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      '3D Isometric & Kinetic',
                      'Minimal Tech Explainer',
                      'Dynamic Broadcast Promo',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setStylePreset(preset)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors truncate cursor-pointer ${
                          stylePreset === preset
                            ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                            : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary AI Generation Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={handleGenerateScenesFromScript}
                    disabled={isGeneratingScenes}
                    className="py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGeneratingScenes ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>সিন তৈরি হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>AI দিয়ে সিন তৈরি করুন</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleGenerateAllVoiceovers}
                    disabled={isGeneratingVoice}
                    className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-100 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGeneratingVoice ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>ভয়েসওভার তৈরি হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-amber-400" />
                        <span>সব সিনের AI ভয়েসওভার</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Scene Breakdown List */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      স্ক্রিপ্ট অনুযায়ী মোশন সিন তালিকা (Click to Inspect & Edit)
                    </span>
                    <button
                      onClick={handleAddScene}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>নতুন সিন</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {scenes.map((s, idx) => {
                      const isSelected = idx === selectedSceneIndex;
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSceneIndex(idx);
                            seekToTime(sceneTimings[idx]?.start || 0);
                          }}
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-slate-800/90 border-amber-500/80'
                              : 'bg-[#0B0F17] border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-xs shrink-0"
                                style={{ backgroundColor: s.accentColor }}
                              />
                              <span className="text-xs font-semibold text-white truncate">
                                {String(idx + 1).padStart(2, '0')}. {s.headline}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums shrink-0">
                              <span>{s.visualType}</span>
                              <span aria-hidden="true">·</span>
                              <span>{s.duration.toFixed(1)}s</span>
                              {s.voiceAudioUrl && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-400">TTS Ready</span>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {s.narration}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              {s.floatingElements.join(' · ')}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSceneIndex(idx);
                                setActiveTab('editor');
                              }}
                              className="text-xs font-medium text-amber-400 hover:underline whitespace-nowrap shrink-0"
                            >
                              এডিট করুন
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SCENE EDITOR (Post-generation full customization) */}
            {activeTab === 'editor' && currentScene && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      02. সিন কাস্টমাইজেশন (Scene {selectedSceneIndex + 1} of {scenes.length})
                    </h2>
                    <p className="text-xs text-slate-400">
                      ভিডিও তৈরি হওয়ার পরেও নিজের পছন্দমতো টেক্সট, 2D/3D ভিজ্যুয়াল ও কালার এডিট করুন
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleDuplicateScene}
                      title="Duplicate Scene"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteScene(selectedSceneIndex)}
                      disabled={scenes.length <= 1}
                      title="Delete Scene"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 disabled:opacity-40 text-slate-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scene Switcher Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {scenes.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSceneIndex(idx);
                        seekToTime(sceneTimings[idx]?.start || 0);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium tabular-nums whitespace-nowrap shrink-0 cursor-pointer ${
                        idx === selectedSceneIndex
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-[#0B0F17] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Scene {idx + 1}
                    </button>
                  ))}
                </div>

                {/* Kinetic Headline & Subheadline */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      কাইনেটিক হেডলাইন (Main On-Screen Headline)
                    </label>
                    <input
                      type="text"
                      value={currentScene.headline}
                      onChange={(e) => updateSelectedScene({ headline: e.target.value })}
                      className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      সাব-হেডলাইন (Supporting Visual Caption)
                    </label>
                    <input
                      type="text"
                      value={currentScene.subheadline}
                      onChange={(e) => updateSelectedScene({ subheadline: e.target.value })}
                      className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      ভয়েসওভার এবং সাবটাইটেল স্ক্রিপ্ট (Spoken Narration)
                    </label>
                    <textarea
                      rows={3}
                      value={currentScene.narration}
                      onChange={(e) => updateSelectedScene({ narration: e.target.value })}
                      className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>
                </div>

                {/* 2D & 3D Visual Template + Animation Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      2D / 3D ভিজ্যুয়াল কম্পোজিশন
                    </label>
                    <select
                      value={currentScene.visualType}
                      onChange={(e) =>
                        updateSelectedScene({ visualType: e.target.value as VisualType })
                      }
                      className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {VISUAL_TYPES.map((vt) => (
                        <option key={vt.value} value={vt.value}>
                          {vt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      অ্যানিমেশন ইফেক্ট (Motion Physics)
                    </label>
                    <select
                      value={currentScene.animationStyle}
                      onChange={(e) =>
                        updateSelectedScene({
                          animationStyle: e.target.value as AnimationStyle,
                        })
                      }
                      className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {ANIMATION_STYLES.map((as) => (
                        <option key={as.value} value={as.value}>
                          {as.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Camera Angle & Scene Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      3D ক্যামেরা অ্যাঙ্গেল
                    </label>
                    <select
                      value={currentScene.cameraAngle}
                      onChange={(e) =>
                        updateSelectedScene({ cameraAngle: e.target.value as CameraAngle })
                      }
                      className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {CAMERA_ANGLES.map((ca) => (
                        <option key={ca.value} value={ca.value}>
                          {ca.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        সিনের সময়কাল (Duration)
                      </label>
                      <span className="text-xs font-mono text-amber-400 tabular-nums">
                        {currentScene.duration.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2.5}
                      max={10.0}
                      step={0.1}
                      value={currentScene.duration}
                      onChange={(e) =>
                        updateSelectedScene({ duration: parseFloat(e.target.value) })
                      }
                      className="w-full accent-amber-500 cursor-pointer mt-1.5"
                    />
                  </div>
                </div>

                {/* Voice Emotion Selector for Scene */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>সিনের ভয়েস ইমোশন (Voice Emotion)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {VOICE_EMOTIONS.find((v) => v.value === (currentScene.voiceEmotion || 'Energetic'))?.desc}
                    </span>
                  </div>
                  <select
                    value={currentScene.voiceEmotion || 'Energetic'}
                    onChange={(e) =>
                      updateSelectedScene({ voiceEmotion: e.target.value as VoiceEmotion })
                    }
                    className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-xs text-amber-200 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {VOICE_EMOTIONS.map((ve) => (
                      <option key={ve.value} value={ve.value} className="bg-slate-900 text-white">
                        {ve.icon} {ve.label} — {ve.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Floating 3D Layer Callout Labels */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    ফ্লোটিং 3D কলআউট লেয়ার (Floating Scene Callouts)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((elemIdx) => (
                      <input
                        key={elemIdx}
                        type="text"
                        value={currentScene.floatingElements[elemIdx] || ''}
                        onChange={(e) => {
                          const next = [...currentScene.floatingElements];
                          next[elemIdx] = e.target.value;
                          updateSelectedScene({ floatingElements: next });
                        }}
                        placeholder={`লেয়ার ${elemIdx + 1}`}
                        className="rounded-lg bg-[#0B0F17] border border-slate-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    ))}
                  </div>
                </div>

                {/* Scene Accent Color Picker */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    সিনের অ্যাকসেন্ট কালার (Scene Accent Theme)
                  </label>
                  <div className="flex items-center gap-2.5">
                    {ACCENT_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updateSelectedScene({ accentColor: hex })}
                        className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center cursor-pointer ${
                          currentScene.accentColor.toLowerCase() === hex.toLowerCase()
                            ? 'scale-110 ring-2 ring-white'
                            : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {currentScene.accentColor.toLowerCase() === hex.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: AI VOICEOVER STUDIO (gemini-3.8-flash-lite-tts) */}
            {activeTab === 'voiceover' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">
                    03. প্রফেশনাল AI ভয়েসওভার (Gemini Neural TTS)
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    স্ক্রিপ্টের প্রতিটি সিনের জন্য ২৪ kHz স্টুডিও কোয়ালিটি ভয়েসওভার তৈরি করুন। ভয়েসওভারের দৈর্ঘ্যের সাথে মোশন গ্রাফিক্স স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।
                  </p>
                </div>

                {/* Voice Persona Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    ভয়েস আর্টিস্ট প্রোফাইল (Select Voice Persona)
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {VOICE_OPTIONS.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => setSelectedVoice(v.name)}
                        className={`p-3 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                          selectedVoice === v.name
                            ? 'bg-amber-500/15 border-amber-500 text-white'
                            : 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{v.name}</div>
                          <div className="text-xs text-slate-400">{v.desc}</div>
                        </div>
                        <span className="text-xs font-mono text-amber-400">24kHz WAV</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speaking Style Direction */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ভয়েস ডেলিভারি স্টাইল (Narration Style)
                  </label>
                  <input
                    type="text"
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  onClick={handleGenerateAllVoiceovers}
                  disabled={isGeneratingVoice}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isGeneratingVoice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>সবগুলো সিনের ভয়েসওভার তৈরি হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>সম্পূর্ণ ভিডিওর AI ভয়েসওভার তৈরি করুন</span>
                    </>
                  )}
                </button>

                {/* Per-Scene Voiceover Triggers */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 block">
                      সিন অনুযায়ী আলাদা ভয়েসওভার ও ইমোশন কন্ট্রোল
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Per-Scene Voice Emotion
                    </span>
                  </div>

                  {scenes.map((s, idx) => {
                    const currentEmotion = s.voiceEmotion || 'Energetic';
                    const emotionMeta =
                      VOICE_EMOTIONS.find((v) => v.value === currentEmotion) ||
                      VOICE_EMOTIONS[0];

                    return (
                      <div
                        key={s.id}
                        className="p-3.5 rounded-xl bg-[#0B0F17] border border-slate-800 hover:border-slate-700/80 transition-colors space-y-2.5"
                      >
                        {/* Top row: Scene Info, Emotion Badge & Action Buttons */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-amber-400 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-medium text-white truncate">
                              {s.headline}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-medium ${emotionMeta.badgeClass}`}
                            >
                              {emotionMeta.icon} {emotionMeta.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {s.voiceAudioUrl && (
                              <button
                                onClick={() => {
                                  const audio = new Audio(s.voiceAudioUrl);
                                  audio.play();
                                }}
                                className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-medium hover:bg-emerald-900/80 cursor-pointer whitespace-nowrap"
                              >
                                Play WAV
                              </button>
                            )}
                            <button
                              onClick={() => handleGenerateSceneVoiceover(idx)}
                              disabled={voiceGeneratingSceneId === s.id}
                              className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              {voiceGeneratingSceneId === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>{s.voiceAudioUrl ? 'Regenerate' : 'Generate'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Spoken Narration Script Preview */}
                        <div className="text-xs text-slate-300 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-900 leading-relaxed">
                          {s.narration}
                        </div>

                        {/* Bottom Row: Voice Emotion Dropdown */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900/80">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1 shrink-0">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Voice Emotion:</span>
                            </label>
                            <select
                              value={currentEmotion}
                              onChange={(e) => {
                                const newEmotion = e.target.value as VoiceEmotion;
                                setScenes((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, voiceEmotion: newEmotion } : item
                                  )
                                );
                              }}
                              className="rounded-md bg-slate-900 border border-slate-700 hover:border-amber-500/60 px-2.5 py-1 text-xs text-amber-200 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            >
                              {VOICE_EMOTIONS.map((ve) => (
                                <option
                                  key={ve.value}
                                  value={ve.value}
                                  className="bg-slate-900 text-white"
                                >
                                  {ve.icon} {ve.label} — {ve.desc}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-[11px] text-slate-500 italic">
                            {emotionMeta.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: AI MUSIC STUDIO (Lyria 3 Clip & Lyria 3 Pro) */}
            {activeTab === 'music' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">
                    04. AI ব্যাকগ্রাউন্ড মিউজিক (Lyria 3 Music Engine)
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    মোশন গ্রাফিক্স ভিডিওর আবহ সংগীত তৈরির জন্য <code className="text-amber-300">lyria-3-clip-preview</code> (৩০ সেকেন্ড ক্লিপ) অথবা <code className="text-amber-300">lyria-3-pro-preview</code> (পূর্ণাঙ্গ ট্র্যাক) নির্বাচন করুন।
                  </p>
                </div>

                {/* Lyria Model Selector */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLyriaModel('lyria-3-clip-preview')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      lyriaModel === 'lyria-3-clip-preview'
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Lyria 3 Clip</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      lyria-3-clip-preview · 30s
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLyriaModel('lyria-3-pro-preview')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      lyriaModel === 'lyria-3-pro-preview'
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Lyria 3 Pro</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      lyria-3-pro-preview · Full Track
                    </div>
                  </button>
                </div>

                {/* Music Prompt Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    মিউজিক প্রম্পট (Describe Soundtrack Genre, Mood & Tempo)
                  </label>
                  <textarea
                    rows={3}
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    placeholder="Describe the background music track..."
                    className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 p-3 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* Preset Prompts */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-400 block">
                    প্রিসেট সাউন্ডট্র্যাক স্টাইল (Quick Presets)
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {LYRIA_PRESET_PROMPTS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setMusicPrompt(item.prompt)}
                        className="px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-left text-xs text-slate-300 transition-colors cursor-pointer"
                      >
                        <div className="font-medium text-white">{item.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{item.prompt}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Music Button */}
                <button
                  onClick={handleGenerateLyriaMusic}
                  disabled={isGeneratingMusic}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isGeneratingMusic ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Lyria দিয়ে মিউজিক তৈরি হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4" />
                      <span>Generate Music ({lyriaModel})</span>
                    </>
                  )}
                </button>

                {/* Active Soundtrack Player & Volume Mixer */}
                {musicAudioUrl && (
                  <div className="p-3.5 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate">
                        Active Track: {musicTrackTitle}
                      </span>
                      <span className="text-xs font-mono text-emerald-400 shrink-0">
                        Synced to Timeline
                      </span>
                    </div>

                    <audio controls src={musicAudioUrl} className="w-full h-8" />

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        Background Mix Volume
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={musicVolume}
                        onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                        className="w-40 accent-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-300 tabular-nums w-10 text-right">
                        {Math.round(musicVolume * 100)}%
                      </span>
                    </div>

                    {musicLyrics && (
                      <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 whitespace-pre-line">
                        {musicLyrics}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: PROJECT TEMPLATES */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">
                    05. রেডিমেড মোশন গ্রাফিক্স টেমপ্লেট (Starter Projects)
                  </h2>
                  <p className="text-xs text-slate-400">
                    যেকোনো টেমপ্লেট লোড করে এক ক্লিকেই কাস্টমাইজ করুন
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="টেমপ্লেট খুঁজুন (বাংলা / English)..."
                    className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-2.5">
                  {filteredTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-4 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">{tpl.title}</h3>
                        <span className="text-xs text-slate-400">
                          {tpl.category} · {tpl.language} · {tpl.scenes.length} Scenes
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {tpl.script}
                      </p>
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => {
                            setScriptText(tpl.script);
                            setScenes(tpl.scenes);
                            setMusicPrompt(tpl.musicPrompt);
                            setSelectedSceneIndex(0);
                            seekToTime(0);
                            setIsPlaying(true);
                            setActiveTab('script');
                            setStatusBanner({
                              type: 'success',
                              message: `"${tpl.title}" টেমপ্লেট লোড করা হয়েছে!`,
                            });
                          }}
                          className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          এই টেমপ্লেটটি ব্যবহার করুন
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Stage & Multi-Track Timeline Column (7 cols on 1440px desktop) */}
        <main className="lg:col-span-7 flex flex-col bg-[#070A10] min-h-[640px]">
          {/* Stage Viewport Toolbar */}
          <div className="px-5 py-2.5 border-b border-slate-800/80 bg-[#0E131F] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                Scene {stageSceneIndex + 1}: {stageScene?.headline}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{stageScene?.visualType}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Aspect Ratio Selector */}
              <div className="flex items-center bg-[#0B0F17] p-0.5 rounded-lg border border-slate-800">
                {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                      aspectRatio === ratio
                        ? 'bg-slate-800 text-amber-400 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              {/* Subtitles Toggle */}
              <button
                onClick={() => setShowSubtitles((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showSubtitles
                    ? 'bg-slate-800 border-slate-700 text-amber-400'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                }`}
              >
                <Captions className="w-3.5 h-3.5" />
                <span>Subtitles</span>
              </button>

              {/* 3D Grid Toggle */}
              <button
                onClick={() => setShow3DGrid((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  show3DGrid
                    ? 'bg-slate-800 border-slate-700 text-amber-400'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>3D Grid</span>
              </button>
            </div>
          </div>

          {/* 60FPS 2D & 3D Interactive Canvas Stage */}
          <div className="flex-1 min-h-[380px] flex items-center justify-center relative">
            {scenes.length > 0 && (
              <MotionStage
                scenes={scenes}
                sceneTimings={sceneTimings}
                totalDuration={totalDuration}
                currentTimeRef={currentTimeRef}
                isPlaying={isPlaying}
                aspectRatio={aspectRatio}
                showSubtitles={showSubtitles}
                show3DGrid={show3DGrid}
                canvasRef={canvasRef}
                onSceneChange={handleStageSceneChange}
                onTimeSync={(t) => setCurrentTime(t)}
              />
            )}
          </div>

          {/* Transport Bar & Scrubber */}
          <div className="px-5 py-3 border-t border-slate-800/90 bg-[#0E131F] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const prevIdx = Math.max(0, stageSceneIndex - 1);
                  setSelectedSceneIndex(prevIdx);
                  seekToTime(sceneTimings[prevIdx]?.start || 0);
                }}
                className="p-2 rounded-lg bg-[#0B0F17] hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                title="Previous Scene"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play Video</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  const nextIdx = Math.min(scenes.length - 1, stageSceneIndex + 1);
                  setSelectedSceneIndex(nextIdx);
                  seekToTime(sceneTimings[nextIdx]?.start || 0);
                }}
                className="p-2 rounded-lg bg-[#0B0F17] hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                title="Next Scene"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <span className="ml-2 text-xs font-mono text-slate-300 tabular-nums">
                {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
              </span>
            </div>

            {/* Scrubber Slider */}
            <div className="flex-1 max-w-md mx-2">
              <input
                type="range"
                min={0}
                max={Math.max(0.1, totalDuration)}
                step={0.05}
                value={currentTime}
                onChange={(e) => {
                  setIsPlaying(false);
                  seekToTime(parseFloat(e.target.value));
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Audio Mute & Combined Export Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Voice Control with clear ON/OFF state */}
              <div className="flex items-center gap-1.5 bg-[#0B0F17] p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setVoiceMuted((m) => !m)}
                  className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !voiceMuted
                      ? 'bg-amber-500/20 text-amber-300 font-medium'
                      : 'bg-rose-950/60 text-rose-300 font-medium'
                  }`}
                  title={voiceMuted ? 'ভয়েস চালু করুন (Unmute Voice)' : 'ভয়েস বন্ধ/মিউট করুন (Mute Voice)'}
                >
                  {voiceMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{voiceMuted ? 'ভয়েস: বন্ধ (Muted)' : 'ভয়েস: চালু (ON)'}</span>
                </button>

                {!voiceMuted && (
                  <div className="flex items-center gap-1 pr-1.5">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={voiceVolume}
                      onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                      className="w-16 accent-amber-500 cursor-pointer h-1.5"
                      title={`ভয়েস সাউন্ড: ${Math.round(voiceVolume * 100)}%`}
                    />
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {Math.round(voiceVolume * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Music Control with clear ON/OFF state */}
              <button
                onClick={() => setMusicMuted((m) => !m)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !musicMuted
                    ? 'bg-[#0B0F17] border-slate-800 text-slate-200'
                    : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
                }`}
                title={musicMuted ? 'মিউজিক চালু করুন' : 'মিউজিক বন্ধ করুন'}
              >
                {musicMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{musicMuted ? 'মিউজিক: বন্ধ' : 'মিউজিক: চালু'}</span>
              </button>

              <button
                onClick={() => handleDownloadMasterAudioWav()}
                disabled={isExporting}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Download Mixed Voiceover + Music Audio (.wav)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>অডিও (.wav)</span>
              </button>

              <button
                onClick={() => handleExportVideo(true)}
                disabled={isExporting}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Download Video+Audio (.webm) AND Master Audio (.wav) together"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ভিডিও + অডিও একসাথে ডাউনলোড</span>
              </button>
            </div>
          </div>

          {/* Multi-Track Synchronized Timeline Editor */}
          <div className="p-4 border-t border-slate-800/90 bg-[#0B0F17] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300">
                মাল্টি-ট্র্যাক টাইমলাইন (2D/3D Motion Track · Voiceover Sync · Lyria Music Track)
              </span>
              <span className="font-mono tabular-nums">60 FPS Timeline</span>
            </div>

            {/* Track 1: Visual Motion Scenes */}
            <div className="flex items-stretch gap-1 h-12 w-full overflow-x-auto">
              {scenes.map((s, idx) => {
                const widthPct = totalDuration > 0 ? (s.duration / totalDuration) * 100 : 14;
                const isSelected = idx === stageSceneIndex;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSceneIndex(idx);
                      seekToTime(sceneTimings[idx]?.start || 0);
                      setActiveTab('editor');
                    }}
                    style={{ width: `${Math.max(widthPct, 8)}%` }}
                    className={`rounded-md p-2 text-left transition-all flex flex-col justify-between overflow-hidden shrink-0 border cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-amber-500'
                        : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-white truncate">
                        S{idx + 1}: {s.headline}
                      </span>
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: s.accentColor }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 tabular-nums truncate">
                      {s.visualType} · {s.duration.toFixed(1)}s
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Track 2: Voiceover Sync Track */}
            <div className="flex items-center gap-1 h-7 w-full">
              {scenes.map((s, idx) => {
                const widthPct = totalDuration > 0 ? (s.duration / totalDuration) * 100 : 14;
                return (
                  <div
                    key={`vo-${s.id}`}
                    style={{ width: `${Math.max(widthPct, 8)}%` }}
                    onClick={() => {
                      setSelectedSceneIndex(idx);
                      setActiveTab('voiceover');
                    }}
                    className={`h-full rounded-sm px-2 flex items-center justify-between text-[10px] font-mono truncate border cursor-pointer ${
                      s.voiceAudioUrl
                        ? 'bg-purple-950/60 border-purple-700/60 text-purple-200'
                        : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate">
                      VO {idx + 1}: {s.narration.slice(0, 20)}...
                    </span>
                    <span>{s.voiceAudioUrl ? 'WAV' : 'Auto Sync'}</span>
                  </div>
                );
              })}
            </div>

            {/* Track 3: Lyria Background Music Track */}
            <div
              onClick={() => setActiveTab('music')}
              className="h-7 w-full rounded-sm bg-emerald-950/40 border border-emerald-800/50 px-3 flex items-center justify-between text-[11px] font-mono text-emerald-300 cursor-pointer hover:bg-emerald-950/60 transition-colors"
            >
              <span className="truncate">
                ♫ Soundtrack: {musicTrackTitle} ({lyriaModel})
              </span>
              <span className="tabular-nums shrink-0">{totalDuration.toFixed(1)}s Loop</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export type VisualType =
  | 'kinetic-intro'
  | 'no-editing-clock'
  | 'script-to-voice'
  | '3d-layers'
  | 'audio-sync'
  | 'live-editor'
  | 'cta-outro';

export type AnimationStyle =
  | 'spring-pop'
  | '3d-orbit'
  | 'kinetic-slide'
  | 'typewriter-glow'
  | 'isometric-stack';

export type CameraAngle =
  | 'isometric-tilt'
  | 'front-cinematic'
  | 'dynamic-pan'
  | 'deep-perspective';

export type VoiceEmotion =
  | 'Energetic'
  | 'Happy'
  | 'Serious'
  | 'Whispering'
  | 'Inspiring'
  | 'Curious';

export const VOICE_EMOTIONS: {
  value: VoiceEmotion;
  label: string;
  desc: string;
  icon: string;
  badgeClass: string;
}[] = [
  { value: 'Energetic', label: 'Energetic', desc: 'High energy, punchy & lively', icon: '⚡', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'Happy', label: 'Happy', desc: 'Warm, cheerful & uplifting', icon: '😊', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'Serious', label: 'Serious', desc: 'Grounded, authoritative & professional', icon: '🎯', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { value: 'Whispering', label: 'Whispering', desc: 'Soft, intimate & suspenseful', icon: '🤫', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { value: 'Inspiring', label: 'Inspiring', desc: 'Visionary, motivational & moving', icon: '✨', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'Curious', label: 'Curious', desc: 'Intriguing, wonder & questioning', icon: '🤔', badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
];

export interface MotionScene {
  id: string;
  narration: string;
  headline: string;
  subheadline: string;
  visualType: VisualType;
  animationStyle: AnimationStyle;
  accentColor: string;
  duration: number;
  floatingElements: string[];
  cameraAngle: CameraAngle;
  voiceAudioUrl?: string;
  voiceEmotion?: VoiceEmotion;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  category: string;
  language: string;
  script: string;
  musicPrompt: string;
  scenes: MotionScene[];
}

export const INITIAL_BENGALI_SCRIPT = `আপনি কি প্রফেশনাল মোশন গ্রাফিক্স ভিডিও তৈরি করতে চান? তাহলে আজকে আমি আপনাদের দেখাবো, কীভাবে AI ব্যবহার করে খুব সহজেই এমন আকর্ষণীয় ভিডিও তৈরি করবেন। এখন আর প্রফেশনাল ভিডিও তৈরি করতে ঘণ্টার পর ঘণ্টা এডিটিং শেখার প্রয়োজন নেই। আপনি শুধু আপনার পছন্দমতো একটি স্ক্রিপ্ট লিখবেন, আর AI দিয়ে তৈরি করবেন সুন্দর একটি প্রফেশনাল ভয়েসওভার। এরপর সেই ভয়েস অনুযায়ী AI নিজেই তৈরি করে দেবে অসাধারণ সব 2D ও 3D অ্যানিমেশন, টেক্সট ইফেক্ট, আইকন এবং ভিজ্যুয়াল। আপনি যা বলবেন, স্ক্রিনে ঠিক সেই কথার সঙ্গে মিল রেখেই অ্যানিমেশন প্রদর্শিত হবে। সবচেয়ে মজার বিষয় হলো, ভিডিও তৈরি হওয়ার পরেও আপনি নিজের পছন্দমতো সবকিছু এডিট করতে পারবেন। তাহলে চলুন, দেরি না করে দেখে নেওয়া যাক, কীভাবে AI-এর সাহায্যে এমন প্রফেশনাল মোশন গ্রাফিক্স ভিডিও তৈরি করা যায়!`;

export const INITIAL_SCENES: MotionScene[] = [
  {
    id: 'scene-1',
    narration: 'আপনি কি প্রফেশনাল মোশন গ্রাফিক্স ভিডিও তৈরি করতে চান?',
    headline: 'প্রফেশনাল মোশন গ্রাফিক্স ভিডিও',
    subheadline: 'সিনেমাটিক 2D ও 3D ভিজ্যুয়াল ইঞ্জিন',
    visualType: 'kinetic-intro',
    animationStyle: 'spring-pop',
    accentColor: '#F59E0B',
    duration: 3.9,
    floatingElements: ['60 FPS রেন্ডার', '3D ক্যামেরা মোশন', 'কাইনেটিক টাইপোগ্রাফি'],
    cameraAngle: 'isometric-tilt',
    voiceAudioUrl: '/audio/scene-1.wav',
    voiceEmotion: 'Curious',
  },
  {
    id: 'scene-2',
    narration: 'তাহলে আজকে আমি আপনাদের দেখাবো, কীভাবে AI ব্যবহার করে খুব সহজেই এমন আকর্ষণীয় ভিডিও তৈরি করবেন।',
    headline: 'AI দিয়ে সহজেই আকর্ষণীয় ভিডিও',
    subheadline: 'স্ক্রিপ্ট থেকে স্বয়ংক্রিয় মোশন ডিজাইন',
    visualType: '3d-layers',
    animationStyle: 'isometric-stack',
    accentColor: '#38BDF8',
    duration: 7.1,
    floatingElements: ['AI স্টোরিবোর্ড', 'স্মার্ট লেয়ারিং', 'অটো ট্রানজিশন'],
    cameraAngle: 'deep-perspective',
    voiceAudioUrl: '/audio/scene-2.wav',
    voiceEmotion: 'Inspiring',
  },
  {
    id: 'scene-3',
    narration: 'এখন আর প্রফেশনাল ভিডিও তৈরি করতে ঘণ্টার পর ঘণ্টা এডিটিং শেখার প্রয়োজন নেই।',
    headline: 'ঘণ্টার পর ঘণ্টা এডিটিং নয়',
    subheadline: 'জটিল সফটওয়্যার ছাড়াই দ্রুত প্রোডাকশন',
    visualType: 'no-editing-clock',
    animationStyle: 'kinetic-slide',
    accentColor: '#10B981',
    duration: 5.5,
    floatingElements: ['১০ গুণ দ্রুত রেন্ডার', 'জিরো কি-ফ্রেম ঝামেলা', 'তাৎক্ষণিক প্রিভিউ'],
    cameraAngle: 'front-cinematic',
    voiceAudioUrl: '/audio/scene-3.wav',
    voiceEmotion: 'Serious',
  },
  {
    id: 'scene-4',
    narration: 'আপনি শুধু আপনার পছন্দমতো একটি স্ক্রিপ্ট লিখবেন, আর AI দিয়ে তৈরি করবেন সুন্দর একটি প্রফেশনাল ভয়েসওভার।',
    headline: 'স্ক্রিপ্ট লিখুন ও AI ভয়েসওভার তৈরি করুন',
    subheadline: 'স্টুডিও কোয়ালিটি ন্যাচারাল অডিও জেনারেশন',
    visualType: 'script-to-voice',
    animationStyle: 'typewriter-glow',
    accentColor: '#A855F7',
    duration: 7.5,
    floatingElements: ['স্ক্রিপ্ট টু স্পিচ', '২৪ kHz স্টুডিও ওয়েভ', 'মাল্টি-ভয়েস প্রোফাইল'],
    cameraAngle: 'dynamic-pan',
    voiceAudioUrl: '/audio/scene-4.wav',
    voiceEmotion: 'Happy',
  },
  {
    id: 'scene-5',
    narration: 'এরপর সেই ভয়েস অনুযায়ী AI নিজেই তৈরি করে দেবে অসাধারণ সব 2D ও 3D অ্যানিমেশন, টেক্সট ইফেক্ট, আইকন এবং ভিজ্যুয়াল।',
    headline: 'স্বয়ংক্রিয় 2D ও 3D অ্যানিমেশন',
    subheadline: 'টেক্সট ইফেক্ট, আইকন ও ডাইনামিক ভিজ্যুয়াল গ্রাফিক্স',
    visualType: '3d-layers',
    animationStyle: '3d-orbit',
    accentColor: '#F43F5E',
    duration: 9.4,
    floatingElements: ['2D ভেক্টর আইকন', '3D আইসোমেট্রিক কার্ড', 'গ্লো টেক্সট ইফেক্ট'],
    cameraAngle: 'isometric-tilt',
    voiceAudioUrl: '/audio/scene-5.wav',
    voiceEmotion: 'Energetic',
  },
  {
    id: 'scene-6',
    narration: 'আপনি যা বলবেন, স্ক্রিনে ঠিক সেই কথার সঙ্গে মিল রেখেই অ্যানিমেশন প্রদর্শিত হবে।',
    headline: 'ভয়েস-সিঙ্কড রিয়েলটাইম অ্যানিমেশন',
    subheadline: 'প্রতিটি শব্দের সাথে নিখুঁত অডিও-ভিজ্যুয়াল ছন্দ',
    visualType: 'audio-sync',
    animationStyle: 'spring-pop',
    accentColor: '#06B6D4',
    duration: 6.0,
    floatingElements: ['অডিও ওয়েভফর্ম সিঙ্ক', 'শব্দভিত্তিক হাইলাইট', 'বিট ম্যাচিং'],
    cameraAngle: 'front-cinematic',
    voiceAudioUrl: '/audio/scene-6.wav',
    voiceEmotion: 'Inspiring',
  },
  {
    id: 'scene-7',
    narration: 'সবচেয়ে মজার বিষয় হলো, ভিডিও তৈরি হওয়ার পরেও আপনি নিজের পছন্দমতো সবকিছু এডিট করতে পারবেন। তাহলে চলুন, দেরি না করে দেখে নেওয়া যাক, কীভাবে AI-এর সাহায্যে এমন প্রফেশনাল মোশন গ্রাফিক্স ভিডিও তৈরি করা যায়!',
    headline: 'পছন্দমতো কাস্টমাইজ ও এক্সপোর্ট করুন',
    subheadline: 'প্রতিটি সিন, টেক্সট, কালার ও মিউজিক নিজের মতো সাজান',
    visualType: 'live-editor',
    animationStyle: 'isometric-stack',
    accentColor: '#F59E0B',
    duration: 15.8,
    floatingElements: ['লাইভ টাইমলাইন এডিটর', 'কালার ও ফন্ট কন্ট্রোল', 'HD ভিডিও এক্সপোর্ট'],
    cameraAngle: 'deep-perspective',
    voiceAudioUrl: '/audio/scene-7.wav',
    voiceEmotion: 'Energetic',
  },
];

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'bengali-ai-motion',
    title: 'AI মোশন গ্রাফিক্স টিউটোরিয়াল (বাংলা)',
    category: 'Explainer & Promo',
    language: 'বাংলা',
    script: INITIAL_BENGALI_SCRIPT,
    musicPrompt: 'Upbeat modern electronic motion graphics background music, crisp synth plucks, warm bassline, inspiring corporate tech rhythm, 120 BPM',
    scenes: INITIAL_SCENES,
  },
  {
    id: 'saas-launch-reel',
    title: 'SaaS Product Launch Showreel',
    category: 'Product Marketing',
    language: 'English',
    script: `Want to launch your product with studio-grade motion graphics? Stop spending weeks keyframing complex timelines by hand. Write your product story once and generate crisp AI voiceovers in seconds. Watch as 3D isometric layers, kinetic typography, and animated metrics lock directly to your narration. Customize every scene color, camera angle, and soundtrack before exporting in high definition.`,
    musicPrompt: 'Futuristic minimal tech house background track, clean arpeggiated synths, punchy percussion, high-energy product launch vibe',
    scenes: [
      {
        id: 'en-1',
        narration: 'Want to launch your product with studio-grade motion graphics?',
        headline: 'Studio-Grade Product Showreels',
        subheadline: 'High-impact kinetic storytelling in minutes',
        visualType: 'kinetic-intro',
        animationStyle: 'spring-pop',
        accentColor: '#38BDF8',
        duration: 4.0,
        floatingElements: ['60 FPS Motion', '3D Depth Layers', 'Broadcast Ready'],
        cameraAngle: 'isometric-tilt',
        voiceEmotion: 'Curious',
      },
      {
        id: 'en-2',
        narration: 'Stop spending weeks keyframing complex timelines by hand.',
        headline: 'Zero Manual Keyframing',
        subheadline: 'Replace 40 hours of timeline work with instant scene synthesis',
        visualType: 'no-editing-clock',
        animationStyle: 'kinetic-slide',
        accentColor: '#10B981',
        duration: 4.2,
        floatingElements: ['10x Faster Workflow', 'Procedural Easing', 'Instant Retiming'],
        cameraAngle: 'front-cinematic',
        voiceEmotion: 'Serious',
      },
      {
        id: 'en-3',
        narration: 'Write your product story once and generate crisp AI voiceovers in seconds.',
        headline: 'Script to Studio Voiceover',
        subheadline: 'Neural speech synthesis with word-level timing',
        visualType: 'script-to-voice',
        animationStyle: 'typewriter-glow',
        accentColor: '#A855F7',
        duration: 4.5,
        floatingElements: ['24 kHz WAV Output', 'Multi-Persona Voices', 'Dynamic Pacing'],
        cameraAngle: 'dynamic-pan',
        voiceEmotion: 'Happy',
      },
      {
        id: 'en-4',
        narration: 'Watch as 3D isometric layers, kinetic typography, and animated metrics lock directly to your narration.',
        headline: 'Voice-Locked 2D & 3D Visuals',
        subheadline: 'Every spoken phrase drives real-time visual choreography',
        visualType: '3d-layers',
        animationStyle: '3d-orbit',
        accentColor: '#F59E0B',
        duration: 5.0,
        floatingElements: ['Isometric Cards', 'Kinetic Headlines', 'Audio Waveform Sync'],
        cameraAngle: 'deep-perspective',
        voiceEmotion: 'Inspiring',
      },
      {
        id: 'en-5',
        narration: 'Customize every scene color, camera angle, and soundtrack before exporting in high definition.',
        headline: 'Full Post-Generation Control',
        subheadline: 'Edit text, camera angles, and Lyria AI music anytime',
        visualType: 'live-editor',
        animationStyle: 'isometric-stack',
        accentColor: '#F43F5E',
        duration: 4.8,
        floatingElements: ['Live Scene Inspector', 'Lyria 3 Soundtrack', 'WebM Video Export'],
        cameraAngle: 'isometric-tilt',
        voiceEmotion: 'Energetic',
      },
    ],
  },
  {
    id: 'bengali-startup-pitch',
    title: 'ডিজিটাল বিজনেস প্রমো (বাংলা)',
    category: 'Brand Story',
    language: 'বাংলা',
    script: `আপনার ব্র্যান্ডকে ডিজিটাল দুনিয়ায় সবার চেয়ে এগিয়ে রাখতে চান? আকর্ষণীয় মোশন গ্রাফিক্স ভিডিও দর্শকদের মনোযোগ ধরে রাখে তিন গুণ বেশি সময়। আমাদের AI স্টুডিও দিয়ে কয়েক মিনিটেই তৈরি করুন প্রফেশনাল বিজ্ঞাপন ও প্রেজেন্টেশন।`,
    musicPrompt: 'Cinematic uplifting corporate ambient track with warm piano chords, subtle electronic pulse, and inspiring strings',
    scenes: [
      {
        id: 'bn-pitch-1',
        narration: 'আপনার ব্র্যান্ডকে ডিজিটাল দুনিয়ায় সবার চেয়ে এগিয়ে রাখতে চান?',
        headline: 'ব্র্যান্ডকে এগিয়ে রাখুন',
        subheadline: 'আধুনিক ভিজ্যুয়াল কমিউনিকেশন প্ল্যাটফর্ম',
        visualType: 'kinetic-intro',
        animationStyle: 'spring-pop',
        accentColor: '#10B981',
        duration: 4.2,
        floatingElements: ['ডিজিটাল ব্র্যান্ডিং', 'হাই এনগেজমেন্ট', 'স্মার্ট ভিজ্যুয়াল'],
        cameraAngle: 'isometric-tilt',
        voiceAudioUrl: `/api/bengali-tts?text=${encodeURIComponent('আপনার ব্র্যান্ডকে ডিজিটাল দুনিয়ায় সবার চেয়ে এগিয়ে রাখতে চান?')}`,
        voiceEmotion: 'Curious',
      },
      {
        id: 'bn-pitch-2',
        narration: 'আকর্ষণীয় মোশন গ্রাফিক্স ভিডিও দর্শকদের মনোযোগ ধরে রাখে তিন গুণ বেশি সময়।',
        headline: '৩ গুণ বেশি দর্শক মনোযোগ',
        subheadline: 'ডাইনামিক অ্যানিমেশন ও ভয়েসওভারের নিখুঁত সমন্বয়',
        visualType: 'audio-sync',
        animationStyle: '3d-orbit',
        accentColor: '#38BDF8',
        duration: 4.6,
        floatingElements: ['৩০০% রিচ বৃদ্ধি', 'অডিও-ভিজ্যুয়াল হুক', 'ক্লিয়ার মেসেজিং'],
        cameraAngle: 'front-cinematic',
        voiceAudioUrl: `/api/bengali-tts?text=${encodeURIComponent('আকর্ষণীয় মোশন গ্রাফিক্স ভিডিও দর্শকদের মনোযোগ ধরে রাখে তিন গুণ বেশি সময়।')}`,
        voiceEmotion: 'Serious',
      },
      {
        id: 'bn-pitch-3',
        narration: 'আমাদের AI স্টুডিও দিয়ে কয়েক মিনিটেই তৈরি করুন প্রফেশনাল বিজ্ঞাপন ও প্রেজেন্টেশন।',
        headline: 'কয়েক মিনিটেই প্রফেশনাল বিজ্ঞাপন',
        subheadline: 'এডিট করুন ও সরাসরি ভিডিও ডাউনলোড করুন',
        visualType: 'live-editor',
        animationStyle: 'isometric-stack',
        accentColor: '#F59E0B',
        duration: 4.5,
        floatingElements: ['দ্রুত রেন্ডারিং', 'কাস্টম থিম', 'রেডি টু শেয়ার'],
        cameraAngle: 'deep-perspective',
        voiceAudioUrl: `/api/bengali-tts?text=${encodeURIComponent('আমাদের AI স্টুডিও দিয়ে কয়েক মিনিটেই তৈরি করুন প্রফেশনাল বিজ্ঞাপন ও প্রেজেন্টেশন।')}`,
        voiceEmotion: 'Energetic',
      },
    ],
  },
];

export const LYRIA_PRESET_PROMPTS = [
  {
    label: 'Modern Motion Synth (120 BPM)',
    prompt: 'Upbeat modern electronic motion graphics background music, crisp synth plucks, warm sub-bass, clean tech percussion, 120 BPM',
  },
  {
    label: 'Cinematic Orchestral Pulse',
    prompt: 'Cinematic hybrid orchestral and electronic underscore for a tech explainer video, warm strings, subtle piano arpeggios, inspiring buildup',
  },
  {
    label: 'Lo-Fi Creative Studio Groove',
    prompt: 'Smooth lo-fi chillhop beat with Rhodes electric piano chords, soft vinyl warmth, crisp snare, relaxed tutorial background music',
  },
  {
    label: 'High-Energy Product Launch',
    prompt: 'Energetic future bass and melodic synthwave soundtrack, driving rhythm, bright atmospheric pads, commercial showcase music',
  },
];

/**
 * Generates a clean, studio-grade polyphonic ambient synth WAV soundtrack in the browser
 * so the user always has an immediate playable/exportable soundtrack or fallback.
 */
export function createProceduralSoundtrackWav(durationSec = 16, style: 'upbeat' | 'cinematic' | 'lofi' = 'upbeat'): string {
  const sampleRate = 24000;
  const numSamples = Math.floor(sampleRate * durationSec);
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
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Chord progression frequencies (A minor -> F major -> C major -> G major)
  const chords =
    style === 'cinematic'
      ? [
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [261.63, 329.63, 392.0],
          [196.0, 246.94, 293.66],
        ]
      : style === 'lofi'
      ? [
          [261.63, 311.13, 392.0],
          [233.08, 293.66, 349.23],
          [207.65, 261.63, 311.13],
          [196.0, 246.94, 293.66],
        ]
      : [
          [220.0, 277.18, 329.63],
          [196.0, 246.94, 293.66],
          [174.61, 220.0, 261.63],
          [164.81, 207.65, 246.94],
        ];

  const arpNotes = [440, 523.25, 659.25, 523.25, 587.33, 523.25, 440, 392.0];
  const bpm = style === 'upbeat' ? 120 : style === 'lofi' ? 88 : 100;
  const beatDuration = 60 / bpm;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor(t / (beatDuration * 4)) % chords.length;
    const chord = chords[chordIdx];

    // Warm pad
    let pad = 0;
    for (const freq of chord) {
      pad += Math.sin(2 * Math.PI * freq * t) * 0.12;
      pad += Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.08;
    }

    // Crisp synth pluck arpeggio
    const stepTime = beatDuration / 2;
    const stepIdx = Math.floor(t / stepTime) % arpNotes.length;
    const localT = t % stepTime;
    const pluckEnv = Math.exp(-localT * 14);
    const arpFreq = arpNotes[stepIdx];
    const pluck = Math.sin(2 * Math.PI * arpFreq * t) * pluckEnv * 0.16;

    // Soft kick pulse on beats
    const beatLocalT = t % beatDuration;
    const kickEnv = Math.exp(-beatLocalT * 18);
    const kickFreq = 55 + 90 * Math.exp(-beatLocalT * 35);
    const kick = Math.sin(2 * Math.PI * kickFreq * beatLocalT) * kickEnv * 0.22;

    // Fade in / out envelope
    const fadeEnv =
      t < 0.8 ? t / 0.8 : t > durationSec - 1.2 ? Math.max(0, (durationSec - t) / 1.2) : 1.0;

    const sample = Math.max(-0.95, Math.min(0.95, (pad + pluck + kick) * fadeEnv));
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

import React, { useEffect, useRef } from 'react';
import { MotionScene } from '../data/defaultProject';

export interface SceneTimingSlot {
  start: number;
  end: number;
  duration: number;
}

export type SfxTriggerType = 'whoosh' | 'pop' | 'impact' | 'chime' | 'click';

interface MotionStageProps {
  scenes: MotionScene[];
  sceneTimings: SceneTimingSlot[];
  totalDuration: number;
  currentTimeRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1';
  showSubtitles: boolean;
  show3DGrid: boolean;
  showSideFx?: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onSceneChange?: (newSceneIndex: number) => void;
  onTimeSync?: (time: number) => void;
  onSfxTrigger?: (type: SfxTriggerType) => void;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = (hex || '#F59E0B').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(full, 16) || 0xf59e0b;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function lerpColorHex(hexA: string, hexB: string, t: number, alpha: number): string {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const clampedT = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * clampedT);
  const g = Math.round(g1 + (g2 - g1) * clampedT);
  const b = Math.round(b1 + (b2 - b1) * clampedT);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function easeOutCubic(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - clamped, 3);
}

function easeInOutCubic(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function easeOutBack(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
}

function easeOutElastic(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  if (clamped === 0) return 0;
  if (clamped === 1) return 1;
  const p = 0.35;
  const s = p / 4;
  return Math.pow(2, -10 * clamped) * Math.sin(((clamped - s) * (2 * Math.PI)) / p) + 1;
}

function easeAggressiveLinear(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return Math.min(1, clamped * 1.6);
}

function easeOutExpo(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
}

function easeInOutSine(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

function getPresetEasing(preset: string | undefined, x: number): number {
  switch (preset) {
    case 'bouncy-elastic':
      return easeOutElastic(x);
    case 'aggressive-linear':
      return easeAggressiveLinear(x);
    case 'kinetic-snap':
      return easeOutExpo(x);
    case 'cinematic-float':
      return easeInOutSine(x);
    case 'smooth-ease':
    default:
      return easeOutCubic(x);
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const safeW = Math.max(0, w);
  const safeH = Math.max(0, h);
  const radius = Math.max(0, Math.min(r, safeW / 2, safeH / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + safeW, y, x + safeW, y + safeH, radius);
  ctx.arcTo(x + safeW, y + safeH, x, y + safeH, radius);
  ctx.arcTo(x, y + safeH, x, y, radius);
  ctx.arcTo(x, y, x + safeW, y, radius);
  ctx.closePath();
}

/**
 * Computes progressive ease-out progress for an element that triggers at speech fraction `startP`
 * and completes its entrance over `spanP` (defaults to 0.14 of scene duration).
 */
function getSpeechElementProg(p: number, startP: number, spanP = 0.14): number {
  if (p < startP) return 0;
  return Math.min(1, (p - startP) / spanP);
}

export const MotionStage: React.FC<MotionStageProps> = ({
  scenes,
  sceneTimings,
  totalDuration,
  currentTimeRef,
  isPlaying,
  aspectRatio,
  showSubtitles,
  show3DGrid,
  showSideFx = true,
  canvasRef,
  onSceneChange,
  onTimeSync,
  onSfxTrigger,
}) => {
  const width = aspectRatio === '16:9' ? 1280 : aspectRatio === '9:16' ? 720 : 960;
  const height = aspectRatio === '16:9' ? 720 : aspectRatio === '9:16' ? 1280 : 960;

  // Store latest props in a ref so the 60FPS loop NEVER tears down or restarts on state changes
  const latestPropsRef = useRef({
    scenes,
    sceneTimings,
    totalDuration,
    isPlaying,
    aspectRatio,
    showSubtitles,
    show3DGrid,
    showSideFx,
    onSceneChange,
    onTimeSync,
    onSfxTrigger,
  });

  useEffect(() => {
    latestPropsRef.current = {
      scenes,
      sceneTimings,
      totalDuration,
      isPlaying,
      aspectRatio,
      showSubtitles,
      show3DGrid,
      showSideFx,
      onSceneChange,
      onTimeSync,
      onSfxTrigger,
    };
  }, [
    scenes,
    sceneTimings,
    totalDuration,
    isPlaying,
    aspectRatio,
    showSubtitles,
    show3DGrid,
    showSideFx,
    onSceneChange,
    onTimeSync,
    onSfxTrigger,
  ]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();
    let continuousTime = 0;
    let lastReportedSceneIdx = -1;
    let lastUiSyncTimestamp = 0;

    // Track triggered SFX in preview to prevent duplicate firing in the same scene cycle
    const sfxFiredMapRef = new Set<string>();

    const drawSceneVisuals = (
      ctx: CanvasRenderingContext2D,
      scene: MotionScene,
      sceneProgress: number,
      t: number,
      alpha: number,
      transitionShiftX: number,
      transitionScale: number,
      isVertical: boolean
    ) => {
      if (alpha <= 0.01) return;

      const p = Math.max(0, Math.min(1, sceneProgress));
      const entryProgress = Math.min(1, p * 4.2);
      const preset = scene.motionPreset || 'smooth-ease';
      const presetEased = getPresetEasing(preset, entryProgress);

      const springEntry =
        preset === 'bouncy-elastic'
          ? easeOutElastic(entryProgress)
          : preset === 'aggressive-linear'
          ? easeAggressiveLinear(entryProgress)
          : preset === 'kinetic-snap'
          ? easeOutExpo(entryProgress)
          : preset === 'cinematic-float'
          ? easeInOutSine(entryProgress)
          : scene.animationStyle === 'spring-pop'
          ? easeOutBack(entryProgress)
          : presetEased;

      const floatSpeed =
        preset === 'bouncy-elastic'
          ? 3.4
          : preset === 'aggressive-linear'
          ? 4.6
          : preset === 'cinematic-float'
          ? 1.2
          : 2.2;

      const floatAmp =
        preset === 'bouncy-elastic'
          ? 12
          : preset === 'aggressive-linear'
          ? 2.5
          : preset === 'cinematic-float'
          ? 10
          : 7;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Continuous Smooth Camera Drift + Cross-Scene Glide
      const camShiftX =
        transitionShiftX +
        (scene.cameraAngle === 'dynamic-pan'
          ? Math.sin(t * 0.8) * 26 + (p - 0.5) * 30
          : scene.cameraAngle === 'isometric-tilt'
          ? Math.sin(t * (floatSpeed * 0.5)) * (floatAmp * 1.2)
          : Math.sin(t * 0.6) * 8);

      const camShiftY =
        (scene.cameraAngle === 'deep-perspective'
          ? Math.cos(t * (floatSpeed * 0.4)) * (floatAmp * 1.1)
          : Math.cos(t * 0.7) * 6);

      ctx.translate(camShiftX, camShiftY);

      const centerX = width * 0.5;
      const stageTopY = isVertical ? height * 0.26 : height * 0.34;

      // Central 2D & 3D Motion Graphic Illustration with continuous kinetic movement
      ctx.save();
      ctx.translate(centerX, stageTopY);
      const baseScale = isVertical ? 0.85 : 1;
      const breathingScale = 1 + Math.sin(t * 2.4) * 0.025;
      const scaleFactor =
        baseScale * (0.86 + 0.14 * springEntry) * transitionScale * breathingScale;
      ctx.scale(scaleFactor, scaleFactor);

      if (scene.visualType === 'kinetic-intro') {
        // 1. Central Faceted 3D Kinetic Prism enters with opening speech (p: 0.02 -> 0.20)
        const prismProg = getSpeechElementProg(p, 0.02, 0.18);
        if (prismProg > 0.001) {
          const prismScale = easeOutElastic(prismProg);
          const floatY = Math.sin(t * floatSpeed) * floatAmp;
          const tiltAngle = Math.sin(t * 1.8) * 0.08;
          ctx.save();
          ctx.translate(0, floatY);
          ctx.scale(prismScale, prismScale);
          ctx.rotate(tiltAngle);

          // Top Face
          ctx.fillStyle = hexToRgba(scene.accentColor, 0.95);
          ctx.beginPath();
          ctx.moveTo(0, -68);
          ctx.lineTo(64, -34);
          ctx.lineTo(0, 0);
          ctx.lineTo(-64, -34);
          ctx.closePath();
          ctx.fill();

          // Left Face
          ctx.fillStyle = hexToRgba(scene.accentColor, 0.65);
          ctx.beginPath();
          ctx.moveTo(-64, -34);
          ctx.lineTo(0, 0);
          ctx.lineTo(0, 68);
          ctx.lineTo(-64, 34);
          ctx.closePath();
          ctx.fill();

          // Right Face
          ctx.fillStyle = hexToRgba(scene.accentColor, 0.42);
          ctx.beginPath();
          ctx.moveTo(64, -34);
          ctx.lineTo(0, 0);
          ctx.lineTo(0, 68);
          ctx.lineTo(64, 34);
          ctx.closePath();
          ctx.fill();

          // Facet wireframe glint
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.45 + Math.sin(t * 3.5) * 0.25;
          ctx.beginPath();
          ctx.moveTo(0, -68);
          ctx.lineTo(0, 68);
          ctx.stroke();

          ctx.restore();
        }

        // 2. Multi-Orbit Elliptical Rings enter staggered with speech (Ring 0 at 0.18, Ring 1 at 0.38, Ring 2 at 0.58)
        for (let i = 0; i < 3; i++) {
          const ringProg = getSpeechElementProg(p, 0.18 + i * 0.20, 0.16);
          if (ringProg <= 0.001) continue;
          const ringEase = easeOutBack(ringProg);

          ctx.save();
          const orbitRot = t * (0.55 + i * 0.25) * (i % 2 === 0 ? 1 : -1);
          ctx.rotate(orbitRot);
          ctx.scale(ringEase, ringEase);
          ctx.strokeStyle = hexToRgba(scene.accentColor, (0.65 - i * 0.14) * alpha * ringProg);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 150 + i * 38, 62 + i * 16, 0.35 * i, 0, Math.PI * 2);
          ctx.stroke();

          // Satellite node appears and begins orbiting
          const angle = t * (1.6 + i * 0.45);
          const nx = Math.cos(angle) * (150 + i * 38);
          const ny = Math.sin(angle) * (62 + i * 16);
          ctx.fillStyle = scene.accentColor;
          ctx.shadowColor = scene.accentColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(nx, ny, 7, 0, Math.PI * 2);
          ctx.fill();

          // Satellite spark trail
          const trailAngle = angle - 0.2;
          const tx = Math.cos(trailAngle) * (150 + i * 38);
          const ty = Math.sin(trailAngle) * (62 + i * 16);
          ctx.fillStyle = hexToRgba(scene.accentColor, 0.45);
          ctx.beginPath();
          ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // 3. Radiating Energy Rays burst outward at speech climax (p: 0.72 -> 0.90)
        const raysProg = getSpeechElementProg(p, 0.72, 0.16);
        if (raysProg > 0.001) {
          const rayEase = easeOutCubic(raysProg);
          for (let ray = 0; ray < 8; ray++) {
            const rayAngle = (ray / 8) * Math.PI * 2 + t * 0.4;
            const rayLen = (35 + 95 * rayEase) + Math.sin(t * 3 + ray) * 20;
            ctx.save();
            ctx.rotate(rayAngle);
            ctx.strokeStyle = hexToRgba(scene.accentColor, 0.24 * rayEase);
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 8]);
            ctx.beginPath();
            ctx.moveTo(35, 0);
            ctx.lineTo(rayLen, 0);
            ctx.stroke();
            ctx.restore();
          }
        }
      } else if (scene.visualType === 'no-editing-clock') {
        // 1. Outer Container Box slides in (p: 0.02 -> 0.18)
        const boxProg = getSpeechElementProg(p, 0.02, 0.16);
        if (boxProg > 0.001) {
          ctx.save();
          const boxScale = 0.88 + 0.12 * easeOutCubic(boxProg);
          ctx.scale(boxScale, boxScale);
          drawRoundedRect(ctx, -210, -95, 420, 170, 20);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(scene.accentColor, 0.65);
          ctx.lineWidth = 2;
          ctx.stroke();

          // 2. Dial Circle and Sweeping Hand (p: 0.18 -> 0.38)
          const dialProg = getSpeechElementProg(p, 0.18, 0.16);
          if (dialProg > 0.001) {
            ctx.beginPath();
            ctx.arc(-105, -10, 52, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
            ctx.lineWidth = 6;
            ctx.stroke();

            // Radial Tick Marks appear
            for (let tick = 0; tick < 12; tick++) {
              const tickAng = (tick / 12) * Math.PI * 2;
              const tr1 = 44;
              const tr2 = tick % 3 === 0 ? 50 : 47;
              ctx.beginPath();
              ctx.moveTo(-105 + Math.cos(tickAng) * tr1, -10 + Math.sin(tickAng) * tr1);
              ctx.lineTo(-105 + Math.cos(tickAng) * tr2, -10 + Math.sin(tickAng) * tr2);
              ctx.strokeStyle = tick % 3 === 0 ? scene.accentColor : 'rgba(255,255,255,0.3)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }

            // Sweeping Hand begins rotating
            ctx.save();
            ctx.translate(-105, -10);
            ctx.rotate(t * (preset === 'aggressive-linear' ? 6 : 4.2));
            ctx.strokeStyle = '#F8FAFC';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -34);
            ctx.stroke();
            ctx.restore();
          }

          // 3. Comparison Bar 1 ("ম্যানুয়াল এডিটিং: ৮ ঘণ্টা") appears at p: 0.42 -> 0.60
          const bar1Prog = getSpeechElementProg(p, 0.42, 0.16);
          if (bar1Prog > 0.001) {
            const b1Ease = easeOutCubic(bar1Prog);
            ctx.save();
            ctx.globalAlpha = b1Ease;
            ctx.fillStyle = '#E2E8F0';
            ctx.font = '600 14px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('ম্যানুয়াল এডিটিং: ৮ ঘণ্টা', -28, -42);

            drawRoundedRect(ctx, -28, -32, 205, 12, 6);
            ctx.fillStyle = 'rgba(51, 65, 85, 0.7)';
            ctx.fill();

            const barW1 = 55 * b1Ease + Math.sin(t * 2) * 4;
            drawRoundedRect(ctx, -28, -32, barW1, 12, 6);
            ctx.fillStyle = '#64748B';
            ctx.fill();
            ctx.restore();
          }

          // 4. Comparison Bar 2 ("AI মোশন রেন্ডার: ৩০ সেকেন্ড") flashes in at p: 0.62 -> 0.80
          const bar2Prog = getSpeechElementProg(p, 0.62, 0.16);
          if (bar2Prog > 0.001) {
            const b2Ease = easeOutBack(bar2Prog);
            ctx.save();
            ctx.globalAlpha = Math.min(1, bar2Prog * 1.5);
            ctx.fillStyle = '#E2E8F0';
            ctx.font = '600 14px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('AI মোশন রেন্ডার: ৩০ সেকেন্ড', -28, 10);

            drawRoundedRect(ctx, -28, 20, 205, 12, 6);
            ctx.fillStyle = 'rgba(51, 65, 85, 0.7)';
            ctx.fill();

            const barW2 = 195 * b2Ease;
            drawRoundedRect(ctx, -28, 20, barW2, 12, 6);
            ctx.fillStyle = scene.accentColor;
            ctx.fill();

            // Laser Glint on AI Bar
            const glintX = -28 + ((t * 180) % 195);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(glintX, 26, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // 5. 10X SPEED Badge pops in at speech conclusion (p: 0.78 -> 0.92)
          const badgeProg = getSpeechElementProg(p, 0.78, 0.14);
          if (badgeProg > 0.001) {
            const bEase = easeOutElastic(badgeProg);
            ctx.save();
            ctx.translate(140, -68 + Math.sin(t * 3) * 4);
            ctx.scale(bEase, bEase);
            drawRoundedRect(ctx, -40, -14, 80, 28, 6);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.fill();
            ctx.strokeStyle = scene.accentColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = '700 11px "JetBrains Mono", monospace';
            ctx.fillStyle = scene.accentColor;
            ctx.textAlign = 'center';
            ctx.fillText('10X SPEED', 0, 4);
            ctx.restore();
          }

          ctx.restore();
        }
      } else if (scene.visualType === 'script-to-voice') {
        // 1. Left Document Card slides in (p: 0.02 -> 0.20)
        const docProg = getSpeechElementProg(p, 0.02, 0.18);
        if (docProg > 0.001) {
          const docEase = easeOutCubic(docProg);
          ctx.save();
          ctx.translate(-250 + (1 - docEase) * -30, -85);
          ctx.globalAlpha = docEase;
          drawRoundedRect(ctx, 0, 0, 140, 155, 16);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(scene.accentColor, 0.65);
          ctx.lineWidth = 2;
          ctx.stroke();

          // 2. Typing Lines on Script reveal line-by-line as narrator speaks (p: 0.16 -> 0.44)
          for (let line = 0; line < 4; line++) {
            const lineProg = getSpeechElementProg(p, 0.16 + line * 0.07, 0.10);
            if (lineProg > 0.001) {
              const lineW = (line === 3 ? 55 : 95) * easeOutCubic(lineProg);
              drawRoundedRect(ctx, 20, 30 + line * 26, lineW, 10, 5);
              ctx.fillStyle = line === 0 ? scene.accentColor : 'rgba(203, 213, 225, 0.7)';
              ctx.fill();
            }
          }

          // Blinking cursor
          if (p >= 0.16) {
            const cursorOpacity = Math.floor(t * 3) % 2 === 0 ? 1 : 0.2;
            ctx.fillStyle = hexToRgba(scene.accentColor, cursorOpacity);
            drawRoundedRect(ctx, 85, 108, 8, 12, 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 3. Center Waveform & Traveling Data Sparks ignite as speech connects ideas (p: 0.44 -> 0.68)
        const bridgeProg = getSpeechElementProg(p, 0.44, 0.18);
        if (bridgeProg > 0.001) {
          const brEase = easeOutCubic(bridgeProg);
          ctx.save();
          ctx.globalAlpha = brEase;

          // Waveform bars
          for (let b = -45; b <= 45; b += 12) {
            const amp = Math.max(
              8,
              (16 + Math.abs(Math.sin(t * 6.5 + b * 0.25)) * 36) * brEase
            );
            drawRoundedRect(ctx, b - 3, -amp / 2, 6, amp, 3);
            ctx.fillStyle = scene.accentColor;
            ctx.fill();
          }

          // Flowing data sparks
          for (let pt = 0; pt < 7; pt++) {
            const ptProgress = ((t * 0.85 + pt * 0.16) % 1);
            const px = -105 + ptProgress * 200;
            const py = -10 + Math.sin(ptProgress * Math.PI * 2 + t * 4) * 16;
            ctx.fillStyle = pt % 2 === 0 ? scene.accentColor : '#FFFFFF';
            ctx.shadowColor = scene.accentColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        }

        // 4. Right AI TTS Voice Node materializes at speech destination (p: 0.66 -> 0.88)
        const ttsProg = getSpeechElementProg(p, 0.66, 0.18);
        if (ttsProg > 0.001) {
          const ttsEase = easeOutElastic(ttsProg);
          ctx.save();
          ctx.translate(110 + (1 - Math.min(1, ttsProg * 1.5)) * 25, -85);
          ctx.globalAlpha = Math.min(1, ttsProg * 1.4);

          drawRoundedRect(ctx, 0, 0, 140, 155, 16);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(scene.accentColor, 0.65);
          ctx.lineWidth = 2;
          ctx.stroke();

          // Concentric broadcasting soundwave rings
          for (let ring = 0; ring < 2; ring++) {
            const ringRad = 32 + ((t * 28 + ring * 18) % 40);
            const ringAlpha = Math.max(0, 1 - ringRad / 72);
            ctx.beginPath();
            ctx.arc(70, 75, ringRad, 0, Math.PI * 2);
            ctx.strokeStyle = hexToRgba(scene.accentColor, ringAlpha * 0.6);
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(70, 75, (24 + Math.sin(t * 4) * 3) * ttsEase, 0, Math.PI * 2);
          ctx.fillStyle = scene.accentColor;
          ctx.fill();

          ctx.fillStyle = '#0F172A';
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('AI TTS', 70, 80);

          ctx.restore();
        }
      } else if (scene.visualType === '3d-layers') {
        // Continuous Isometric 3D Levitation with speech-staggered layer arrivals
        // Layer 2 (Bottom) enters at 0.04, Layer 1 (Middle) at 0.28, Layer 0 (Top) at 0.52
        for (let layer = 2; layer >= 0; layer--) {
          const layerTriggerP = layer === 2 ? 0.04 : layer === 1 ? 0.28 : 0.52;
          const lProg = getSpeechElementProg(p, layerTriggerP, 0.18);
          if (lProg <= 0.001) continue;
          const lEase = easeOutBack(lProg);

          const harmonicFloat = Math.sin(t * 2.5 + layer * 1.2) * 9;
          const zOffset = (layer - 1) * 44 + harmonicFloat + (1 - lEase) * 60;
          ctx.save();
          ctx.translate(0, zOffset);
          ctx.scale(lEase, 0.56 * lEase);
          ctx.rotate(Math.PI / 4 + Math.sin(t * 0.8) * 0.06);

          drawRoundedRect(ctx, -110, -110, 220, 220, 24);
          ctx.fillStyle =
            layer === 0
              ? hexToRgba(scene.accentColor, 0.88)
              : layer === 1
              ? 'rgba(30, 41, 59, 0.88)'
              : 'rgba(15, 23, 42, 0.85)';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(scene.accentColor, layer === 0 ? 1 : 0.5);
          ctx.lineWidth = 3;
          ctx.stroke();

          // Moving Laser Scan Line across top layer
          if (layer === 0 && lProg >= 0.8) {
            const scanPos = -90 + ((t * 120) % 180);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(scanPos, -100);
            ctx.lineTo(scanPos, 100);
            ctx.stroke();
          }

          drawRoundedRect(ctx, -70, -70, 140, 140, 14);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Orbiting 3D Geometric Satellite Elements pop in at p: 0.72 -> 0.92
        const tokenProg = getSpeechElementProg(p, 0.72, 0.16);
        if (tokenProg > 0.001) {
          const tokEase = easeOutElastic(tokenProg);
          const orbitAngle = t * 1.4;
          const satX = Math.cos(orbitAngle) * 165;
          const satY = Math.sin(orbitAngle) * 75;
          ctx.save();
          ctx.translate(satX, satY);
          ctx.scale(tokEase, tokEase);
          ctx.rotate(t * 2);
          drawRoundedRect(ctx, -14, -14, 28, 28, 6);
          ctx.fillStyle = scene.accentColor;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      } else if (scene.visualType === 'audio-sync') {
        // 1. Central "SYNC" Speaker Cone forms with opening voice (p: 0.03 -> 0.20)
        const coneProg = getSpeechElementProg(p, 0.03, 0.18);
        if (coneProg > 0.001) {
          const coneEase = easeOutElastic(coneProg);
          const bassPulse = (48 + Math.abs(Math.sin(t * 6)) * 8) * coneEase;
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, bassPulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fill();
          ctx.strokeStyle = scene.accentColor;
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = '#F8FAFC';
          ctx.font = '700 15px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('SYNC', 0, 5);
          ctx.restore();
        }

        // 2. 32 Radial Frequency Bars burst outward with speech rhythm (p: 0.24 -> 0.52)
        const eqProg = getSpeechElementProg(p, 0.24, 0.20);
        if (eqProg > 0.001) {
          const eqEase = easeOutBack(eqProg);
          const bars = 32;
          ctx.save();
          for (let i = 0; i < bars; i++) {
            const angle = (i / bars) * Math.PI * 2 + t * 0.35;
            const wave =
              Math.abs(Math.sin(t * 5.5 + i * 0.45)) * 46 * eqEase;
            const r1 = 64 * eqEase;
            const r2 = r1 + 12 + wave;
            ctx.strokeStyle = i % 2 === 0 ? scene.accentColor : '#F8FAFC';
            ctx.lineWidth = 4.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
            ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 3. Lower Audio Spectrum Wave Bar undulates into view (p: 0.56 -> 0.84)
        const waveProg = getSpeechElementProg(p, 0.56, 0.18);
        if (waveProg > 0.001) {
          const wEase = easeOutCubic(waveProg);
          ctx.save();
          ctx.translate(0, 110 + (1 - wEase) * 35);
          ctx.globalAlpha = wEase;
          for (let sw = -180; sw <= 180; sw += 12) {
            const samp = Math.abs(Math.sin(t * 7 + sw * 0.05)) * 26 * wEase;
            drawRoundedRect(ctx, sw - 3, -samp / 2, 6, samp, 3);
            ctx.fillStyle = hexToRgba(scene.accentColor, 0.75);
            ctx.fill();
          }
          ctx.restore();
        }
      } else {
        // Multi-Track Timeline Live Deck - Each track slides in with speech stages
        // 1. Deck Box (p: 0.02 -> 0.18)
        const deckProg = getSpeechElementProg(p, 0.02, 0.16);
        if (deckProg > 0.001) {
          const dEase = easeOutCubic(deckProg);
          ctx.save();
          ctx.scale(dEase, dEase);
          drawRoundedRect(ctx, -230, -90, 460, 175, 18);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(scene.accentColor, 0.7);
          ctx.lineWidth = 2;
          ctx.stroke();

          // 2. Track 1, 2, 3 enter sequentially with speech progression
          const tracks = [
            { y: -55, w: 320, x: -195, col: scene.accentColor, label: '3D MOTION', triggerP: 0.22 },
            { y: -15, w: 260, x: -140, col: '#38BDF8', label: 'VOICE TTS', triggerP: 0.44 },
            { y: 25, w: 350, x: -195, col: '#10B981', label: 'LYRIA MUSIC', triggerP: 0.66 },
          ];
          tracks.forEach((tr) => {
            const trProg = getSpeechElementProg(p, tr.triggerP, 0.16);
            if (trProg <= 0.001) return;
            const trEase = easeOutCubic(trProg);

            drawRoundedRect(ctx, -200, tr.y, 400 * trEase, 24, 6);
            ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
            ctx.fill();

            // Active track clip
            drawRoundedRect(
              ctx,
              tr.x,
              tr.y + 3,
              tr.w * trEase,
              18,
              4
            );
            ctx.fillStyle = tr.col;
            ctx.fill();

            // Track label
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '600 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(tr.label, -190, tr.y + 16);
          });

          // 3. Playhead & Shimmering Trace (p: 0.76 -> 0.96)
          const playProg = getSpeechElementProg(p, 0.76, 0.16);
          if (playProg > 0.001) {
            const playheadX = -190 + ((t * 85) % 380);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = scene.accentColor;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(playheadX, -75);
            ctx.lineTo(playheadX, 65);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          ctx.restore();
        }
      }
      ctx.restore();

      // Floating 3D Callout Cards - Animates in sequentially in sync with speech progression
      const elements = scene.floatingElements || [];
      const cardSpeechTriggers = [0.20, 0.46, 0.72];
      elements.slice(0, 3).forEach((elText, idx) => {
        const triggerP = cardSpeechTriggers[idx] || (0.2 + idx * 0.25);
        if (p < triggerP) return; // Completely hidden until speech arrives at this thought!

        // Card entrance progress runs over a smooth 0.12 timeline window
        const elProg = Math.min(1, (p - triggerP) / 0.12);
        const easeEl =
          preset === 'bouncy-elastic'
            ? easeOutElastic(elProg)
            : preset === 'aggressive-linear'
            ? easeAggressiveLinear(elProg)
            : easeOutBack(elProg);

        let ex = centerX;
        let ey = stageTopY;
        if (isVertical) {
          ex = centerX + (idx - 1) * 195;
          ey = stageTopY + 150 + (idx % 2) * 28;
        } else {
          ex = idx === 0 ? centerX - 365 : idx === 1 ? centerX + 365 : centerX + 335;
          ey = idx === 0 ? stageTopY - 45 : idx === 1 ? stageTopY - 65 : stageTopY + 62;
        }

        const floatOffset = Math.sin(t * floatSpeed + idx * 1.7) * (floatAmp * 0.75);
        const cardBreath = 1 + Math.sin(t * 3 + idx) * 0.02;
        ctx.save();
        ctx.translate(ex, ey + floatOffset);

        // Animate scale up with elastic bounce on speech trigger
        const scaleVal = Math.max(0.01, easeEl * cardBreath);
        ctx.scale(scaleVal, scaleVal);
        ctx.globalAlpha = alpha * Math.min(1, elProg * 1.6);

        ctx.font = '600 15px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
        const textWidth = ctx.measureText(elText).width;
        const boxW = Math.max(150, textWidth + 44);
        const boxH = 42;

        // Entry ripple ring expanding on appearance
        if (elProg < 0.95) {
          const rippleR = (1 - elProg) * 24;
          ctx.strokeStyle = hexToRgba(scene.accentColor, (1 - elProg) * 0.7);
          ctx.lineWidth = 2;
          drawRoundedRect(ctx, -boxW / 2 - rippleR, -boxH / 2 - rippleR, boxW + rippleR * 2, boxH + rippleR * 2, 12);
          ctx.stroke();
        }

        drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fill();
        ctx.strokeStyle = hexToRgba(scene.accentColor, 0.75);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pulsing active dot
        const dotPulse = Math.sin(t * 5 + idx * 2) * 1.2;
        drawRoundedRect(ctx, -boxW / 2 + 13 - dotPulse / 2, -5 - dotPulse / 2, 10 + dotPulse, 10 + dotPulse, 3);
        ctx.fillStyle = scene.accentColor;
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(elText, -boxW / 2 + 32, 1);
        ctx.restore();
      });

      // Kinetic Typography Main Headline & Subheadline - Animates in sync with speech
      const textStartY = isVertical ? height * 0.63 : height * 0.66;
      ctx.save();
      const slideDist =
        preset === 'bouncy-elastic' ? 24 : preset === 'aggressive-linear' ? 10 : 18;
      const slideOffset = (1 - presetEased) * slideDist;
      ctx.translate(centerX, textStartY + slideOffset);

      // Main Headline Words Reveal & Voice Progression Sync
      const headlineWords = scene.headline.trim().split(/\s+/);
      ctx.font = `700 ${isVertical ? 34 : 42}px "Plus Jakarta Sans", "Hind Siliguri", sans-serif`;
      ctx.textBaseline = 'middle';

      // Measure total line width to center
      const spaceWidth = ctx.measureText(' ').width;
      const wordMetrics = headlineWords.map((w) => ({
        text: w,
        width: ctx.measureText(w).width,
      }));
      const totalHeadlineWidth =
        wordMetrics.reduce((sum, wm) => sum + wm.width, 0) +
        (headlineWords.length - 1) * spaceWidth;

      let wordCursorX = -totalHeadlineWidth / 2;

      // Stagger word entrance over early speech window (p from 0.0 to 0.28)
      wordMetrics.forEach((wm, wIdx) => {
        const wTrigger = (wIdx / Math.max(1, headlineWords.length)) * 0.26;
        const wProg = Math.min(1, Math.max(0, (p - wTrigger) / 0.08));
        if (wProg > 0.01) {
          const wScale = easeOutBack(wProg);
          const isSpokenActive = p >= wTrigger && p < wTrigger + 0.16;
          ctx.save();
          ctx.translate(wordCursorX + wm.width / 2, 0);
          ctx.scale(wScale, wScale);
          ctx.globalAlpha = alpha * Math.min(1, wProg * 1.5);
          ctx.textAlign = 'center';
          ctx.fillStyle = isSpokenActive ? scene.accentColor : '#FFFFFF';
          if (isSpokenActive) {
            ctx.shadowColor = scene.accentColor;
            ctx.shadowBlur = 12;
          }
          ctx.fillText(wm.text, 0, 0);
          ctx.restore();
        }
        wordCursorX += wm.width + spaceWidth;
      });

      // Subheadline slides in as the opening phrase settles (p from 0.18 to 0.36)
      const subProg = Math.min(1, Math.max(0, (p - 0.18) / 0.14));
      if (subProg > 0.01) {
        const subEase = easeOutCubic(subProg);
        ctx.save();
        ctx.globalAlpha = alpha * subProg;
        ctx.translate(0, (isVertical ? 44 : 48) + (1 - subEase) * 12);
        ctx.font = `500 ${isVertical ? 18 : 21}px "DM Sans", "Hind Siliguri", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = scene.accentColor;
        ctx.fillText(scene.subheadline, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      ctx.restore();
    };

    /**
     * Renders Visual Side Effects (দৃশ্যমান সাইড ইফেক্ট):
     * 1. Dynamic Side Aura / Lateral Glow on left & right borders
     * 2. Side Floating Embers / Edge Particles
     * 3. Corner HUD Frame Brackets & Tech Reticles
     * 4. Transition Shockwave Ripple
     * 5. Motion Speed Streaks
     */
    const drawVisualSideEffects = (
      ctx: CanvasRenderingContext2D,
      activeScene: MotionScene,
      nextScene: MotionScene,
      blendT: number,
      t: number,
      preset: string
    ) => {
      ctx.save();

      const accentCol = blendT > 0 ? lerpColorHex(activeScene.accentColor, nextScene.accentColor, blendT, 1) : activeScene.accentColor;

      // 1. Dynamic Side Aura / Lateral Glow (Curtain Gradients on Left & Right)
      const auraPulse = Math.sin(t * 3.5) * 0.08 + (blendT > 0 ? blendT * 0.25 : 0.14);
      const auraWidth = Math.min(220, width * 0.22);

      // Left Aura
      const leftAura = ctx.createLinearGradient(0, height * 0.5, auraWidth, height * 0.5);
      leftAura.addColorStop(0, hexToRgba(accentCol, auraPulse));
      leftAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftAura;
      ctx.fillRect(0, 0, auraWidth, height);

      // Right Aura
      const rightAura = ctx.createLinearGradient(width, height * 0.5, width - auraWidth, height * 0.5);
      rightAura.addColorStop(0, hexToRgba(accentCol, auraPulse));
      rightAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightAura;
      ctx.fillRect(width - auraWidth, 0, auraWidth, height);

      // 2. Side Floating Embers / Edge Particles (drifting along left & right margins)
      const particleCount = 14;
      for (let i = 0; i < particleCount; i++) {
        // Left Margin Particles
        const lProg = ((t * 0.18 + i * 0.07) % 1);
        const ly = height * (1 - lProg);
        const lx = 20 + Math.sin(t * 2 + i * 1.5) * 18 + (i % 3) * 14;
        const lAlpha = Math.sin(lProg * Math.PI) * 0.65;
        ctx.fillStyle = i % 2 === 0 ? hexToRgba(accentCol, lAlpha) : `rgba(255, 255, 255, ${lAlpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5 + (i % 2) * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Right Margin Particles
        const rProg = ((t * 0.22 + i * 0.08) % 1);
        const ry = height * (1 - rProg);
        const rx = width - 20 - Math.sin(t * 2.2 + i * 1.8) * 18 - (i % 3) * 14;
        const rAlpha = Math.sin(rProg * Math.PI) * 0.65;
        ctx.fillStyle = i % 2 === 0 ? hexToRgba(accentCol, rAlpha) : `rgba(255, 255, 255, ${rAlpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5 + (i % 2) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Cinematic Corner HUD Frame Brackets & Tech Reticles
      const bracketSize = 24;
      const pad = 18;
      ctx.strokeStyle = hexToRgba(accentCol, 0.7);
      ctx.lineWidth = 2;

      // Top-Left Corner Bracket
      ctx.beginPath();
      ctx.moveTo(pad, pad + bracketSize);
      ctx.lineTo(pad, pad);
      ctx.lineTo(pad + bracketSize, pad);
      ctx.stroke();

      // Top-Right Corner Bracket
      ctx.beginPath();
      ctx.moveTo(width - pad - bracketSize, pad);
      ctx.lineTo(width - pad, pad);
      ctx.lineTo(width - pad, pad + bracketSize);
      ctx.stroke();

      // Bottom-Left Corner Bracket
      ctx.beginPath();
      ctx.moveTo(pad, height - pad - bracketSize);
      ctx.lineTo(pad, height - pad);
      ctx.lineTo(pad + bracketSize, height - pad);
      ctx.stroke();

      // Bottom-Right Corner Bracket
      ctx.beginPath();
      ctx.moveTo(width - pad - bracketSize, height - pad);
      ctx.lineTo(width - pad, height - pad);
      ctx.lineTo(width - pad, height - pad - bracketSize);
      ctx.stroke();

      // HUD Live Status Reticle Tag (Top-Right)
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = hexToRgba(accentCol, 0.85);
      ctx.fillText(`SIDE FX: ACTIVE · PRESET: ${(preset || 'Smooth').toUpperCase()}`, width - pad - 6, pad + 14);

      // 4. Transition Shockwave Ripple (Expanding circular wave when transitioning)
      if (blendT > 0.01) {
        const maxWaveR = Math.max(width, height) * 0.65;
        const waveR = blendT * maxWaveR;
        const waveAlpha = (1 - blendT) * 0.55;
        ctx.strokeStyle = hexToRgba(accentCol, waveAlpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.5, waveR, 0, Math.PI * 2);
        ctx.stroke();

        // Inner secondary ripple
        if (waveR > 40) {
          ctx.strokeStyle = hexToRgba('#FFFFFF', waveAlpha * 0.4);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(width * 0.5, height * 0.5, waveR * 0.75, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const renderLoop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const {
        scenes: curScenes,
        sceneTimings: curTimings,
        totalDuration: curTotal,
        isPlaying: curPlaying,
        aspectRatio: curAspect,
        showSubtitles: curSubs,
        show3DGrid: curGrid,
        showSideFx: curSideFx,
        onSceneChange: cbSceneChange,
        onTimeSync: cbTimeSync,
        onSfxTrigger: cbSfxTrigger,
      } = latestPropsRef.current;

      // Advance high-precision playback clock directly in ref (zero React re-render overhead!)
      if (curPlaying && curTotal > 0) {
        currentTimeRef.current = (currentTimeRef.current + dt) % curTotal;
      }
      continuousTime += curPlaying ? dt : dt * 0.25;

      const globalT = currentTimeRef.current;

      // Find active scene index & progress
      let activeIdx = 0;
      let activeProgress = 0;
      let timeRemainingInScene = 999;

      for (let i = 0; i < curTimings.length; i++) {
        const slot = curTimings[i];
        if (globalT >= slot.start && globalT < slot.end) {
          activeIdx = i;
          activeProgress = Math.max(0, Math.min(1, (globalT - slot.start) / slot.duration));
          timeRemainingInScene = slot.end - globalT;
          break;
        }
      }

      // Live SFX Synchronization during preview
      if (curPlaying && cbSfxTrigger && curScenes.length > 0) {
        const activeScene = curScenes[activeIdx];
        const sceneKey = `scene-${activeIdx}`;

        // 1. Scene Switch SFX Trigger
        if (activeIdx !== lastReportedSceneIdx) {
          if (activeIdx > 0) {
            cbSfxTrigger('whoosh');
          }
          if (activeScene?.motionPreset === 'aggressive-linear') {
            cbSfxTrigger('impact');
          } else if (activeScene?.motionPreset === 'bouncy-elastic') {
            cbSfxTrigger('pop');
          }
          sfxFiredMapRef.clear();
        }

        // 2. Floating card pop milestones staggered with spoken speech (at 0.20, 0.46, 0.72)
        [0.20, 0.46, 0.72].forEach((popThreshold, pIdx) => {
          const popKey = `${sceneKey}-pop-${pIdx}`;
          if (activeProgress >= popThreshold && !sfxFiredMapRef.has(popKey)) {
            sfxFiredMapRef.add(popKey);
            cbSfxTrigger('pop');
          }
        });

        // 3. Audio sync chime cue
        if (activeScene?.visualType === 'audio-sync') {
          const chimeKey = `${sceneKey}-chime`;
          if (activeProgress >= 0.4 && !sfxFiredMapRef.has(chimeKey)) {
            sfxFiredMapRef.add(chimeKey);
            cbSfxTrigger('chime');
          }
        }
      }

      // Notify parent only when scene index changes or every ~120ms for scrubber UI
      if (activeIdx !== lastReportedSceneIdx) {
        lastReportedSceneIdx = activeIdx;
        if (cbSceneChange) cbSceneChange(activeIdx);
      }
      if (curPlaying && now - lastUiSyncTimestamp > 120) {
        lastUiSyncTimestamp = now;
        if (cbTimeSync) cbTimeSync(globalT);
      }

      const canvas = canvasRef.current;
      if (canvas && curScenes.length > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const activeScene = curScenes[activeIdx] || curScenes[0];
          const nextIdx = (activeIdx + 1) % curScenes.length;
          const nextScene = curScenes[nextIdx] || activeScene;

          // Smooth Cross-Dissolve Window during the last 0.42s of each scene
          const transitionDuration = Math.min(0.42, (activeScene.duration || 4) * 0.18);
          const isTransitioning =
            curScenes.length > 1 && timeRemainingInScene < transitionDuration;
          const blendT = isTransitioning
            ? easeInOutCubic(1 - timeRemainingInScene / transitionDuration)
            : 0;

          ctx.save();
          ctx.clearRect(0, 0, width, height);

          // 1. Continuous Blended Studio Background
          const bgGrad = ctx.createRadialGradient(
            width * 0.5 + Math.sin(continuousTime * 0.7) * 60,
            height * 0.42 + Math.cos(continuousTime * 0.5) * 40,
            40,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.75
          );
          bgGrad.addColorStop(
            0,
            lerpColorHex(activeScene.accentColor, nextScene.accentColor, blendT, 0.22)
          );
          bgGrad.addColorStop(0.45, '#0F172A');
          bgGrad.addColorStop(1, '#070A10');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, width, height);

          // 2. Uninterrupted 3D Perspective Grid
          if (curGrid) {
            ctx.save();
            ctx.strokeStyle = lerpColorHex(
              activeScene.accentColor,
              nextScene.accentColor,
              blendT,
              0.12
            );
            ctx.lineWidth = 1;
            const gridSpacing = 64;
            const offsetX = (continuousTime * 28) % gridSpacing;
            const offsetY = (continuousTime * 18) % gridSpacing;

            for (let x = -gridSpacing; x < width + gridSpacing; x += gridSpacing) {
              ctx.beginPath();
              ctx.moveTo(x + offsetX, 0);
              ctx.lineTo(x + offsetX - (width / 2 - x) * 0.22, height);
              ctx.stroke();
            }
            for (let y = -gridSpacing; y < height + gridSpacing; y += gridSpacing) {
              ctx.beginPath();
              ctx.moveTo(0, y + offsetY);
              ctx.lineTo(width, y + offsetY);
              ctx.stroke();
            }
            ctx.restore();
          }

          const isVertical = curAspect === '9:16';

          // 3. Render Active Scene (and outgoing/incoming blend during scene handoff)
          if (isTransitioning) {
            // Outgoing scene glides smoothly left & scales slightly
            drawSceneVisuals(
              ctx,
              activeScene,
              activeProgress,
              continuousTime,
              1 - blendT,
              -blendT * 48,
              1 + blendT * 0.05,
              isVertical
            );
            // Incoming next scene glides smoothly in from right
            drawSceneVisuals(
              ctx,
              nextScene,
              blendT * 0.08,
              continuousTime,
              blendT,
              (1 - blendT) * 48,
              0.94 + blendT * 0.06,
              isVertical
            );
          } else {
            drawSceneVisuals(
              ctx,
              activeScene,
              activeProgress,
              continuousTime,
              1,
              0,
              1,
              isVertical
            );
          }

          // 4. Visual Side Effects (Lateral Glow, Edge Particles, Corner HUD Brackets, Transition Ripple)
          if (curSideFx !== false) {
            drawVisualSideEffects(
              ctx,
              activeScene,
              nextScene,
              blendT,
              continuousTime,
              activeScene.motionPreset || 'smooth-ease'
            );
          }

          // 5. Synchronized Word-by-Word Narration Subtitle Bar
          const subtitleScene = blendT > 0.6 ? nextScene : activeScene;
          const subtitleProgress = blendT > 0.6 ? 0 : activeProgress;

          if (curSubs && subtitleScene.narration) {
            const words = subtitleScene.narration.trim().split(/\s+/);
            const activeWordIndex = Math.min(
              words.length - 1,
              Math.floor(subtitleProgress * words.length)
            );

            const chunkSize = isVertical ? 6 : 10;
            const chunkIndex = Math.floor(activeWordIndex / chunkSize);
            const chunkWords = words.slice(
              chunkIndex * chunkSize,
              (chunkIndex + 1) * chunkSize
            );
            const activeInChunk = activeWordIndex - chunkIndex * chunkSize;

            const centerX = width * 0.5;
            const subY = height - (isVertical ? 110 : 68);
            ctx.save();
            ctx.font = `600 ${isVertical ? 20 : 22}px "DM Sans", "Hind Siliguri", sans-serif`;

            const fullLine = chunkWords.join(' ');
            const totalW = ctx.measureText(fullLine).width;
            const padX = 32;
            const waveWidth = 26;
            const pillW = Math.min(width - 48, totalW + padX * 2 + waveWidth);

            drawRoundedRect(ctx, centerX - pillW / 2, subY - 26, pillW, 52, 14);
            ctx.fillStyle = 'rgba(7, 10, 16, 0.88)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Live Voice Speaking Waveform Indicator
            const waveStartX = centerX - pillW / 2 + 16;
            for (let b = 0; b < 3; b++) {
              const bH = 6 + Math.abs(Math.sin(continuousTime * 9 + b * 1.6)) * 14;
              drawRoundedRect(ctx, waveStartX + b * 6, subY - bH / 2, 3, bH, 1.5);
              ctx.fillStyle = subtitleScene.accentColor;
              ctx.fill();
            }

            let cursorX = centerX - totalW / 2 + waveWidth / 2;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            chunkWords.forEach((word, wIdx) => {
              const wordW = ctx.measureText(word + ' ').width;
              if (wIdx === activeInChunk) {
                drawRoundedRect(ctx, cursorX - 4, subY - 16, wordW, 32, 6);
                ctx.fillStyle = hexToRgba(subtitleScene.accentColor, 0.35);
                ctx.fill();
                ctx.strokeStyle = hexToRgba(subtitleScene.accentColor, 0.7);
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = subtitleScene.accentColor;
              } else if (wIdx < activeInChunk) {
                ctx.fillStyle = '#F8FAFC';
              } else {
                ctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
              }
              ctx.fillText(word, cursorX, subY);
              cursorX += wordW;
            });

            ctx.restore();
          }

          // 6. Continuous Overall Progress Hairline Bar & Corner Frame Counter
          const overallProgress = curTotal > 0 ? globalT / curTotal : activeProgress;
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(0, height - 5, width, 5);
          ctx.fillStyle = activeScene.accentColor;
          ctx.fillRect(0, height - 5, width * overallProgress, 5);

          ctx.font = '500 13px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
          ctx.textAlign = 'left';
          ctx.fillText(
            `SCENE ${String(activeIdx + 1).padStart(2, '0')}/${String(
              curScenes.length
            ).padStart(2, '0')} · ${globalT.toFixed(1)}s / ${curTotal.toFixed(1)}s`,
            24,
            32
          );
          ctx.restore();

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [width, height, canvasRef, currentTimeRef]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#070A10] p-4 overflow-hidden select-none">
      <div
        className={`relative shadow-2xl border border-slate-800/90 rounded-xl overflow-hidden bg-[#070A10] ${
          aspectRatio === '16:9'
            ? 'w-full max-w-[920px] aspect-video'
            : aspectRatio === '9:16'
            ? 'h-full max-h-[540px] aspect-[9/16]'
            : 'h-full max-h-[520px] aspect-square'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full block object-contain"
        />
      </div>
    </div>
  );
};

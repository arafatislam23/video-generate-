import React, { useEffect, useRef } from 'react';
import { MotionScene } from '../data/defaultProject';

export interface SceneTimingSlot {
  start: number;
  end: number;
  duration: number;
}

interface MotionStageProps {
  scenes: MotionScene[];
  sceneTimings: SceneTimingSlot[];
  totalDuration: number;
  currentTimeRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1';
  showSubtitles: boolean;
  show3DGrid: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onSceneChange?: (newSceneIndex: number) => void;
  onTimeSync?: (time: number) => void;
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

export const MotionStage: React.FC<MotionStageProps> = ({
  scenes,
  sceneTimings,
  totalDuration,
  currentTimeRef,
  isPlaying,
  aspectRatio,
  showSubtitles,
  show3DGrid,
  canvasRef,
  onSceneChange,
  onTimeSync,
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
    onSceneChange,
    onTimeSync,
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
      onSceneChange,
      onTimeSync,
    };
  }, [
    scenes,
    sceneTimings,
    totalDuration,
    isPlaying,
    aspectRatio,
    showSubtitles,
    show3DGrid,
    onSceneChange,
    onTimeSync,
  ]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();
    let continuousTime = 0;
    let lastReportedSceneIdx = -1;
    let lastUiSyncTimestamp = 0;

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
      const springEntry =
        scene.animationStyle === 'spring-pop'
          ? easeOutBack(entryProgress)
          : easeOutCubic(entryProgress);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Smooth Camera Drift + Cross-Scene Glide
      const camShiftX =
        transitionShiftX +
        (scene.cameraAngle === 'dynamic-pan'
          ? (p - 0.5) * 34
          : scene.cameraAngle === 'isometric-tilt'
          ? Math.sin(t * 1.1) * 10
          : 0);
      const camShiftY =
        scene.cameraAngle === 'deep-perspective' ? Math.cos(t * 0.9) * 9 : 0;

      ctx.translate(camShiftX, camShiftY);

      const centerX = width * 0.5;
      const stageTopY = isVertical ? height * 0.26 : height * 0.34;

      // Central 2D & 3D Motion Graphic Illustration
      ctx.save();
      ctx.translate(centerX, stageTopY);
      const baseScale = isVertical ? 0.85 : 1;
      const scaleFactor =
        baseScale * (0.86 + 0.14 * springEntry) * transitionScale;
      ctx.scale(scaleFactor, scaleFactor);

      if (scene.visualType === 'kinetic-intro') {
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate(t * (0.55 + i * 0.25) * (i % 2 === 0 ? 1 : -1));
          ctx.strokeStyle = hexToRgba(scene.accentColor, (0.55 - i * 0.14) * alpha);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 150 + i * 38, 62 + i * 16, 0.35 * i, 0, Math.PI * 2);
          ctx.stroke();

          const angle = t * (1.4 + i * 0.4);
          const nx = Math.cos(angle) * (150 + i * 38);
          const ny = Math.sin(angle) * (62 + i * 16);
          ctx.fillStyle = scene.accentColor;
          ctx.beginPath();
          ctx.arc(nx, ny, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        const floatY = Math.sin(t * 2.4) * 8;
        ctx.save();
        ctx.translate(0, floatY);
        ctx.fillStyle = hexToRgba(scene.accentColor, 0.9);
        ctx.beginPath();
        ctx.moveTo(0, -68);
        ctx.lineTo(64, -34);
        ctx.lineTo(0, 0);
        ctx.lineTo(-64, -34);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = hexToRgba(scene.accentColor, 0.62);
        ctx.beginPath();
        ctx.moveTo(-64, -34);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, 68);
        ctx.lineTo(-64, 34);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = hexToRgba(scene.accentColor, 0.38);
        ctx.beginPath();
        ctx.moveTo(64, -34);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, 68);
        ctx.lineTo(64, 34);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (scene.visualType === 'no-editing-clock') {
        ctx.save();
        drawRoundedRect(ctx, -210, -95, 420, 170, 20);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fill();
        ctx.strokeStyle = hexToRgba(scene.accentColor, 0.58);
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-105, -10, 52, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(
          -105,
          -10,
          52,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 1.65 * Math.max(0.2, entryProgress)
        );
        ctx.strokeStyle = scene.accentColor;
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.save();
        ctx.translate(-105, -10);
        ctx.rotate(t * 4);
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -34);
        ctx.stroke();
        ctx.restore();

        const labels = ['Manual Keyframes: 8h', 'AI Motion Render: 30s'];
        labels.forEach((lbl, idx) => {
          const by = -42 + idx * 52;
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '600 15px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(lbl, -28, by);

          drawRoundedRect(ctx, -28, by + 10, 205, 12, 6);
          ctx.fillStyle = 'rgba(51, 65, 85, 0.7)';
          ctx.fill();

          const barW = idx === 0 ? 60 : 195 * Math.max(0.25, entryProgress);
          drawRoundedRect(ctx, -28, by + 10, barW, 12, 6);
          ctx.fillStyle = idx === 0 ? '#64748B' : scene.accentColor;
          ctx.fill();
        });
        ctx.restore();
      } else if (scene.visualType === 'script-to-voice') {
        ctx.save();
        drawRoundedRect(ctx, -250, -85, 150, 155, 16);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = hexToRgba(scene.accentColor, 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let line = 0; line < 4; line++) {
          const lineW = (line === 3 ? 65 : 108) * Math.min(1, Math.max(0.3, entryProgress * 1.3));
          drawRoundedRect(ctx, -230, -55 + line * 26, lineW, 10, 5);
          ctx.fillStyle = line === 0 ? scene.accentColor : 'rgba(203, 213, 225, 0.65)';
          ctx.fill();
        }

        for (let b = -60; b <= 60; b += 12) {
          const amp = Math.max(
            6,
            (14 + Math.abs(Math.sin(t * 6 + b * 0.2)) * 38) * Math.max(0.3, entryProgress)
          );
          drawRoundedRect(ctx, b - 3, -amp / 2, 6, amp, 3);
          ctx.fillStyle = scene.accentColor;
          ctx.fill();
        }

        drawRoundedRect(ctx, 100, -85, 150, 155, 16);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = hexToRgba(scene.accentColor, 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(175, -10, 36 + Math.sin(t * 5) * 4, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(scene.accentColor, 0.25);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(175, -10, 22, 0, Math.PI * 2);
        ctx.fillStyle = scene.accentColor;
        ctx.fill();

        ctx.fillStyle = '#0F172A';
        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AI TTS', 175, -5);
        ctx.restore();
      } else if (scene.visualType === '3d-layers') {
        for (let layer = 2; layer >= 0; layer--) {
          const zOffset = (layer - 1) * 42 + Math.sin(t * 2.2 + layer) * 7;
          ctx.save();
          ctx.translate(0, zOffset);
          ctx.scale(1, 0.56);
          ctx.rotate(Math.PI / 4 + Math.sin(t * 0.6) * 0.08);

          drawRoundedRect(ctx, -110, -110, 220, 220, 24);
          ctx.fillStyle =
            layer === 0
              ? hexToRgba(scene.accentColor, 0.85)
              : layer === 1
              ? 'rgba(30, 41, 59, 0.88)'
              : 'rgba(15, 23, 42, 0.85)';
          ctx.fill();
          ctx.strokeStyle = hexToRgba(scene.accentColor, layer === 0 ? 1 : 0.45);
          ctx.lineWidth = 3;
          ctx.stroke();

          drawRoundedRect(ctx, -70, -70, 140, 140, 14);
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      } else if (scene.visualType === 'audio-sync') {
        ctx.save();
        const bars = 28;
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2 + t * 0.3;
          const wave =
            Math.abs(Math.sin(t * 5 + i * 0.55)) * 42 * Math.max(0.35, entryProgress);
          const r1 = 62;
          const r2 = r1 + 14 + wave;
          ctx.strokeStyle = i % 2 === 0 ? scene.accentColor : '#F8FAFC';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
          ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fill();
        ctx.strokeStyle = scene.accentColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 15px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SYNC', 0, 5);
        ctx.restore();
      } else {
        ctx.save();
        drawRoundedRect(ctx, -230, -90, 460, 165, 18);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = hexToRgba(scene.accentColor, 0.65);
        ctx.lineWidth = 2;
        ctx.stroke();

        const tracks = [
          { y: -55, w: 320, x: -195, col: scene.accentColor },
          { y: -15, w: 260, x: -140, col: '#38BDF8' },
          { y: 25, w: 350, x: -195, col: '#10B981' },
        ];
        tracks.forEach((tr) => {
          drawRoundedRect(ctx, -200, tr.y, 400, 24, 6);
          ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
          ctx.fill();

          drawRoundedRect(
            ctx,
            tr.x,
            tr.y + 3,
            tr.w * Math.max(0.3, entryProgress),
            18,
            4
          );
          ctx.fillStyle = tr.col;
          ctx.fill();
        });

        const playheadX = -190 + ((p * 370) % 370);
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(playheadX, -75);
        ctx.lineTo(playheadX, 60);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Floating 3D Callout Cards
      const elements = scene.floatingElements || [];
      elements.slice(0, 3).forEach((elText, idx) => {
        const elDelay = idx * 0.08;
        const elProg = Math.max(0, Math.min(1, (p - elDelay) * 4.2));
        if (elProg <= 0.01) return;
        const easeEl = easeOutBack(elProg);

        let ex = centerX;
        let ey = stageTopY;
        if (isVertical) {
          ex = centerX + (idx - 1) * 195;
          ey = stageTopY + 150 + (idx % 2) * 28;
        } else {
          ex = idx === 0 ? centerX - 365 : idx === 1 ? centerX + 365 : centerX + 335;
          ey = idx === 0 ? stageTopY - 45 : idx === 1 ? stageTopY - 65 : stageTopY + 62;
        }

        const floatOffset = Math.sin(t * 2.2 + idx * 1.7) * 6;
        ctx.save();
        ctx.translate(ex, ey + floatOffset);
        ctx.scale(0.8 + 0.2 * easeEl, 0.8 + 0.2 * easeEl);
        ctx.globalAlpha = alpha * Math.min(1, elProg * 1.5);

        ctx.font = '600 15px "Plus Jakarta Sans", "Hind Siliguri", sans-serif';
        const textWidth = ctx.measureText(elText).width;
        const boxW = Math.max(150, textWidth + 44);
        const boxH = 42;

        drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fill();
        ctx.strokeStyle = hexToRgba(scene.accentColor, 0.65);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        drawRoundedRect(ctx, -boxW / 2 + 14, -5, 10, 10, 3);
        ctx.fillStyle = scene.accentColor;
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(elText, -boxW / 2 + 32, 1);
        ctx.restore();
      });

      // Kinetic Typography Main Headline & Subheadline
      const textStartY = isVertical ? height * 0.63 : height * 0.66;
      ctx.save();
      const slideOffset = (1 - easeOutCubic(entryProgress)) * 18;
      ctx.translate(centerX, textStartY + slideOffset);
      ctx.globalAlpha = alpha * Math.min(1, Math.max(0.2, entryProgress * 1.8));

      ctx.font = `700 ${isVertical ? 34 : 42}px "Plus Jakarta Sans", "Hind Siliguri", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(scene.headline, 0, 0);

      ctx.font = `500 ${isVertical ? 18 : 21}px "DM Sans", "Hind Siliguri", sans-serif`;
      ctx.fillStyle = scene.accentColor;
      ctx.fillText(scene.subheadline, 0, isVertical ? 44 : 48);
      ctx.restore();

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
        onSceneChange: cbSceneChange,
        onTimeSync: cbTimeSync,
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
            lerpColorHex(activeScene.accentColor, nextScene.accentColor, blendT, 0.2)
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
              0.11
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

          // 4. Synchronized Word-by-Word Narration Subtitle Bar
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
            const padX = 28;
            const pillW = Math.min(width - 48, totalW + padX * 2);

            drawRoundedRect(ctx, centerX - pillW / 2, subY - 26, pillW, 52, 12);
            ctx.fillStyle = 'rgba(7, 10, 16, 0.84)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();

            let cursorX = centerX - totalW / 2;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            chunkWords.forEach((word, wIdx) => {
              const wordW = ctx.measureText(word + ' ').width;
              if (wIdx === activeInChunk) {
                drawRoundedRect(ctx, cursorX - 4, subY - 16, wordW, 32, 6);
                ctx.fillStyle = hexToRgba(subtitleScene.accentColor, 0.28);
                ctx.fill();
                ctx.fillStyle = subtitleScene.accentColor;
              } else if (wIdx < activeInChunk) {
                ctx.fillStyle = '#F8FAFC';
              } else {
                ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
              }
              ctx.fillText(word, cursorX, subY);
              cursorX += wordW;
            });

            ctx.restore();
          }

          // 5. Continuous Overall Progress Hairline Bar & Corner Frame Counter
          const overallProgress = curTotal > 0 ? globalT / curTotal : activeProgress;
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(0, height - 5, width, 5);
          ctx.fillStyle = activeScene.accentColor;
          ctx.fillRect(0, height - 5, width * overallProgress, 5);

          ctx.font = '500 13px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
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

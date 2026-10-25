import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Modality, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Slices a 24kHz 16-bit mono WAV buffer into proportional WAV segments,
 * each with its own valid 44-byte RIFF WAV header.
 */
function splitWavBufferByWeights(wavBuffer: Buffer, weights: number[]): string[] {
  if (wavBuffer.length <= 44 || weights.length <= 1) {
    return [wavBuffer.toString("base64")];
  }

  const sampleRate = wavBuffer.readUInt32LE(24) || 24000;
  const numChannels = wavBuffer.readUInt16LE(22) || 1;
  const bitsPerSample = wavBuffer.readUInt16LE(34) || 16;
  const bytesPerSample = (bitsPerSample / 8) * numChannels;

  const pcmData = wavBuffer.subarray(44);
  const totalSamples = Math.floor(pcmData.length / bytesPerSample);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const segments: string[] = [];
  let currentSampleOffset = 0;

  for (let i = 0; i < weights.length; i++) {
    const isLast = i === weights.length - 1;
    const sampleCount = isLast
      ? totalSamples - currentSampleOffset
      : Math.max(1, Math.floor((weights[i] / totalWeight) * totalSamples));

    const byteStart = currentSampleOffset * bytesPerSample;
    const byteLength = Math.max(0, sampleCount * bytesPerSample);
    const slicePcm = pcmData.subarray(byteStart, byteStart + byteLength);
    currentSampleOffset += sampleCount;

    const segBuffer = Buffer.alloc(44 + slicePcm.length);
    // Copy original header and update chunk sizes
    wavBuffer.copy(segBuffer, 0, 0, 44);
    segBuffer.writeUInt32LE(36 + slicePcm.length, 4);
    segBuffer.writeUInt32LE(slicePcm.length, 40);
    slicePcm.copy(segBuffer, 44);

    segments.push(segBuffer.toString("base64"));
  }

  return segments;
}

/**
 * Generates TTS audio with automatic fallback between gemini-3.8-flash-lite-tts
 * and gemini-3.8-flash-tts if one model hits free-tier rate limits.
 */
function splitBengaliText(text: string, maxLen = 140): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = -1;
    const delimiters = ["।", "?", "!", ",", " "];
    for (const d of delimiters) {
      const idx = remaining.lastIndexOf(d, maxLen);
      if (idx > 20) {
        splitIdx = idx + (d === " " ? 0 : 1);
        break;
      }
    }
    if (splitIdx === -1) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks.filter((c) => c.length > 0);
}

async function fetchBengaliTtsBuffer(text: string): Promise<Buffer> {
  const chunks = splitBengaliText(text.trim());
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&tl=bn&client=tw-ob&q=" +
      encodeURIComponent(chunk);
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!resp.ok) {
      throw new Error(`TTS failed with status: ${resp.status}`);
    }
    const arr = await resp.arrayBuffer();
    buffers.push(Buffer.from(arr));
  }
  return Buffer.concat(buffers);
}

async function generateTtsAudio(
  text: string,
  voiceName: string,
  style: string,
  emotion: string = "Energetic"
): Promise<{ audioBase64: string; mimeType: string }> {
  const ai = getAIClient();
  const modelsToTry = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];

  const hasBengali = /[\u0980-\u09FF]/.test(text);
  let lastErr: any = null;

  const emotionNuances: Record<string, string> = {
    Energetic: "with vibrant high energy, punchy pace, enthusiasm, and dynamic presenter cadence",
    Happy: "with a warm, cheerful, uplifting, smiling, and joyful tone",
    Serious: "with an authoritative, grounded, professional, deep, and serious cadence",
    Whispering: "in a quiet, intimate, dramatic, suspenseful whisper",
    Inspiring: "with passionate, visionary, motivational, and emotionally moving warmth",
    Curious: "with intrigue, wonder, thought-provoking inflection, and engaging curiosity",
  };

  const emotionGuidance =
    emotionNuances[emotion] || `in an expressive ${emotion.toLowerCase()} tone`;

  // 1. Try Gemini Neural TTS first for realistic human voice, emotional cadence, and breathing
  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: hasBengali
                  ? `Narrate ${emotionGuidance} in natural, fluent human Bengali like a professional presenter: ${text}`
                  : `Narrate ${emotionGuidance}: ${text}`,
                // @ts-ignore
                speechMetadata: {
                  style: `Emotion: ${emotion} (${emotionGuidance}). Narration style: ${style}`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || "Puck" },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const mimeType =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ||
        "audio/wav";

      if (base64Audio) {
        return { audioBase64: base64Audio, mimeType };
      }
    } catch (err: any) {
      lastErr = err;
    }
  }

  // 2. Fall back to native Bengali TTS stream if Gemini TTS hits 429 quota or network error
  if (hasBengali) {
    try {
      const buf = await fetchBengaliTtsBuffer(text);
      return {
        audioBase64: buf.toString("base64"),
        mimeType: "audio/mpeg",
      };
    } catch {
      // Ignore
    }
  }

  throw lastErr || new Error("TTS generation failed.");
}

const SCENE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Unique scene ID like scene-1" },
      narration: {
        type: Type.STRING,
        description: "Exact spoken voiceover sentence for this scene in the original language of the script",
      },
      headline: {
        type: Type.STRING,
        description: "Short, punchy 2-5 word kinetic headline displayed prominently on screen (same language as script)",
      },
      subheadline: {
        type: Type.STRING,
        description: "Supporting subtitle or key takeaway phrase (same language as script)",
      },
      visualType: {
        type: Type.STRING,
        description:
          "One of: 'kinetic-intro', 'no-editing-clock', 'script-to-voice', '3d-layers', 'audio-sync', 'live-editor', 'cta-outro'",
      },
      animationStyle: {
        type: Type.STRING,
        description:
          "One of: 'spring-pop', '3d-orbit', 'kinetic-slide', 'typewriter-glow', 'isometric-stack'",
      },
      accentColor: {
        type: Type.STRING,
        description: "Hex color code such as #F59E0B, #38BDF8, #10B981, #A855F7, #F43F5E, #06B6D4",
      },
      duration: {
        type: Type.NUMBER,
        description: "Estimated duration in seconds between 3.5 and 6.5 based on sentence length",
      },
      floatingElements: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 concise visual callout labels or motion graphics layer tags that appear in the 2D/3D scene",
      },
      cameraAngle: {
        type: Type.STRING,
        description: "One of: 'isometric-tilt', 'front-cinematic', 'dynamic-pan', 'deep-perspective'",
      },
      voiceEmotion: {
        type: Type.STRING,
        description: "One of: 'Energetic', 'Happy', 'Serious', 'Whispering', 'Inspiring', 'Curious'",
      },
    },
    required: [
      "id",
      "narration",
      "headline",
      "subheadline",
      "visualType",
      "animationStyle",
      "accentColor",
      "duration",
      "floatingElements",
      "cameraAngle",
    ],
  },
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // 1. Native High-Accuracy Bengali TTS Audio Stream
  app.get("/api/bengali-tts", async (req, res) => {
    try {
      const text = (req.query.text as string) || "";
      if (!text.trim()) {
        res.status(400).send("Text is required");
        return;
      }
      const buffer = await fetchBengaliTtsBuffer(text);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (err: any) {
      res.status(500).send(err.message || "Failed to generate Bengali TTS");
    }
  });

  // 2. AI Script-to-Motion-Graphics Scene Storyboard Generator
  app.post("/api/generate-scenes", async (req, res) => {
    try {
      const { script, stylePreset = "3D Isometric & Kinetic" } = req.body;
      if (!script || typeof script !== "string") {
        res.status(400).json({ error: "Please provide a valid script." });
        return;
      }

      const ai = getAIClient();
      const prompt = `You are an expert Motion Graphics Director. Break the following script into a sequence of synchronized 2D/3D motion graphics scenes (typically 5 to 8 scenes, one per sentence or logical beat).
Keep the narration, headline, subheadline, and floatingElements in the same language as the input script (e.g., Bengali if the script is in Bengali, English if in English).
Visual style preset requested: ${stylePreset}.
Assign varied visualType values from: 'kinetic-intro', 'no-editing-clock', 'script-to-voice', '3d-layers', 'audio-sync', 'live-editor', 'cta-outro'.
Assign varied animationStyle values from: 'spring-pop', '3d-orbit', 'kinetic-slide', 'typewriter-glow', 'isometric-stack'.

Script:
"""
${script}
"""`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-4-argon",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: SCENE_SCHEMA,
          },
        });
      } catch (_argonErr) {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: SCENE_SCHEMA,
          },
        });
      }

      const text = response.text || "[]";
      let scenes = JSON.parse(text.trim());
      if (Array.isArray(scenes)) {
        scenes = scenes.map((s: any) => {
          if (s.narration && /[\u0980-\u09FF]/.test(s.narration)) {
            s.voiceAudioUrl = `/api/bengali-tts?text=${encodeURIComponent(s.narration)}`;
          }
          return s;
        });
      }
      res.json({ scenes });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || "Failed to generate motion graphics scenes from script.",
      });
    }
  });

  // 2. Single-Scene AI Voiceover Generator
  app.post("/api/generate-voiceover", async (req, res) => {
    try {
      const {
        text,
        voiceName = "Kore",
        style = "Clear, engaging, professional motion graphics narrator",
        emotion = "Energetic",
      } = req.body;

      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required for voiceover generation." });
        return;
      }

      const { audioBase64, mimeType } = await generateTtsAudio(
        text,
        voiceName,
        style,
        emotion
      );
      res.json({ audioBase64, mimeType });
    } catch (error: any) {
      const isQuota =
        String(error?.message || "").includes("429") ||
        String(error?.message || "").includes("RESOURCE_EXHAUSTED");
      res.status(200).json({
        rateLimited: isQuota,
        error: isQuota
          ? "Free tier TTS rate limit reached (3 requests/min). Switched to instant Browser Voice Synthesis."
          : error?.message || "Voiceover generation failed.",
      });
    }
  });

  // 3. Batch All-Scenes AI Voiceover Generator (Uses 1 single API request to avoid 429 rate limits!)
  app.post("/api/generate-batch-voiceover", async (req, res) => {
    try {
      const {
        narrations,
        voiceName = "Kore",
        style = "Clear, engaging, professional motion graphics narrator",
        emotions = [],
      } = req.body;

      if (!Array.isArray(narrations) || narrations.length === 0) {
        res.status(400).json({ error: "Narrations array is required." });
        return;
      }

      const isBengali = narrations.some((n: string) => /[\u0980-\u09FF]/.test(n));

      if (isBengali) {
        // Synthesize each scene with exact native Bengali voice and emotional direction
        const audioSegments: string[] = [];
        for (let i = 0; i < narrations.length; i++) {
          const n = narrations[i];
          const em = Array.isArray(emotions) && emotions[i] ? emotions[i] : "Energetic";
          try {
            const { audioBase64 } = await generateTtsAudio(n, voiceName, style, em);
            audioSegments.push(audioBase64);
          } catch {
            audioSegments.push("");
          }
        }
        res.json({
          audioSegments,
          mimeType: "audio/mpeg",
        });
        return;
      }

      const combinedScript = narrations.map((n: string) => n.trim()).join(" ... ");
      const { audioBase64, mimeType } = await generateTtsAudio(
        combinedScript,
        voiceName,
        style,
        Array.isArray(emotions) && emotions[0] ? emotions[0] : "Energetic"
      );

      const fullWavBuffer = Buffer.from(audioBase64, "base64");
      const weights = narrations.map((n: string) => Math.max(8, n.trim().length));
      const audioSegments = splitWavBufferByWeights(fullWavBuffer, weights);

      res.json({
        audioSegments,
        mimeType,
      });
    } catch (error: any) {
      const isQuota =
        String(error?.message || "").includes("429") ||
        String(error?.message || "").includes("RESOURCE_EXHAUSTED");
      res.status(200).json({
        rateLimited: isQuota,
        error: isQuota
          ? "Free tier TTS rate limit reached (3 requests/min). Switched to instant Browser Voice Synthesis."
          : error?.message || "Batch voiceover generation failed.",
      });
    }
  });

  // 4. AI Music Generator using Lyria (lyria-3-clip-preview or lyria-3-pro-preview)
  app.post("/api/generate-music", async (req, res) => {
    try {
      const {
        prompt,
        model = "lyria-3-clip-preview",
      } = req.body;

      if (!prompt || typeof prompt !== "string") {
        res.status(400).json({ error: "Music prompt is required." });
        return;
      }

      const selectedModel =
        model === "lyria-3-pro-preview"
          ? "lyria-3-pro-preview"
          : "lyria-3-clip-preview";

      const ai = getAIClient();
      const response = await ai.models.generateContentStream({
        model: selectedModel,
        contents: prompt,
        config: {
          responseModalities: [Modality.AUDIO],
        },
      });

      let audioBase64 = "";
      let lyrics = "";
      let mimeType = "audio/wav";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        res.status(200).json({
          fallback: true,
          error: "Lyria stream completed without returning audio bytes.",
        });
        return;
      }

      res.json({
        audioBase64,
        mimeType,
        lyrics,
        model: selectedModel,
      });
    } catch (error: any) {
      res.status(200).json({
        fallback: true,
        error:
          error?.message ||
          "Music generation with Lyria requires a paid API key.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

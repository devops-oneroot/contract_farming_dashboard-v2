"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Minus, Pause, Play, Plus, RotateCcw, RotateCw, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";

import { Spinner } from "./loading";

/** "1:05" */
export function clock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A URL that downloads rather than streams: the backend's /api/media route
 * sends Content-Disposition with ?download=1, Cloudinary with fl_attachment.
 */
export function downloadUrl(src: string) {
  if (src.includes("/api/media/")) return `${src}${src.includes("?") ? "&" : "?"}download=1`;
  return src.includes("/upload/") ? src.replace("/upload/", "/upload/fl_attachment/") : src;
}

/** One tone control: its range in dB (or semitones for pitch) and step. */
type Knob = "bass" | "mid" | "treble" | "pitch";
const KNOBS: { key: Knob; label: string; hint: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "bass", label: "Bass", hint: "Low end, below 200 Hz", min: -12, max: 12, step: 1, unit: "dB" },
  { key: "mid", label: "Mid", hint: "Voice body, around 1 kHz", min: -12, max: 12, step: 1, unit: "dB" },
  { key: "treble", label: "Treble", hint: "Clarity, above 3 kHz", min: -12, max: 12, step: 1, unit: "dB" },
  { key: "pitch", label: "Pitch", hint: "Higher or lower voice (also changes the pace)", min: -6, max: 6, step: 1, unit: "st" },
];
type Tone = Record<Knob, number>;
const FLAT: Tone = { bass: 0, mid: 0, treble: 0, pitch: 0 };

/** Quick settings for typical field recordings. */
const PRESETS: { label: string; tone: Tone }[] = [
  { label: "Normal", tone: FLAT },
  { label: "Clear voice", tone: { bass: -4, mid: 3, treble: 5, pitch: 0 } },
  { label: "Reduce hum", tone: { bass: -10, mid: 0, treble: 2, pitch: 0 } },
  { label: "Warm", tone: { bass: 5, mid: 1, treble: -3, pitch: 0 } },
];

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const sameTone = (a: Tone, b: Tone) => KNOBS.every((k) => a[k.key] === b[k.key]);

/**
 * The recording player popup: a live visualizer, seek bar, ±10 s, speed and
 * volume, and Bass / Mid / Treble / Pitch that can be raised or lowered while
 * it plays.
 *
 * The file is fetched into the page first (the backend allows it from any
 * origin), so the browser's audio graph may process it - a cross-origin file
 * played straight from its URL would come out silent. When it cannot be
 * fetched (e.g. a provider's link that refuses), it still plays, without the
 * tone controls.
 */
export function AudioStudioDialog({
  src,
  title = "Recording",
  subtitle,
  fallbackSeconds = 0,
  onClose,
}: {
  src: string;
  title?: string;
  subtitle?: string;
  fallbackSeconds?: number;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graph = useRef<{
    ctx: AudioContext;
    bass: BiquadFilterNode;
    mid: BiquadFilterNode;
    treble: BiquadFilterNode;
    gain: GainNode;
    analyser: AnalyserNode;
  } | null>(null);
  const raf = useRef<number | null>(null);

  /** The blob URL to play, or the original when it could not be fetched. */
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const [toneReady, setToneReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(fallbackSeconds);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [tone, setTone] = useState<Tone>(FLAT);
  /** The last settings changed by hand with − / +, brought back by the Custom chip. */
  const [customTone, setCustomTone] = useState<Tone | null>(null);

  // Fetch the file into the page so the audio graph can process it.
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setPlaySrc(url);
        setToneReady(true);
      })
      .catch(() => {
        if (!alive) return;
        // Plays as it is; the tone controls need the file in the page.
        setPlaySrc(src);
        setToneReady(false);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  /** Build the audio graph once, on the first play (browsers need a click first). */
  const ensureGraph = useCallback(() => {
    const el = audioRef.current;
    if (!el || graph.current || !toneReady) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(el);
    const bass = Object.assign(ctx.createBiquadFilter(), { type: "lowshelf" as BiquadFilterType });
    bass.frequency.value = 200;
    const mid = Object.assign(ctx.createBiquadFilter(), { type: "peaking" as BiquadFilterType });
    mid.frequency.value = 1000;
    mid.Q.value = 0.9;
    const treble = Object.assign(ctx.createBiquadFilter(), { type: "highshelf" as BiquadFilterType });
    treble.frequency.value = 3000;
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(bass).connect(mid).connect(treble).connect(gain).connect(analyser).connect(ctx.destination);
    graph.current = { ctx, bass, mid, treble, gain, analyser };
  }, [toneReady]);

  // Tone, volume, speed and pitch follow the controls, live.
  useEffect(() => {
    const g = graph.current;
    if (g) {
      const t = g.ctx.currentTime;
      g.bass.gain.setTargetAtTime(tone.bass, t, 0.05);
      g.mid.gain.setTargetAtTime(tone.mid, t, 0.05);
      g.treble.gain.setTargetAtTime(tone.treble, t, 0.05);
      g.gain.gain.setTargetAtTime(muted ? 0 : volume, t, 0.05);
    }
    const el = audioRef.current;
    if (el) {
      // Without the graph, volume goes on the element itself.
      el.volume = g ? 1 : muted ? 0 : volume;
      // Pitch: the playback rate moves the pitch too, so the speed setting is
      // kept as the base. At 0 semitones the browser keeps the voice natural.
      const ratio = Math.pow(2, tone.pitch / 12);
      el.preservesPitch = tone.pitch === 0;
      el.playbackRate = speed * ratio;
    }
  }, [tone, volume, muted, speed, playSrc]);

  // The visualizer: frequency bars while playing, a calm line when paused.
  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current;
      if (c) {
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== w * dpr || c.height !== h * dpr) {
          c.width = w * dpr;
          c.height = h * dpr;
        }
        const g2 = c.getContext("2d");
        if (g2) {
          g2.setTransform(dpr, 0, 0, dpr, 0, 0);
          g2.clearRect(0, 0, w, h);
          const color = getComputedStyle(c).color;
          const bars = 48;
          const gap = 3;
          const bw = (w - gap * (bars - 1)) / bars;
          const data = new Uint8Array(graph.current?.analyser.frequencyBinCount ?? 0);
          if (graph.current && playing) graph.current.analyser.getByteFrequencyData(data);
          for (let i = 0; i < bars; i++) {
            const v = data.length ? data[Math.floor((i / bars) * data.length * 0.8)] / 255 : 0;
            // A gentle idle wave when there is nothing to show.
            const idle = playing && !graph.current ? 0.25 + 0.2 * Math.abs(Math.sin(Date.now() / 300 + i / 3)) : 0.06;
            const bh = Math.max(3, (v || idle) * h);
            g2.fillStyle = color;
            g2.globalAlpha = 0.35 + 0.65 * (v || idle);
            const x = i * (bw + gap);
            const y = (h - bh) / 2;
            g2.beginPath();
            g2.roundRect(x, y, bw, bh, Math.min(bw / 2, 3));
            g2.fill();
          }
          g2.globalAlpha = 1;
        }
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  // Element events: time, length, end.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setElapsed(el.currentTime);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration);
    };
    const onEnd = () => setPlaying(false);
    const onError = () => setLoadError("This recording could not be played.");
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onError);
    };
  }, [playSrc]);

  // Closing releases the audio graph (the <audio> stops as it leaves the page).
  useEffect(
    () => () => {
      graph.current?.ctx.close().catch(() => {});
      graph.current = null;
    },
    []
  );

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !playSrc) return;
    if (el.paused) {
      // Only one recording audible at a time.
      document.querySelectorAll("audio").forEach((a) => a !== el && a.pause());
      ensureGraph();
      await graph.current?.ctx.resume().catch(() => {});
      el.play().then(
        () => setPlaying(true),
        () => setLoadError("This recording could not be played.")
      );
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const seek = (t: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(total || el.duration || 0, t));
    setElapsed(el.currentTime);
  };

  const step = (k: Knob, dir: 1 | -1) => {
    const knob = KNOBS.find((x) => x.key === k)!;
    const next = { ...tone, [k]: Math.max(knob.min, Math.min(knob.max, tone[k] + dir * knob.step)) };
    setTone(next);
    // A hand-made setting that matches no preset is remembered as Custom.
    if (!PRESETS.some((p) => sameTone(p.tone, next))) setCustomTone(next);
  };

  // Keys: Space play/pause, ←/→ 5 s, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "BUTTON" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") seek(elapsed + 5);
      else if (e.key === "ArrowLeft") seek(elapsed - 5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Settings that match no preset (changed by hand) show as Custom.
  const activePreset = PRESETS.find((p) => sameTone(p.tone, tone))?.label ?? "Custom";

  return createPortal(
    <div className="modal-backdrop z-[60]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-studio-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-panel flex flex-col overflow-hidden sm:max-w-xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3 bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <h2 id="audio-studio-title" className="truncate text-lg font-semibold">
              {title}
            </h2>
            {subtitle && <p className="truncate text-sm text-white/80">{subtitle}</p>}
          </div>
          <a
            href={downloadUrl(src)}
            download
            title="Download"
            aria-label="Download recording"
            className="rounded-lg p-1.5 text-white/90 hover:bg-white/15"
          >
            <Download size={18} />
          </a>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/90 hover:bg-white/15">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin max-h-[80dvh] space-y-5 overflow-y-auto px-5 py-5">
          {/* Visualizer */}
          <div className="relative rounded-2xl bg-zinc-950 p-4 dark:bg-black">
            <canvas ref={canvasRef} className="h-24 w-full text-brand-400" aria-hidden />
            {!playSrc && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-300">
                <Spinner className="text-brand-400" /> Loading recording…
              </div>
            )}
          </div>

          {/* Seek */}
          <div>
            <input
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={Math.min(elapsed, total || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek"
              className="w-full accent-brand-500"
              disabled={!playSrc}
            />
            <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-zinc-500">
              <span>{clock(elapsed)}</span>
              <span>{clock(total)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => seek(elapsed - 10)}
              disabled={!playSrc}
              aria-label="Back 10 seconds"
              title="Back 10 s"
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <RotateCcw size={20} />
              <span className="absolute text-[8px] font-bold">10</span>
            </button>
            <button
              type="button"
              onClick={toggle}
              disabled={!playSrc}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition hover:scale-105 hover:bg-brand-600 disabled:opacity-50"
            >
              {!playSrc ? <Spinner className="" size={22} /> : playing ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => seek(elapsed + 10)}
              disabled={!playSrc}
              aria-label="Forward 10 seconds"
              title="Forward 10 s"
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <RotateCw size={20} />
              <span className="absolute text-[8px] font-bold">10</span>
            </button>
          </div>

          {loadError && <p className="text-center text-sm text-red-600">{loadError}</p>}

          {/* Speed and volume */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Speed</span>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
                    speed === s
                      ? "bg-brand-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
            <div className="flex min-w-[10rem] flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={toneReady ? 2 : 1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setMuted(false);
                  setVolume(Number(e.target.value));
                }}
                aria-label="Volume"
                className="flex-1 accent-brand-500"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums text-zinc-500">{Math.round((muted ? 0 : volume) * 100)}%</span>
            </div>
          </div>

          {/* Tone */}
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SlidersHorizontal size={15} className="text-brand-600" />
              <span className="text-sm font-semibold">Sound</span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setTone(p.tone)}
                    disabled={!toneReady && p.label !== "Normal"}
                    aria-pressed={activePreset === p.label}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                      activePreset === p.label
                        ? "bg-brand-500 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {/* Selected on its own when a control is changed by hand; tapping it
                    brings back the last hand-made settings after trying a preset. */}
                <button
                  type="button"
                  onClick={() => customTone && setTone(customTone)}
                  disabled={!customTone}
                  aria-pressed={activePreset === "Custom"}
                  title={customTone ? "Your own settings" : "Change Bass, Mid, Treble or Pitch with − / + to make your own"}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                    activePreset === "Custom"
                      ? "bg-brand-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {KNOBS.map((k) => {
                const v = tone[k.key];
                // Bass, Mid and Treble need the audio graph; Pitch works on any file.
                const off = k.key !== "pitch" && !toneReady;
                const range = k.max - k.min;
                return (
                  <div
                    key={k.key}
                    title={k.hint}
                    className={`flex flex-col items-center gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900 ${off ? "opacity-40" : ""}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{k.label}</span>
                    {/* A vertical meter: the centre line is 0, the fill shows up or down. */}
                    <div className="relative h-20 w-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <span className="absolute inset-x-0 top-1/2 h-px bg-zinc-400 dark:bg-zinc-600" aria-hidden />
                      <span
                        className={`absolute inset-x-0 rounded-full transition-all duration-150 ${v >= 0 ? "bg-brand-500" : "bg-sky-500"}`}
                        style={
                          v >= 0
                            ? { bottom: "50%", height: `${(v / range) * 100}%` }
                            : { top: "50%", height: `${(-v / range) * 100}%` }
                        }
                        aria-hidden
                      />
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {v > 0 ? "+" : ""}
                      {v} <span className="text-[10px] font-normal text-zinc-400">{k.unit}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => step(k.key, -1)}
                        disabled={off || v <= k.min}
                        aria-label={`Decrease ${k.label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        <Minus size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => step(k.key, 1)}
                        disabled={off || v >= k.max}
                        aria-label={`Increase ${k.label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {playSrc && !toneReady && (
              <p className="mt-3 text-xs text-zinc-500">
                Bass, Mid and Treble aren&apos;t available for this recording (its source doesn&apos;t allow it). Pitch, speed and volume still work.
              </p>
            )}
          </div>
        </div>

        {playSrc && <audio ref={audioRef} src={playSrc} preload="auto" className="hidden" />}
      </div>
    </div>,
    document.body
  );
}

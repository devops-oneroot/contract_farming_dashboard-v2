"use client";

import { useState } from "react";
import { Download, Play } from "lucide-react";

import { AudioStudioDialog, clock, downloadUrl } from "./audio-studio";

/**
 * A recording's play button. Clicking it opens the player popup
 * (AudioStudioDialog): visualizer, seek, speed, volume, and Bass / Mid /
 * Treble / Pitch controls while it plays.
 *
 * `compact` keeps only play + length, for tables. `title` / `subtitle` head
 * the popup, e.g. who was called and when.
 */
export function AudioPlayer({
  src,
  compact = false,
  fallbackSeconds = 0,
  title,
  subtitle,
}: {
  src: string;
  compact?: boolean;
  /** Duration recorded at capture, shown on the button. */
  fallbackSeconds?: number;
  title?: string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`flex max-w-full items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 dark:bg-zinc-900 ${
          compact ? "w-fit" : "w-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Play recording"
          title="Play recording"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition hover:scale-105 hover:bg-brand-600"
        >
          <Play size={15} className="ml-0.5" />
        </button>

        {!compact && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-1.5 min-w-8 flex-1 rounded-full bg-zinc-300 dark:bg-zinc-700"
            aria-label="Open the player"
            tabIndex={-1}
          />
        )}

        <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
          {fallbackSeconds > 0 ? clock(fallbackSeconds) : "Play"}
        </span>

        <a
          href={downloadUrl(src)}
          download
          title="Download recording"
          aria-label="Download recording"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200 hover:text-brand-600 dark:hover:bg-zinc-800"
        >
          <Download size={14} />
        </a>
      </div>

      {open && (
        <AudioStudioDialog
          src={src}
          title={title}
          subtitle={subtitle}
          fallbackSeconds={fallbackSeconds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

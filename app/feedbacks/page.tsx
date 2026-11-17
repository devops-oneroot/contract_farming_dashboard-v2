import { MessageSquareHeart } from "lucide-react";

/** Feedbacks - a place for the telecallers' feedback. Nothing to list yet. */
export default function FeedbacksPage() {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
        <MessageSquareHeart size={22} />
      </span>
      <h2 className="text-lg font-semibold">Feedbacks</h2>
      <p className="max-w-sm text-sm text-zinc-500">No feedback yet. Feedback collected on calls will be listed here.</p>
    </div>
  );
}

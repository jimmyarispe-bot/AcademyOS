import {
  JAG_LEARN_INSTRUCTOR_DISPLAY_NAME,
  resolveJagLearnVideoPlayback,
  type JagLearnVideoPlaybackInput,
} from "@/lib/jag-command-center/learning/media";

/**
 * Reusable Mr. JAG™ Learning Center video player.
 * Catalog instructional content only — no third-party trackers, no autoplay with sound.
 */
export function JagLearningVideo({
  videoUrl,
  captionsUrl = null,
  posterUrl = null,
  title,
  className,
}: JagLearnVideoPlaybackInput & {
  readonly className?: string;
}) {
  const playback = resolveJagLearnVideoPlayback({
    videoUrl,
    captionsUrl,
    posterUrl,
    title,
  });

  if (playback.kind === "unavailable") {
    return (
      <div
        className={
          className ??
          "rounded-lg border border-[var(--jag-border)] bg-[var(--jag-panel)] px-4 py-6"
        }
        data-jag-learn-video="unavailable"
        data-jag-instructor={playback.instructorId}
      >
        <p className="text-sm font-medium text-[var(--jag-text)]">
          {playback.instructorDisplayName} video
        </p>
        <p className="mt-1 text-xs text-[var(--jag-muted)]">
          {playback.reason === "invalid_url"
            ? "This tutorial video URL is not available."
            : `${JAG_LEARN_INSTRUCTOR_DISPLAY_NAME} video coming soon. Interactive steps and walkthrough remain available below.`}
        </p>
      </div>
    );
  }

  return (
    <figure
      className={className ?? "space-y-2"}
      data-jag-learn-video="ready"
      data-jag-instructor={playback.instructorId}
    >
      <div className="overflow-hidden rounded-lg border border-[var(--jag-border)] bg-[#000000] p-3">
        <video
          className="aspect-video w-full max-h-[70vh] bg-[#000000]"
          controls
          controlsList="nodownload"
          preload="metadata"
          playsInline
          src={playback.videoUrl}
          poster={playback.posterUrl ?? undefined}
          aria-label={`${playback.instructorDisplayName}: ${playback.title}`}
        >
          {playback.captionsUrl ? (
            <track
              kind="captions"
              src={playback.captionsUrl}
              srcLang="en"
              label="English captions"
              default
            />
          ) : null}
          Your browser does not support embedded video.{" "}
          <a
            href={playback.videoUrl}
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Open the {playback.instructorDisplayName} video
          </a>
          .
        </video>
      </div>
      <figcaption className="text-xs text-[var(--jag-muted)]">
        Instructor: {playback.instructorDisplayName} · Catalog instructional
        content
      </figcaption>
    </figure>
  );
}

import { useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AudioPlayer } from "@/components/audio-player";
import { Logo } from "@/components/logo";
import { Transcript } from "@/components/transcript";
import { callTitle } from "./mock";
import { redactPII } from "./lib/pii";
import { BANK_SUPPORT_V2, STATUS_LABEL, gradeCall } from "./lib/scorecard";
import { DEMO_CALLS, DEMO_FEATURED, DEMO_SCORED_ON } from "./demo/data";

const REPO_URL = "https://github.com/Polstuds27/Linewise";
const VIDEO_URL = "https://lnkd.in/p/gXKWvggd";

// Everything the page shows about the featured call is read from the call itself (what
// the pipeline stored for it), so the page cannot drift from what the app does.
const call = DEMO_FEATURED;
const grade = gradeCall(call, BANK_SUPPORT_V2, {});
const seconds = (stamp: string) => { const [m, s] = stamp.split(":").map(Number); return m * 60 + s; };
const labelOf = (id: string) => BANK_SUPPORT_V2.find((c) => c.id === id)?.label ?? id;
const flags = call.results
  .filter((r) => r.verdict === "fail" && r.timestamp)
  .map((r) => ({
    id: r.check_id,
    label: labelOf(r.check_id),
    critical: r.severity === "critical",
    ts: r.timestamp!,
    seconds: seconds(r.timestamp!),
    evidence: redactPII(r.evidence ?? "", call.redactions),
    reason: r.reason ?? "",
  }));
const hiddenLine = call.lines.map((l) => ({ ...l, shown: redactPII(l.text, call.redactions) })).find((l) => l.shown !== l.text);
const SCORED_ON = new Date(`${DEMO_SCORED_ON}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const firstFlag = flags.find((f) => f.critical) ?? flags[0];

// The featured call drawn the way the logo describes it: the lines are the call, the dot
// is the moment worth hearing. Every bar is one word the pipeline transcribed, placed at
// the time it was said, as tall as the word is long: the agent above the line, the customer
// below it. A picture to look at, not a control.
const LINE_W = 300;
const LINE_H = 132;
const MID = LINE_H / 2;
const callSeconds = seconds(call.duration);
const at = (t: number) => (t / callSeconds) * LINE_W;
// Thin bars 2.4 units apart, like the app's waveform. A word fills the bars under its own
// time span; a longer word stands taller.
const PITCH = 2.4;
const wordBars = call.lines.flatMap((l) =>
  (l.words ?? []).flatMap((w, n) => {
    const from = Math.ceil(at(w.start) / PITCH);
    const to = Math.max(from, Math.floor((at(w.end) - 0.6) / PITCH));
    const tall = 9 + Math.min(w.text.length, 11) * 4;
    return Array.from({ length: to - from + 1 }, (_, i) => ({
      x: (from + i) * PITCH,
      height: tall * (0.5 + 0.5 * Math.abs(Math.sin((n + 1) * 2.3 + i * 1.7))),
      up: l.speaker !== "Customer",
    }));
  }),
);

function CallAsLine({ className }: { className?: string }) {
  return (
    <figure className={cn("flex flex-col gap-6", className)}>
      <div className="relative">
        <span className="label absolute top-0 left-0 text-muted-foreground">Agent</span>
        <span className="label absolute bottom-0 left-0 text-muted-foreground">Customer</span>
        <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} preserveAspectRatio="none" role="img" aria-label={`${callTitle(call)} drawn as a line of words, with ${flags.length} flagged moments`} className="h-56 w-full overflow-visible sm:h-64">
          {wordBars.map((b, i) => (
            <rect key={i} x={b.x} y={b.up ? MID - b.height : MID} width={PITCH / 2} height={b.height} className="fill-foreground" />
          ))}
          <line x1="0" x2={LINE_W} y1={MID} y2={MID} className="stroke-background" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={LINE_W} y1={MID} y2={MID} className="stroke-foreground" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {flags.map((f) => (
            <line key={f.id} x1={at(f.seconds)} x2={at(f.seconds)} y1="0" y2={LINE_H} className="stroke-destructive" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {firstFlag && <span aria-hidden className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${(firstFlag.seconds / callSeconds) * 100}%` }} />}
      </div>
      {firstFlag && (
        <figcaption className="flex flex-col gap-2 border-t border-foreground pt-4">
          <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <XIcon aria-hidden className="size-3.5" />
              {firstFlag.critical ? "Critical" : "Fail"} at {firstFlag.ts}
            </span>
            <Badge variant="destructive">
              {grade.score} / 100 · {STATUS_LABEL[grade.status]}
            </Badge>
          </p>
          <p className="text-xl font-medium tracking-tight">{firstFlag.label}</p>
          <p className="label max-w-[52ch] text-muted-foreground">
            {callTitle(call)}, {call.duration} long. The bars are the words Linewise transcribed, agent above the line and customer below. The red lines are the moments it flagged, and the dot is the one to hear first.
          </p>
        </figcaption>
      )}
    </figure>
  );
}

const SECTION = "grid gap-x-10 gap-y-10 border-t border-border py-20 sm:py-28 lg:grid-cols-12";
const HEADING = "display text-4xl sm:text-5xl";
const LEAD = "max-w-[44ch] text-lg leading-relaxed text-muted-foreground";

const STEPS: Array<{ name: string; what: string; shown: ReactNode }> = [
  {
    name: "Transcribe",
    what: "Whisper writes down every word with the time it was said. It runs on the laptop, natively or inside the browser.",
    shown: (
      <p>
        <span className="label mr-3 text-muted-foreground">{call.lines[0].time}</span>
        {call.lines[0].text}
      </p>
    ),
  },
  {
    name: "Tell the speakers apart",
    what: "On a stereo recording each channel is one person. On a mono one, the two voices are separated by sound.",
    shown: (
      <p className="flex flex-wrap gap-x-6 gap-y-1">
        {call.lines.slice(1, 3).map((l) => (
          <span key={l.time}>
            <span className="label mr-2 text-muted-foreground">{l.speaker}</span>
            {l.text}
          </span>
        ))}
      </p>
    ),
  },
  {
    name: "Hide customer details",
    what: "Card numbers, emails, phone numbers, names and addresses are hidden before anyone reads the transcript or exports it.",
    shown: <p>{hiddenLine?.shown}</p>,
  },
  {
    name: "Check the scorecard",
    what: "A small local model answers one yes-or-no question per rule. Code turns the answers into a verdict and keeps the quoted line as evidence.",
    shown: firstFlag && (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 font-medium text-destructive">
          <XIcon aria-hidden className="size-3.5" />
          {firstFlag.critical ? "Critical" : "Fail"}
        </span>
        {firstFlag.label}
        <span className="label text-muted-foreground">{firstFlag.ts}</span>
      </p>
    ),
  },
  {
    name: "Score and flag",
    what: "Rule weights add up to a score out of 100. One broken critical rule fails the call, whatever the number says.",
    shown: (
      <p className="flex items-center gap-3">
        <Badge variant="destructive">
          {grade.score} / 100 · {STATUS_LABEL[grade.status]}
        </Badge>
        <span className="label text-muted-foreground">{flags.length} flags to listen to</span>
      </p>
    ),
  },
];

const REASONS = [
  {
    claim: "The audio never leaves the machine.",
    why: "Recordings carry card numbers, addresses and account details. Linewise transcribes, redacts and scores them on the analyst's own laptop, so there is no third party to trust with them.",
  },
  {
    claim: "It works with the internet off.",
    why: "After a one-time setup the app talks to nothing but the laptop it runs on. Pull the cable and it keeps scoring.",
  },
  {
    claim: "Every call, not a sample.",
    why: "There is no per-minute API bill, so checking all of the calls costs the same as checking a few.",
  },
];

const FEATURES = [
  ["Batch upload and a queue", "Drop in MP3, WAV or M4A files and they are scored one after another."],
  ["Recordings from agents' phones", "An agent shares a recording from an iPhone and it arrives over the office Wi-Fi under their name."],
  ["A transcript that follows the audio", "The word being spoken lights up. Click any word to play from it."],
  ["Flags you can listen to", "Every broken rule is a tick on the waveform. Click it to hear that exact moment."],
  ["Evidence for every verdict", "Each Pass or Fail quotes the line it rests on. A quote that is not in the transcript is rejected."],
  ["Redaction in two layers", "Patterns catch numbers, emails and phones. The local model finds names and addresses."],
  ["A scorecard you can edit", "Add, reword and weight rules, mark the critical ones, and say how each should be judged."],
  ["The analyst has the last word", "Confirm or dismiss any flag. Calls in other languages are marked for scoring by hand."],
  ["An agent dashboard", "Average score, failed calls and the rules each agent misses most."],
  ["Coaching notes", "A short note per call: one strength and the one fix that matters most."],
  ["Redacted PDF reports", "A report per call on Linewise letterhead, with customer details hidden."],
];

const MODELS = [
  ["qwen2.5:3b", "Scores the rules, finds names to hide, writes coaching notes", "Ollama, on the laptop"],
  ["Whisper large-v3-turbo", "Speech to text, when the native service is running", "whisper.cpp, on the laptop"],
  ["Whisper base", "Speech to text, when it is not", "In the browser"],
  ["pyannote segmentation 3.0", "Tells two voices apart on a mono recording", "In the browser"],
];

const LIMITS = [
  "Scoring is tuned for English. Other languages are transcribed and left for an analyst to score.",
  "We do not claim an accuracy rate. The test calls are scripted and spoken by synthetic voices.",
  "Linewise checks recordings. It does not listen to live calls.",
];

const TEXT_LINK = "text-foreground underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-primary hover:decoration-primary";

export function Landing({ local }: { local: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  function playFrom(at: number) {
    const audio = audioRef.current;
    if (!audio || !call.audio) return;
    if (audio.src !== new URL(call.audio, location.href).href) audio.src = call.audio;
    audio.currentTime = at;
    void audio.play().catch(() => {});
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <a href="#/" aria-label="Linewise home"><Logo /></a>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-md:hidden")}>How it works</a>
            <a href="#local" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-md:hidden")}>Why local</a>
            <a href="#features" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-md:hidden")}>Features</a>
            {local && <a href="#/app" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-sm:hidden")}>Open the app</a>}
            <a href="#/demo" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Try the demo</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <section className="animate-hang pt-12 pb-20 sm:pt-20 sm:pb-28">
          <h1 className="display text-5xl sm:text-7xl lg:text-[5.5rem]">
            <span className="lg:block">Every call checked. </span>
            <span className="lg:block">Nothing leaves the laptop.</span>
          </h1>
          <p className={cn(LEAD, "mt-8")}>Linewise transcribes, redacts and scores call center recordings with AI that runs on the QA analyst's own machine.</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a href="#/demo" className={cn(buttonVariants({ size: "lg" }))}>Try the demo</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Run it yourself</a>
            <a href={VIDEO_URL} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>Watch the 1-minute video</a>
          </div>

          <div className="mt-16 sm:mt-20">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
              <div className="flex flex-col gap-2">
                <h2 className="display text-3xl sm:text-4xl">{callTitle(call)}</h2>
                <p className="label max-w-[60ch] text-muted-foreground">
                  A scripted test call, transcribed and scored by Linewise on our laptop on {SCORED_ON}. Press play, or click a red tick.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="display text-3xl tabular-nums sm:text-4xl">
                  <span className="text-destructive">{grade.score}</span>
                  <span className="text-muted-foreground"> / 100</span>
                </p>
                <Badge variant="destructive">{STATUS_LABEL[grade.status]}</Badge>
              </div>
            </div>
            <div className="mt-8">
              <AudioPlayer audioRef={audioRef} src={call.audio} fallbackDuration={seconds(call.duration)} markers={flags} onMarkerClick={(m) => playFrom(m.seconds)} />
            </div>
            <div className="mt-12 grid gap-x-10 gap-y-12 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Transcript lines={call.lines} duration={seconds(call.duration)} redactions={call.redactions} audioRef={audioRef} onSeek={playFrom} />
              </div>
              <ul className="border-b border-border lg:col-span-5">
                {flags.map((f) => (
                  <li key={f.id} className="flex flex-col items-start gap-2 border-t border-border py-4">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                      <XIcon aria-hidden className="size-3.5" />
                      {f.critical ? "Critical" : "Fail"}
                    </p>
                    <p className="text-xl font-medium tracking-tight">{f.label}</p>
                    <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
                      <span className="text-foreground">“{f.evidence}”</span> {f.reason}
                    </p>
                    <button type="button" onClick={() => playFrom(f.seconds)} className={cn(buttonVariants({ variant: "outline", size: "xs" }), "mt-1")}>
                      Hear it at {f.ts}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="how" className={cn(SECTION, "scroll-mt-16")}>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <h2 className={HEADING}>What happens to every call</h2>
            <p className={LEAD}>Five steps, all on the laptop. Each line on the right is what Linewise produced for the call above.</p>
          </div>
          <ol className="border-b border-border lg:col-span-7">
            {STEPS.map((step) => (
              <li key={step.name} className="grid gap-x-8 gap-y-3 border-t border-border py-6 sm:grid-cols-[14rem_1fr]">
                <h3 className="flex items-baseline gap-3 text-xl font-medium tracking-tight">
                  <span aria-hidden className="size-2 shrink-0 -translate-y-0.5 rounded-full border border-foreground" />
                  {step.name}
                </h3>
                <div className="flex flex-col gap-3 max-sm:pl-5">
                  <p className="max-w-[48ch] text-muted-foreground">{step.what}</p>
                  {step.shown}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="local" className={cn(SECTION, "scroll-mt-16")}>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <h2 className={HEADING}>Why it runs on the laptop</h2>
            <p className={LEAD}>Sending call audio to a cloud AI means sending customers' private details with it. Linewise does not need to.</p>
          </div>
          <div className="flex flex-col gap-12 lg:col-span-7">
            {REASONS.map((r) => (
              <div key={r.claim} className="flex flex-col gap-3">
                <h3 className="display text-3xl sm:text-4xl">{r.claim}</h3>
                <p className="max-w-[52ch] text-muted-foreground">{r.why}</p>
              </div>
            ))}
            <dl className="grid gap-x-8 border-b border-border sm:grid-cols-[10rem_1fr]">
              <dt className="border-t border-border pt-4 font-medium sm:pb-4">Runs locally</dt>
              <dd className="pb-4 text-muted-foreground sm:border-t sm:border-border sm:pt-4">Speech to text, speaker separation, redaction, scoring, coaching notes, storage and the PDF report.</dd>
              <dt className="border-t border-border pt-4 font-medium sm:pb-4">Needs internet</dt>
              <dd className="pb-4 text-muted-foreground sm:border-t sm:border-border sm:pt-4">Setup only, to download the models. One optional feature, a tunnel for phones outside the office Wi-Fi, uses it when you turn it on.</dd>
            </dl>
          </div>
        </section>

        <section id="features" className={cn(SECTION, "scroll-mt-16")}>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <h2 className={HEADING}>What a QA analyst gets</h2>
            <p className={LEAD}>Everything from the recording to the report, in one tab.</p>
          </div>
          <ul className="grid gap-x-10 border-b border-border sm:grid-cols-2 lg:col-span-7">
            {FEATURES.map(([name, what]) => (
              <li key={name} className="flex flex-col gap-1.5 border-t border-border py-5">
                <h3 className="font-medium">{name}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{what}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={SECTION}>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <h2 className={HEADING}>Four small models, no cloud</h2>
            <p className={LEAD}>All open models, downloaded once. The scoring model is about 2 GB.</p>
          </div>
          <ul className="border-b border-border lg:col-span-7">
            {MODELS.map(([name, job, where]) => (
              <li key={name} className="grid gap-x-8 gap-y-1 border-t border-border py-4 sm:grid-cols-[14rem_1fr]">
                <h3 className="font-medium">{name}</h3>
                <p className="text-muted-foreground">
                  {job}. <span className="label">{where}.</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className={SECTION}>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <h2 className={HEADING}>Measured, and what it does not do</h2>
          </div>
          <div className="flex flex-col gap-10 lg:col-span-7">
            <p className="max-w-[60ch]">
              On an M4 Pro MacBook Pro, a 30-second test call went from upload to scored call in about 7 seconds with native Whisper, and about 14 seconds with Whisper in the browser. Those are medians of three runs on October 10, 2026. They are timings, not an accuracy rate.{" "}
              <a className={TEXT_LINK} href={`${REPO_URL}#benchmark`} target="_blank" rel="noreferrer">The full table and the tested hardware</a> are in the README.
            </p>
            <ul className="border-b border-border">
              {LIMITS.map((limit) => (
                <li key={limit} className="max-w-none border-t border-border py-4 text-muted-foreground">{limit}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-x-10 gap-y-14 border-t border-foreground py-20 sm:py-28 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="display max-w-[16ch] text-5xl sm:text-7xl">Open the {DEMO_CALLS.length} test calls yourself.</h2>
            <p className={cn(LEAD, "mt-8")}>Play them, click the flags, confirm or dismiss a verdict, change a rule's weight, and download a redacted report. Uploading is off in the demo: scoring your own recordings happens on your own machine.</p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a href="#/demo" className={cn(buttonVariants({ size: "lg" }))}>Try the demo</a>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Run it yourself</a>
            </div>
          </div>
          <CallAsLine className="self-end lg:col-span-5" />
        </section>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-5 pb-10 sm:px-8">
        <div className="label flex flex-wrap items-center justify-between gap-x-10 gap-y-3 border-t border-border pt-5 text-muted-foreground">
          <p>Linewise, by Team Busseng. Built for the AppBuildersPH Hackathon 2026, Local AI track.</p>
          <p className="flex gap-5">
            <a className={TEXT_LINK} href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
            <a className={TEXT_LINK} href={VIDEO_URL} target="_blank" rel="noreferrer">Demo video</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

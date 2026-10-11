// The calls the read-only demo shows. calls.json is written by scripts/make-demo-data.mjs:
// it is what the real app stored after transcribing and scoring the scripted recordings
// in samples/demo/ on our laptop. Nothing in it is typed by hand. Only the agent each call
// is listed under and its call number are assigned here, the way a call that arrived from
// that agent's phone would be. The agents are the four of us; in the recordings each one
// who gives a name gives the same one.
import type { DemoCall } from "../mock";
import raw from "./calls.json";

const AS: Record<string, { number: number; agent: string }> = {
  "call-147.m4a": { number: 147, agent: "Ian" },
  "call-148.m4a": { number: 148, agent: "Paul" },
  "call-149.m4a": { number: 149, agent: "Patrick" },
  "call-150.m4a": { number: 150, agent: "Limuel" },
};

type Stored = Omit<DemoCall, "audio"> & { coaching?: string };

// A call in the file that is not listed above is left out, so a half-updated calls.json
// can never stop the real app from opening.
const stored = (raw.calls as Stored[]).flatMap(({ coaching, ...call }) => {
  const as = AS[call.name ?? ""];
  if (!as) return [];
  const demoCall: DemoCall = { ...call, id: `demo-${as.number}`, number: as.number, agent: as.agent, audio: `${import.meta.env.BASE_URL}demo/${call.name}` };
  return [{ call: demoCall, coaching }];
});

/** Newest first, like the Calls list. */
export const DEMO_CALLS: DemoCall[] = stored.map((s) => s.call).reverse();

/** The call the landing page plays: the spec's scenario, a card number read back with no identity check. */
export const DEMO_FEATURED: DemoCall = stored[0].call;

export const DEMO_COACHING: Record<string, string> = Object.fromEntries(stored.flatMap((s) => (s.coaching ? [[s.call.id, s.coaching]] : [])));

/** The day the demo calls were scored. */
export const DEMO_SCORED_ON: string = raw.generatedAt;

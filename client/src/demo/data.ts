// The calls the read-only demo shows. calls.json is written by scripts/make-demo-data.mjs:
// it is what the real app stored after transcribing and scoring the scripted test
// recordings in samples/ on our laptop. Nothing in it is typed by hand. Only the agent
// names and call numbers below are assigned here, to stand in for calls that arrived from
// three agents' phones.
import type { DemoCall } from "../mock";
import raw from "./calls.json";

const AS: Record<string, { number: number; agent: string; audio: string }> = {
  "call-147.m4a": { number: 147, agent: "Jason", audio: "call-147.m4a" },
  "call-148.m4a": { number: 148, agent: "Maria", audio: "call-148.m4a" },
  "call-149.m4a": { number: 149, agent: "Rico", audio: "call-149.m4a" },
  "call-sample.wav": { number: 150, agent: "Jason", audio: "call-sample.m4a" },
};

type Stored = Omit<DemoCall, "audio"> & { coaching?: string };

const stored = (raw.calls as Stored[]).map(({ coaching, ...call }) => {
  const as = AS[call.name ?? ""];
  const id = `demo-${as.number}`;
  const demoCall: DemoCall = { ...call, id, number: as.number, agent: as.agent, audio: `${import.meta.env.BASE_URL}demo/${as.audio}` };
  return { call: demoCall, coaching };
});

/** Newest first, like the Calls list. */
export const DEMO_CALLS: DemoCall[] = stored.map((s) => s.call).reverse();

/** The call the landing page plays: the spec's scenario, a card number read back with no identity check. */
export const DEMO_FEATURED: DemoCall = stored[0].call;

export const DEMO_COACHING: Record<string, string> = Object.fromEntries(stored.flatMap((s) => (s.coaching ? [[s.call.id, s.coaching]] : [])));

/** The day the demo calls were scored. */
export const DEMO_SCORED_ON: string = raw.generatedAt;

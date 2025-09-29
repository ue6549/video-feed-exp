// metrics.ts
type EventType = "mark" | "error" | "info";
export type Rec = {
  ts: number;              // monotonic ms (performance.now if available)
  wall: number;            // Date.now ms (optional)
  type: EventType;
  event: string;           // "loadStart" | "onLoad" | "playCmd" | "readyForDisplay" | ...
  videoId: string;
  playId: string;
  data?: any;
  dSincePrev?: number;     // Δ since previous event for SAME playId (ms)
  seq?: number;            // incremental counter per playId
};

const now = () => (global.performance?.now?.() ?? Date.now());
const wall = () => Date.now();

export class Metrics {
  private buf: Rec[] = [];
  private listeners: Array<(r: Rec)=>void> = [];

  // per-play book-keeping for Δms and sequencing
  private lastTsByPlay = new Map<string, number>();
  private seqByPlay = new Map<string, number>();

  sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  private push(rec: Rec) {
    const last = this.lastTsByPlay.get(rec.playId);
    rec.dSincePrev = last == null ? undefined : Math.max(0, rec.ts - last);
    const seq = (this.seqByPlay.get(rec.playId) ?? 0) + 1;
    rec.seq = seq;
    this.seqByPlay.set(rec.playId, seq);
    this.lastTsByPlay.set(rec.playId, rec.ts);

    this.buf.push(rec);
    this.listeners.forEach(l => l(rec));
  }

  mark(event: string, videoId: string, playId: string, data?: any) {
    this.push({ ts: now(), wall: wall(), type: "mark", event, videoId, playId, data });
  }
  info(event: string, videoId: string, playId: string, data?: any) {
    this.push({ ts: now(), wall: wall(), type: "info", event, videoId, playId, data });
  }
  error(event: string, videoId: string, playId: string, err: any) {
    this.push({
      ts: now(), wall: wall(), type: "error", event, videoId, playId,
      data: serializeErr(err)
    });
  }

  onRecord(listener: (r: Rec)=>void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(x => x !== listener); };
  }

  snapshot(playId?: string) {
    return playId ? this.buf.filter(r => r.playId === playId) : [...this.buf];
  }

  flush() { const out = this.buf; this.buf = []; return out; }
}

function serializeErr(e: any) {
  if (!e) return null;
  return { message: String(e.message ?? e), code: e.code, domain: e.domain, stack: String(e.stack ?? "") };
}

// ---- Derivation helpers (turn raw events into KPIs) ----

export type KPIs = {
  readyMs?: number;               // loadStart -> onLoad
  startupMs?: number;             // playCmd -> readyForDisplay (after that play)
  stalls?: number;                // count of bufferStart/End pairs
  stallTimeMs?: number;           // sum of stall durations
  timeToFirstStallMs?: number;    // playCmd -> first stall start
  lastEvent?: string;
};

export function deriveKPIs(events: Rec[]): KPIs {
  const byEvent = (name: string) => events.filter(e => e.event === name);
  const first = (name: string) => byEvent(name)[0];
  const after = (name: string, t: number) => byEvent(name).find(e => e.ts >= t);

  const k: KPIs = {};
  const ls = first("video_load_started");
  const ld = first("video_loaded");
  if (ls && ld) k.readyMs = ld.ts - ls.ts;

  const play = first("video_play");
  if (play) {
    const rfd = after("video_ready_for_display", play.ts);
    if (rfd) k.startupMs = rfd.ts - play.ts;

    // stalls
    let stalls = 0, stallMs = 0;
    let firstStallStart: number | undefined;
    const bs = events.filter(e => e.event === "video_buffer_start" && e.ts >= play.ts);
    const be = events.filter(e => e.event === "video_buffer_end" && e.ts >= play.ts);

    // pair them in order
    let i = 0, j = 0;
    while (i < bs.length) {
      const s = bs[i++];
      const e = be.find(x => x.ts >= s.ts && (j = Math.max(j, be.indexOf(x))) >= 0);
      if (e) {
        stalls++; stallMs += (e.ts - s.ts);
        if (firstStallStart == null) firstStallStart = s.ts;
        be.splice(j, 1);
      } else {
        // open stall (no end yet) – ignore or count to last ts
      }
    }
    k.stalls = stalls;
    k.stallTimeMs = stallMs;
    if (firstStallStart) k.timeToFirstStallMs = firstStallStart - play.ts;
  }

  k.lastEvent = events.length ? events[events.length - 1].event : undefined;
  return k;
}

export const metrics = new Metrics();
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
  // loadStart -> load (your current definition)
  readyMs?: number;

  // playCmd -> readyForDisplay (only when ready occurs after play)
  startupMs?: number;

  // user-perceived startup:
  // - equals startupMs when ready happens after play
  // - equals 0 when ready happened while paused (predecoded)
  startupEffectiveMs?: number;

  // true if first "video_ready_for_display" happened before "video_play"
  readyBeforePlay?: boolean;

  // whether this playId actually received a play command
  played?: boolean;

  stalls?: number;
  stallTimeMs?: number;
  timeToFirstStallMs?: number;
  lastEvent?: string;
};

export function deriveKPIs(events: Rec[]): KPIs {
  const by = (name: string) => events.filter(e => e.event === name);
  const first = (name: string) => by(name)[0];
  const firstAfter = (name: string, t: number) => by(name).find(e => e.ts >= t);

  const k: KPIs = {};

  // Your existing "ready" (loadStart -> load)
  const ls = first("video_load_started");
  const ld = first("video_loaded");
  if (ls && ld) k.readyMs = ld.ts - ls.ts;

  // Frame readiness
  const rfdAny = first("video_ready_for_display");

  // Startup calculations
  const play = first("video_play");
  if (play) {
    k.played = true;
    const rfdAfter = firstAfter("video_ready_for_display", play.ts);
    if (rfdAfter) {
      k.startupMs = rfdAfter.ts - play.ts;
      k.startupEffectiveMs = k.startupMs;
    } else if (rfdAny && rfdAny.ts < play.ts) {
      // predecoded while paused
      k.readyBeforePlay = true;
      k.startupEffectiveMs = 0;
    }
  }

  // Stalls (after play)
  if (play) {
    const bs = events.filter(e => e.event === "video_buffer_start" && e.ts >= play.ts);
    const be = events.filter(e => e.event === "video_buffer_end" && e.ts >= play.ts).slice();
    let stalls = 0, stallMs = 0, firstStallStart: number | undefined;

    for (const s of bs) {
      const i = be.findIndex(x => x.ts >= s.ts);
      if (i >= 0) {
        const e = be[i];
        stalls++;
        stallMs += (e.ts - s.ts);
        if (!firstStallStart) firstStallStart = s.ts;
        be.splice(i, 1);
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
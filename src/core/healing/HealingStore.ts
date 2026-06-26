import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HealingEvent, HealingStoreShape } from './types';

const HEALING_DIR = path.resolve(process.cwd(), '.healing');
const STORE_FILE = path.join(HEALING_DIR, 'healing-store.json');
const EVENTS_DIR = path.join(HEALING_DIR, 'events');
const MAX_PERSISTED_EVENTS = 500;

/**
 * Keys used by the healer's own self-tests. Their events still show up in
 * the run summary, but they are never persisted to the git-tracked store —
 * demo heals must not pollute real selector telemetry.
 */
const DEMO_KEY_PREFIX = 'demo.';

function isDemoKey(key: string): boolean {
  return key.startsWith(DEMO_KEY_PREFIX);
}

/**
 * Recorded URLs are for triage only — strip query strings and fragments so
 * session identifiers and tracking payloads never reach the committed store.
 */
function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw;
  }
}

function emptyStore(): HealingStoreShape {
  return { preferred: {}, events: [] };
}

function readRawStoreFile(): string | undefined {
  try {
    return fs.readFileSync(STORE_FILE, 'utf8');
  } catch {
    return undefined;
  }
}

function parseStore(raw: string | undefined): HealingStoreShape {
  if (raw === undefined) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as HealingStoreShape;
    return {
      preferred: parsed.preferred ?? {},
      events: parsed.events ?? [],
      ...(parsed.updatedAt ? { updatedAt: parsed.updatedAt } : {}),
    };
  } catch {
    return emptyStore();
  }
}

/**
 * Persistence layer for the self-healing engine.
 *
 * Playwright runs tests in parallel worker processes, so each worker writes
 * its own append-only event file under `.healing/events/`. After the run the
 * HealingReporter (which lives in the single runner process) consolidates all
 * event files into `healing-store.json` — the source of truth for preferred
 * selectors on subsequent runs.
 */
export class HealingStore {
  private preferred: Record<string, string>;
  private readonly pendingEvents: HealingEvent[] = [];

  constructor() {
    this.preferred = parseStore(readRawStoreFile()).preferred;
  }

  getPreferred(key: string): string | undefined {
    return this.preferred[key];
  }

  /** Events recorded by this worker in the current run (copy). */
  getSessionEvents(): HealingEvent[] {
    return [...this.pendingEvents];
  }

  /**
   * Drop the in-memory preferred selector for a key without recording an
   * event — used by healer self-tests to guarantee a live heal, and by
   * maintenance tooling.
   */
  forget(key: string): void {
    delete this.preferred[key];
  }

  recordHealing(event: HealingEvent): void {
    if (event.persistPreferred) {
      // Make the healed selector win immediately within this worker too.
      this.preferred[event.key] = event.healedSelector;
    }
    this.pendingEvents.push({
      ...event,
      kind: event.kind ?? 'healed',
      url: sanitizeUrl(event.url),
    });
    this.flush();
  }

  /**
   * The primary selector matches again (or the stored selector went stale):
   * drop the persisted preferred entry and record a 'recovered' event so the
   * consolidated store forgets the override.
   */
  recordRecovery(event: HealingEvent): void {
    delete this.preferred[event.key];
    this.pendingEvents.push({ ...event, kind: 'recovered', url: sanitizeUrl(event.url) });
    this.flush();
  }

  private flush(): void {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
    const workerFile = path.join(EVENTS_DIR, `events-${process.pid}.json`);
    fs.writeFileSync(workerFile, JSON.stringify(this.pendingEvents, null, 2));
  }

  /**
   * Removes leftover per-worker event files. Called by the HealingReporter
   * at run start so a crashed previous run cannot leak its events into this
   * run's summary and store.
   */
  static clearEvents(): void {
    fs.rmSync(EVENTS_DIR, { recursive: true, force: true });
  }

  /**
   * Merges every worker's event file into the persistent store.
   * Called once per run by the HealingReporter.
   *
   * Guarantees:
   *  - events apply in timestamp order ('recovered' deletes the preferred
   *    entry, 'healed' sets it);
   *  - demo/self-test keys are never persisted;
   *  - the store file is only rewritten when its content actually changes,
   *    so a run with no healing activity leaves the working tree clean.
   */
  static consolidate(): { runEvents: HealingEvent[]; store: HealingStoreShape } {
    const originalRaw = readRawStoreFile();
    const store = parseStore(originalRaw);
    const runEvents: HealingEvent[] = [];

    if (fs.existsSync(EVENTS_DIR)) {
      for (const fileName of fs.readdirSync(EVENTS_DIR)) {
        try {
          const events = JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, fileName), 'utf8'));
          if (Array.isArray(events)) runEvents.push(...events);
        } catch {
          // Corrupt worker file — skip it rather than fail the whole report.
        }
      }
      fs.rmSync(EVENTS_DIR, { recursive: true, force: true });
    }

    runEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Parallel workers each load `preferred` from disk and can independently
    // record the same recovery for a shared key. Collapse consecutive
    // identical events per key (an interleaving different event for that key
    // resets the guard, so a genuine re-heal is never swallowed).
    const lastSignature = new Map<string, string>();
    const deduped: HealingEvent[] = [];
    for (const event of runEvents) {
      const signature = `${event.kind ?? 'healed'}|${event.healedSelector}|${event.previousPreferred ?? ''}`;
      if (lastSignature.get(event.key) === signature) continue;
      lastSignature.set(event.key, signature);
      deduped.push(event);
    }

    for (const event of deduped) {
      if (isDemoKey(event.key)) continue;
      if (event.kind === 'recovered') {
        delete store.preferred[event.key];
      } else if (event.persistPreferred) {
        store.preferred[event.key] = event.healedSelector;
      }
      store.events.push(event);
    }
    store.events = store.events.slice(-MAX_PERSISTED_EVENTS);

    // Serialize with the previous timestamp first: if nothing else changed,
    // skip the write entirely instead of dirtying the git-tracked file.
    const serialized = JSON.stringify(store, null, 2);
    if (serialized !== originalRaw) {
      store.updatedAt = new Date().toISOString();
      fs.mkdirSync(HEALING_DIR, { recursive: true });
      fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
    }
    return { runEvents: deduped, store };
  }
}

/** One store instance per worker process. */
export const healingStore = new HealingStore();

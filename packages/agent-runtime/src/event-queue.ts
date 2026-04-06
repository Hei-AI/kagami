/**
 * EventQueue: the single primitive used by loop agents to sleep between
 * rounds and wake up on external stimuli.
 *
 * Semantics:
 * - enqueue(event) is always non-blocking. It pushes the event onto the tail
 *   of the queue and wakes any consumers currently awaiting waitForEvent().
 * - dequeue() is non-blocking. It pops and returns the next event, or null
 *   if the queue is empty.
 * - waitForEvent() blocks until the queue transitions from empty to
 *   non-empty (or returns immediately if the queue is already non-empty).
 *   It does NOT consume the event. Callers are expected to dequeue()
 *   themselves after waitForEvent resolves.
 *
 * The two operations are intentionally separate:
 * - Loop drain uses dequeue() in a `while ((e = dequeue()) !== null)` loop.
 * - Blocking tools (e.g. wait, finish_story_batch) use waitForEvent() to
 *   suspend until any producer enqueues something. They do not consume the
 *   event themselves; the next round's drain step handles that.
 *
 * Wake-up generality: any producer can unblock the consumer. A setTimeout
 * that enqueues a `{type: "wake"}` synthetic event is indistinguishable
 * from a real event arriving. There is no separate "timer channel" or
 * race mechanism required.
 */
export interface EventQueue<TEvent> {
  enqueue(event: TEvent): number;
  dequeue(): TEvent | null;
  size(): number;
  clear(): number;
  waitForEvent(): Promise<void>;
}

export class InMemoryEventQueue<TEvent> implements EventQueue<TEvent> {
  private readonly events: TEvent[] = [];
  private readonly waiters: Array<() => void> = [];

  public enqueue(event: TEvent): number {
    this.events.push(event);
    // Wake all currently-suspended consumers. Each one will re-enter
    // waitForEvent() for its next iteration on its own schedule.
    const toWake = this.waiters.splice(0);
    for (const wake of toWake) {
      wake();
    }
    return this.events.length;
  }

  public dequeue(): TEvent | null {
    return this.events.shift() ?? null;
  }

  public size(): number {
    return this.events.length;
  }

  public clear(): number {
    const cleared = this.events.length;
    this.events.length = 0;
    return cleared;
  }

  public waitForEvent(): Promise<void> {
    if (this.events.length > 0) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.waiters.push(resolve);
    });
  }
}

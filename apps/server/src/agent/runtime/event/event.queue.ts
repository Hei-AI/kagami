import type { EventQueue } from "@kagami/agent-runtime";
import type { Event } from "./event.js";

/**
 * Type alias for the generic EventQueue primitive, specialized to the
 * root agent's Event union. Kept for historical naming compatibility.
 */
export type AgentEventQueue = EventQueue<Event>;

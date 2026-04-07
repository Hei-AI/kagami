import type { LlmMessage } from "../../../../llm/types.js";
import type { StoryRecallResult } from "./story-recall.service.js";

export class StoryRecall {
  private recentMessages: LlmMessage[] = [];
  private readonly injectedStoryIds = new Set<string>();
  private readonly inboundWindowSize: number;

  public constructor({ inboundWindowSize }: { inboundWindowSize: number }) {
    this.inboundWindowSize = inboundWindowSize;
  }

  public appendMessageToWindow(msg: LlmMessage): void {
    this.recentMessages.push(msg);
    if (this.recentMessages.length > this.inboundWindowSize) {
      this.recentMessages = this.recentMessages.slice(-this.inboundWindowSize);
    }
  }

  public getRecentMessages(): readonly LlmMessage[] {
    return this.recentMessages;
  }

  public applyNakedHits(hits: StoryRecallResult[]): StoryRecallResult[] {
    const newHits = hits.filter(hit => !this.injectedStoryIds.has(hit.story.id));
    for (const hit of newHits) {
      this.injectedStoryIds.add(hit.story.id);
    }
    return newHits;
  }

  public resetOnCompaction(): void {
    this.recentMessages = [];
    this.injectedStoryIds.clear();
  }
}

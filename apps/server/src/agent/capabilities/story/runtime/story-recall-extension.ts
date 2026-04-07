import type { LoopAgentExtension } from "@kagami/agent-runtime";
import type { LlmMessage } from "../../../../llm/types.js";
import type {
  RootLoopExtensionContext,
  RootAgentCompletion,
  RootAgentToolExecutionData,
} from "../../../runtime/root-agent/root-agent-runtime.js";
import type { StoryRecallService } from "../application/story-recall.service.js";
import { StoryRecall } from "../application/story-recall.js";
import { AppLogger } from "../../../../logger/logger.js";

const logger = new AppLogger({ source: "agent.story-recall-extension" });

type StoryRecallExtensionConfig = {
  storyRecallService: StoryRecallService;
  inboundWindowSize: number;
  nakedTopK: number;
  nakedScoreThreshold: number;
};

export class StoryRecallExtension implements LoopAgentExtension<
  RootLoopExtensionContext,
  LlmMessage,
  "agent",
  RootAgentCompletion,
  RootAgentToolExecutionData
> {
  private readonly storyRecall: StoryRecall;
  private readonly storyRecallService: StoryRecallService;
  private readonly nakedTopK: number;
  private readonly nakedScoreThreshold: number;
  private lastProcessedIndex = 0;

  public constructor({
    storyRecallService,
    inboundWindowSize,
    nakedTopK,
    nakedScoreThreshold,
  }: StoryRecallExtensionConfig) {
    this.storyRecall = new StoryRecall({ inboundWindowSize });
    this.storyRecallService = storyRecallService;
    this.nakedTopK = nakedTopK;
    this.nakedScoreThreshold = nakedScoreThreshold;
  }

  public async onAfterEventsConsumed(context: RootLoopExtensionContext): Promise<void> {
    try {
      await this.performRecall(context);
    } catch (error) {
      logger.warn("Story recall failed; skipping this round", {
        event: "agent.story_recall.recall_failed",
        errorName: error instanceof Error ? error.name : "Error",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public onContextCompacted(): void {
    this.storyRecall.resetOnCompaction();
    this.lastProcessedIndex = 0;
    logger.debug("Story recall state reset after compaction", {
      event: "agent.story_recall.reset_on_compaction",
    });
  }

  private async performRecall(context: RootLoopExtensionContext): Promise<void> {
    const snapshot = await context.host.getContextSnapshot();
    const messages = snapshot.messages;

    // Append new inbound messages (user/tool) to window since last check.
    let hasNewInbound = false;
    for (let i = this.lastProcessedIndex; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user" || msg.role === "tool") {
        this.storyRecall.appendMessageToWindow(msg);
        hasNewInbound = true;
      }
    }
    this.lastProcessedIndex = messages.length;

    if (!hasNewInbound) {
      logger.debug("No new inbound messages; skipping recall", {
        event: "agent.story_recall.skip_no_new_messages",
      });
      return;
    }

    const window = this.storyRecall.getRecentMessages();
    if (window.length === 0) {
      logger.debug("Empty recall window; skipping", {
        event: "agent.story_recall.skip_empty_window",
      });
      return;
    }

    const query = composeQuery(window);
    logger.debug("Running naked recall", {
      event: "agent.story_recall.search_start",
      queryLength: query.length,
    });

    const hits = await this.storyRecallService.search({
      query,
      topK: this.nakedTopK,
    });

    const filtered = hits.filter(h => h.score >= this.nakedScoreThreshold);
    const toInject = this.storyRecall.applyNakedHits(filtered);

    if (toInject.length === 0) {
      logger.debug("No new stories to inject after filtering", {
        event: "agent.story_recall.no_injection",
        totalHits: hits.length,
        filteredHits: filtered.length,
      });
      return;
    }

    const recallMessage = formatRecallMessage(toInject);
    await context.host.appendMessages([recallMessage]);

    logger.info("Injected recalled stories into context", {
      event: "agent.story_recall.injected",
      storyIds: toInject.map(h => h.story.id),
      scores: toInject.map(h => h.score),
    });
  }
}

function composeQuery(messages: readonly LlmMessage[]): string {
  return messages
    .map(msg => {
      if (typeof msg.content === "string") {
        return msg.content;
      }
      return msg.content
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map(part => part.text)
        .join("\n");
    })
    .join("\n");
}

function formatRecallMessage(
  hits: { story: { id: string; markdown: string; content: { title: string } }; score: number }[],
): LlmMessage {
  const parts = hits.map(hit => `## ${hit.story.content.title}\n${hit.story.markdown}`);
  const content = `[自动记忆召回] 以下是与当前对话可能相关的历史记忆：\n\n${parts.join("\n\n")}`;
  return { role: "user", content };
}

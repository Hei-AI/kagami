import type {
  AssistantLikeMessage,
  ReActKernelRunRoundInput,
  ReActRoundResult,
} from "./react-kernel.js";

export interface LoopAgentExtension<
  TContext,
  TMessage extends { role: string },
  TUsage extends string,
  TCompletion extends {
    message: Extract<TMessage, { role: "assistant" }> & AssistantLikeMessage;
  },
  TExtensionData = unknown,
> {
  onInitialize?(context: TContext): Promise<void> | void;
  /**
   * Called at the top of each runOnce iteration, before the LLM round runs.
   * Typical use: persist snapshot, append wake reminders.
   */
  onBeforeRound?(context: TContext): Promise<void> | void;
  onAfterRound?(input: {
    context: TContext;
    roundInput: ReActKernelRunRoundInput<TMessage, TUsage>;
    result: ReActRoundResult<TMessage, TCompletion, TExtensionData>;
  }): Promise<void> | void;
  onAfterCommit?(input: {
    context: TContext;
    result: ReActRoundResult<TMessage, TCompletion, TExtensionData>;
  }): Promise<void> | void;
  onAfterReset?(context: TContext): Promise<void> | void;
  onUnhandledError?(input: { context: TContext; error: unknown }): Promise<void> | void;
}

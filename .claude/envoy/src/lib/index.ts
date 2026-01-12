/**
 * Library exports for claude-envoy.
 */

// Git utilities
export {
  getBaseBranch, getBranch, getDiff, getPlanDir, getProjectRoot, isDirectModeBranch, sanitizeBranch
} from "./git.js";

// Observability
export {
  getPlanName,
  log, logCommandComplete, logCommandStart, logError, logInfo,
  logWarn
} from "./observability.js";
export type { LogEntry, LogLevel } from "./observability.js";

// File watching
export { watchForAnyDone, watchForDone } from "./watcher.js";
export type { WatchResult } from "./watcher.js";

// Path utilities
export {
  ensurePlanDir, getApproachId, getFindingsPath, getPlanPaths, getPromptId, getPromptPath, getUserFeedbackPath, parsePromptId, planExists
} from "./paths.js";

// Markdown utilities
export {
  parseMarkdownWithFrontMatter, readMarkdownFile,
  stripLogPlaceholder, writeMarkdownWithFrontMatter
} from "./markdown.js";

// Plan file I/O
export {
  appendUserInput, readPlan, readSummary, readUserInput, updatePlanStage, writePlan, writeSummary
} from "./plan-io.js";
export type { PlanFrontMatter } from "./plan-io.js";

// Prompt operations
export {
  createDefaultPromptFrontMatter, deletePrompt,
  listPrompts,
  readAllPrompts, readPrompt, updatePromptStatus,
  updatePromptVariantSolution, writePrompt
} from "./prompts.js";
export type { PromptFrontMatter } from "./prompts.js";

// Findings operations
export {
  archiveFindings, createDefaultApproach, deleteApproach, listFindings,
  readAllFindings, readFindings, setApproachRefinement, updateApproachFeedback, writeFindings
} from "./findings.js";
export type { FindingApproach, FindingsFile } from "./findings.js";

// Design manifest operations
export {
  getDesignManifestPath,
  readDesignManifest
} from "./design.js";
export type { DesignEntry, DesignManifest } from "./design.js";

// Gate feedback operations
export {
  appendPlanAudit,
  appendPlanReview,
  appendPromptReview, deleteFeedbackFile,
  feedbackFileExists, getLoggingGateLogsPath, getTestingGateLogsPath, readAuditQuestionsFeedback, readFindingsGateFeedback, readLoggingGateFeedback, readPlanGateFeedback, readReviewQuestionsFeedback, readTestingGateFeedback, readVariantsGateFeedback, resetLoggingGateDone, resetTestingGateDone, writeAuditQuestionsFeedback, writeFindingsGateFeedback, writeLoggingGateFeedback, writePlanGateFeedback, writeReviewQuestionsFeedback, writeTestingGateFeedback, writeVariantsGateFeedback
} from "./gates.js";
export type {
  AuditQuestionsFeedback, FindingsGateFeedback, LoggingGateFeedback, PlanGateFeedback, ReviewQuestionsFeedback, TestingGateFeedback,
  VariantsGateFeedback
} from "./gates.js";

// Feedback schemas (for validation)
export {
  AuditQuestionsSchema, FindingsGateSchema, LoggingGateSchema, PlanGateSchema, ReviewQuestionsSchema,
  safeParseFeedback, TestingGateSchema,
  VariantsGateSchema
} from "./feedback-schemas.js";
export type {
  LoggingGateYaml, TestingGateYaml
} from "./feedback-schemas.js";

// Retry utilities
export { GEMINI_FALLBACKS, ORACLE_FALLBACKS, withRetry } from "./retry.js";
export type { RetryOptions, RetryResult } from "./retry.js";

// Provider utilities
export {
  createProvider,
  getDefaultProvider,
  PROVIDER_CONFIGS
} from "./providers.js";
export type {
  ContentPart, GenerateOptions,
  GenerateResult, LLMProvider, ProviderConfig, ProviderName
} from "./providers.js";

// Protocol utilities (Phase 9)
export {
  formatProtocol, getProtocolPath, getProtocolsDir, listProtocols, readProtocol,
  resolveProtocol
} from "./protocols.js";
export type {
  Protocol,
  ProtocolInput,
  ProtocolOutput, ResolvedProtocol, ResolvedStep
} from "./protocols.js";

// Notification utilities
export {
  sendGateNotification,
  sendHookNotification, sendNotification
} from "./notification.js";
export type { NotifyOptions } from "./notification.js";

// Agent infrastructure
export { AgentRunner } from "./agents/index.js";
export type {
  AgentConfig,
  AgentResult,
  AggregatorInput,
  AggregatorOutput,
  SearchResult,
} from "./agents/index.js";


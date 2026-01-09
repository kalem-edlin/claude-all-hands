/**
 * Zod schemas for user feedback files.
 * These files are human-authored, so runtime validation prevents malformed input.
 */

import { z } from "zod";

/**
 * Base schema - all feedback files include these fields.
 */
const BaseFeedbackSchema = z.object({
  done: z.boolean(),
  thoughts: z.string().optional().default(""),
});

/**
 * findings_gate.yaml schema
 * Created when discoveries need user review before planning.
 * Note: rejected field only appears for variant approaches
 * Note: question_answers only appears when approach has clarifying questions
 */
export const FindingsGateSchema = BaseFeedbackSchema.extend({
  approach_feedback: z
    .record(
      z.object({
        user_required_changes: z.string().default(""), // Directive for agent to re-investigate
        rejected: z.boolean().optional(), // Only present for variant approaches
        question_answers: z
          .array(
            z.object({
              question: z.string(),
              answer: z.string().default(""),
            })
          )
          .optional(), // Only present when approach has questions
      })
    )
    .optional()
    .default({}),
});

export type FindingsGateFeedback = z.infer<typeof FindingsGateSchema>;

/**
 * plan_gate.yaml schema
 * Created when plan/prompts need user review before implementation.
 */
export const PlanGateSchema = BaseFeedbackSchema.extend({
  user_required_plan_changes: z.string().optional().default(""), // Directive for re-planning
  prompt_feedback: z
    .record(
      z.object({
        user_required_changes: z.string().default(""), // Directive for prompt revision
      })
    )
    .optional()
    .default({}),
});

export type PlanGateFeedback = z.infer<typeof PlanGateSchema>;

/**
 * {N}{V}_testing.yaml schema
 * Created when a prompt requires manual user testing.
 * Note: logs are in sibling file {N}{V}_testing_logs.md
 */
export const TestingGateSchema = BaseFeedbackSchema.extend({
  test_passed: z.boolean().default(true), // Default true for minimal friction
  user_required_changes: z.string().optional().default(""), // What needs fixing if test failed
});

// YAML file type (no logs)
export type TestingGateYaml = z.infer<typeof TestingGateSchema>;

// Combined result type (includes logs from sibling file)
export type TestingGateFeedback = TestingGateYaml & { logs: string };

/**
 * {N}_variants.yaml schema
 * Created when variant prompts need user selection.
 */
export const VariantsGateSchema = BaseFeedbackSchema.extend({
  variants: z.record(
    z.object({
      decision: z.enum(["accepted", "rejected", "feature-flag"]).nullable().default(null),
      reason: z.string().default(""),
    })
  ),
});

export type VariantsGateFeedback = z.infer<typeof VariantsGateSchema>;

/**
 * {N}{V}_logging.yaml schema
 * Created when debug logging has been implemented.
 * Note: logs are in sibling file {N}{V}_logging_logs.md
 */
export const LoggingGateSchema = BaseFeedbackSchema;

// YAML file type (no logs)
export type LoggingGateYaml = z.infer<typeof LoggingGateSchema>;

// Combined result type (includes logs from sibling file)
export type LoggingGateFeedback = LoggingGateYaml & { logs: string };

/**
 * audit_questions.yaml schema (for gemini audit)
 */
export const AuditQuestionsSchema = BaseFeedbackSchema.extend({
  questions: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string().default(""),
      })
    )
    .default([]),
});

export type AuditQuestionsFeedback = z.infer<typeof AuditQuestionsSchema>;

/**
 * review_questions.yaml schema (for gemini review)
 */
export const ReviewQuestionsSchema = BaseFeedbackSchema.extend({
  questions: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string().default(""),
      })
    )
    .default([]),
  suggested_changes: z.string().optional().default(""),
});

export type ReviewQuestionsFeedback = z.infer<typeof ReviewQuestionsSchema>;

/**
 * Safe parse with error message extraction.
 */
export function safeParseFeedback<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  return { success: false, error: errorMessages };
}

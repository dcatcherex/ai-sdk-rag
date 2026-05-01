import { z } from "zod";

const slugSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const webhookHeadersSchema = z.record(z.string(), z.string()).superRefine((headers, ctx) => {
  if (Object.keys(headers).length > 20) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Webhook tools support up to 20 custom headers.",
    });
  }
});

export const userToolFieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(100),
  type: z.enum(["text", "long_text", "number", "boolean", "enum", "date", "json"]),
  required: z.boolean().optional(),
  helpText: z.string().max(500).optional(),
  placeholder: z.string().max(300).optional(),
  options: z.array(z.string().min(1).max(100)).max(100).optional(),
  defaultValue: z.unknown().optional(),
}).superRefine((field, ctx) => {
  if (field.type === "enum" && (!field.options || field.options.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enum fields require at least one option.",
      path: ["options"],
    });
  }
});

export const userToolWebhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  headersTemplate: webhookHeadersSchema.optional(),
  requestBodyMode: z.literal("json"),
  requestTemplate: z.record(z.string(), z.unknown()).optional(),
  responseDataPath: z.string().max(200).optional(),
});

const userToolWorkflowStepBaseSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_:-]*$/).optional(),
  artifactLabel: z.string().min(1).max(120).optional(),
  persistArtifact: z.boolean().optional(),
});

const userToolWorkflowStepSchema = z.discriminatedUnion("kind", [
  userToolWorkflowStepBaseSchema.extend({
    kind: z.literal("create_campaign_brief"),
    input: z.record(z.string(), z.unknown()),
  }),
  userToolWorkflowStepBaseSchema.extend({
    kind: z.literal("create_calendar_entry"),
    input: z.record(z.string(), z.unknown()),
  }),
  userToolWorkflowStepBaseSchema.extend({
    kind: z.literal("create_social_post"),
    input: z.record(z.string(), z.unknown()),
  }),
]);

export const userToolExecutionConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("webhook"),
    webhook: userToolWebhookConfigSchema,
  }),
  z.object({
    type: z.literal("workflow"),
    workflow: z.object({
      steps: z.array(userToolWorkflowStepSchema).min(1).max(20),
    }),
  }),
]);

export const createUserToolSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(1024).nullable().optional(),
  icon: z.string().min(1).max(64).optional(),
  category: z.string().min(1).max(64).optional(),
  executionType: z.enum(["webhook", "workflow"]),
  visibility: z.enum(["private", "shared", "template", "published"]).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  readOnly: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  supportsAgent: z.boolean().optional(),
  supportsManualRun: z.boolean().optional(),
  initialVersion: z.object({
    inputSchema: z.array(userToolFieldSchema).max(50),
    outputSchema: z.array(userToolFieldSchema).max(50).optional(),
    config: userToolExecutionConfigSchema,
    changeSummary: z.string().max(500).optional(),
    isDraft: z.boolean().optional(),
    activate: z.boolean().optional(),
  }).optional(),
});

export const updateUserToolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(1024).nullable().optional(),
  icon: z.string().min(1).max(64).optional(),
  category: z.string().min(1).max(64).optional(),
  executionType: z.enum(["webhook", "workflow"]).optional(),
  visibility: z.enum(["private", "shared", "template", "published"]).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  readOnly: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  supportsAgent: z.boolean().optional(),
  supportsManualRun: z.boolean().optional(),
});

export const createUserToolVersionSchema = z.object({
  inputSchema: z.array(userToolFieldSchema).max(50),
  outputSchema: z.array(userToolFieldSchema).max(50).optional(),
  config: userToolExecutionConfigSchema,
  changeSummary: z.string().max(500).optional(),
  isDraft: z.boolean().optional(),
  activate: z.boolean().optional(),
});

export const executeUserToolSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
  confirmed: z.boolean().optional(),
});

export const userToolShareMutationSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["runner", "editor"]).optional(),
});

export const userToolWorkspaceShareMutationSchema = z.object({
  brandId: z.string().min(1),
  role: z.enum(["runner", "editor"]).optional(),
});

export const replaceAgentUserToolAttachmentsSchema = z.object({
  attachments: z.array(z.object({
    userToolId: z.string().min(1),
    isEnabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(999).optional(),
    notes: z.string().max(500).nullable().optional(),
  })).max(100),
});

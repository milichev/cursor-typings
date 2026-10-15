/**
 * Cursor Hooks: types for `hooks.json` and hook stdin/stdout payloads.
 * Source: https://cursor.com/docs/hooks
 */

/* ────────────────────────────── Events ────────────────────────────── */

export type AgentHookEvent =
  | "sessionStart"
  | "sessionEnd"
  | "preToolUse"
  | "postToolUse"
  | "postToolUseFailure"
  | "subagentStart"
  | "subagentStop"
  | "beforeShellExecution"
  | "afterShellExecution"
  | "beforeMCPExecution"
  | "afterMCPExecution"
  | "beforeReadFile"
  | "afterFileEdit"
  | "beforeSubmitPrompt"
  | "preCompact"
  | "stop"
  | "afterAgentResponse"
  | "afterAgentThought";

export type TabHookEvent = "beforeTabFileRead" | "afterTabFileEdit";

/** Fires outside any agent session. */
export type AppLifecycleHookEvent = "workspaceOpen";

export type HookEvent = AgentHookEvent | TabHookEvent | AppLifecycleHookEvent;

/** Invalid JSON / schema mismatch in the response blocks the action. */
export type PermissionHookEvent =
  | "beforeShellExecution"
  | "beforeMCPExecution"
  | "beforeReadFile"
  | "beforeTabFileRead"
  | "subagentStart"
  | "preToolUse";

/** Support `loop_limit` (follow-up loop cap). */
export type LoopHookEvent = "stop" | "subagentStop";

/** Not run in cloud agents. */
export type CloudUnsupportedHookEvent =
  | "sessionStart"
  | "sessionEnd"
  | "beforeMCPExecution"
  | "afterMCPExecution"
  | "beforeTabFileRead"
  | "afterTabFileEdit"
  | "workspaceOpen";

/* ───────────────────────── hooks.json config ───────────────────────── */

interface HookDefinitionBase {
  /** Execution timeout, seconds. Platform default if omitted. */
  timeout?: number;
  /**
   * `true`: crash / timeout / non-zero exit / no output blocks the action.
   * Permission hooks block on invalid JSON regardless.
   * @default false
   */
  failClosed?: boolean;
  /**
   * Regex filter; `""` or `"*"` matches everything. Tested against:
   * - preToolUse/postToolUse/postToolUseFailure: tool type (`Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, `MCP:<tool_name>`)
   * - subagentStart/subagentStop: subagent type (`generalPurpose`, `explore`, `shell`, …)
   * - beforeShellExecution/afterShellExecution: full command string
   * - beforeReadFile: `Read` · afterFileEdit: `Write`
   * - beforeTabFileRead: `TabRead` · afterTabFileEdit: `TabWrite`
   * - beforeSubmitPrompt: `UserPromptSubmit` · stop: `Stop`
   * - afterAgentResponse: `AgentResponse` · afterAgentThought: `AgentThought`
   */
  matcher?: string;
}

export interface CommandHookDefinition extends HookDefinitionBase {
  /** @default 'command' */
  type?: "command";
  /** Shell string, absolute path, or relative path (project hooks: project root; user hooks: `~/.cursor/`). */
  command: string;
}

export interface PromptHookDefinition extends HookDefinitionBase {
  type: "prompt";
  /** Natural-language condition. `$ARGUMENTS` → hook input JSON (auto-appended if absent). */
  prompt: string;
  /** Override default LLM. */
  model?: string;
}

export interface LoopLimitOption {
  /** Max auto follow-ups. `null` = unlimited. @default 5 (Cursor hooks) */
  loop_limit?: number | null;
}

export type HookDefinition<E extends HookEvent = HookEvent> = (
  | CommandHookDefinition
  | PromptHookDefinition
) &
  (E extends LoopHookEvent ? LoopLimitOption : unknown);

export type HooksMap = { [E in HookEvent]?: HookDefinition<E>[] };

export interface HooksConfig {
  $schema?: string;
  /** Positive integer. Use `1`. */
  version: number;
  hooks?: HooksMap;
}

/** Response of a prompt-based hook (LLM). */
export interface PromptHookResult {
  ok: boolean;
  reason?: string;
}

/* ───────────────────────────── Common ───────────────────────────── */

export type HookPermission = "allow" | "deny" | "ask";

export interface ModelParam {
  /** e.g. `thinking`, `context`, `effort` */
  id: string;
  value: string;
}

/** Fields present on every agent/tab hook input. */
export interface BaseHookInput<E extends HookEvent = HookEvent> {
  /** Stable across turns. */
  conversation_id: string;
  /** Changes with every user message. */
  generation_id: string;
  /** Legacy model slug. */
  model: string;
  model_id?: string;
  model_params?: ModelParam[];
  hook_event_name: E;
  cursor_version: string;
  workspace_roots: string[];
  user_email: string | null;
  /** `null` if transcripts disabled. */
  transcript_path: string | null;
}

/** App lifecycle hooks omit conversation_id, generation_id, model*, session_id, transcript_path. */
export interface AppLifecycleHookInput<
  E extends AppLifecycleHookEvent = AppLifecycleHookEvent,
> {
  hook_event_name: E;
  cursor_version: string;
  workspace_roots: string[];
  user_email: string | null;
}

/** Hooks without documented output fields. Emit nothing or `{}`. */
export type NoOutput = Record<string, never>;

export type ToolInput = Record<string, unknown>;

/** Known values; non-exhaustive. MCP tools: `MCP:<tool_name>`. */
export type ToolName =
  | "Shell"
  | "Read"
  | "Write"
  | "Grep"
  | "Delete"
  | "Task"
  | `MCP:${string}`
  | (string & {});

export type SubagentType =
  | "generalPurpose"
  | "explore"
  | "shell"
  | (string & {});

export interface PromptAttachment {
  type: "file" | "rule";
  file_path: string;
}

export interface FileEdit {
  old_string: string;
  new_string: string;
}

export interface TabFileEdit extends FileEdit {
  range: {
    start_line_number: number;
    start_column: number;
    end_line_number: number;
    end_column: number;
  };
  old_line: string;
  new_line: string;
}

/* ───────────────────────── Session lifecycle ───────────────────────── */

export interface SessionStartInput extends BaseHookInput<"sessionStart"> {
  /** Same as `conversation_id`. */
  session_id: string;
  is_background_agent: boolean;
  composer_mode?: "agent" | "ask" | "edit" | (string & {});
}

/** Fire-and-forget; loop does not wait for or enforce the response. */
export interface SessionStartOutput {
  /** Env vars exposed to all subsequent hook executions in this session. */
  env?: Record<string, string>;
  /** Appended to initial system context. */
  additional_context?: string;
  /** Accepted by schema; not enforced. */
  continue?: boolean;
  /** Accepted by schema; not enforced. */
  user_message?: string;
}

export interface SessionEndInput extends BaseHookInput<"sessionEnd"> {
  session_id: string;
  reason: "completed" | "aborted" | "error" | "window_close" | "user_close";
  duration_ms: number;
  is_background_agent: boolean;
  final_status: string;
  /** Present if `reason === 'error'`. */
  error_message?: string;
}

/* ───────────────────────────── Tool use ───────────────────────────── */

export interface PreToolUseInput extends BaseHookInput<"preToolUse"> {
  tool_name: ToolName;
  tool_input: ToolInput;
  tool_use_id: string;
  cwd: string;
  agent_message?: string;
}

export interface PreToolUseOutput {
  /** `'ask'` accepted by schema; not enforced for preToolUse today. */
  permission: HookPermission;
  /** Shown to user when denied. */
  user_message?: string;
  /** Fed to agent when denied. */
  agent_message?: string;
  /** Replaces tool input. */
  updated_input?: ToolInput;
}

export interface PostToolUseInput extends BaseHookInput<"postToolUse"> {
  tool_name: ToolName;
  tool_input: ToolInput;
  /** JSON-stringified result payload (not raw terminal text). */
  tool_output: string;
  tool_use_id: string;
  cwd: string;
  /** ms */
  duration: number;
}

export interface PostToolUseOutput {
  /** MCP tools only: replaces output seen by the model. */
  updated_mcp_tool_output?: Record<string, unknown>;
  additional_context?: string;
}

export interface PostToolUseFailureInput extends BaseHookInput<"postToolUseFailure"> {
  tool_name: ToolName;
  tool_input: ToolInput;
  tool_use_id: string;
  cwd: string;
  error_message: string;
  failure_type: "error" | "timeout" | "permission_denied";
  /** ms until failure */
  duration: number;
  /** User interrupt/cancel. */
  is_interrupt: boolean;
}

export interface PostToolUseFailureOutput {
  additional_context?: string;
}

/* ───────────────────────────── Subagents ───────────────────────────── */

export interface SubagentStartInput extends BaseHookInput<"subagentStart"> {
  subagent_id: string;
  subagent_type: SubagentType;
  task: string;
  parent_conversation_id: string;
  tool_call_id: string;
  subagent_model: string;
  is_parallel_worker: boolean;
  git_branch?: string;
}

export interface SubagentStartOutput {
  /** `'ask'` unsupported (treated as `'deny'`). */
  permission: "allow" | "deny";
  user_message?: string;
}

export interface SubagentStopInput extends BaseHookInput<"subagentStop"> {
  subagent_type: SubagentType;
  status: "completed" | "error" | "aborted";
  task: string;
  description: string;
  summary: string;
  duration_ms: number;
  message_count: number;
  tool_call_count: number;
  /** Follow-ups already triggered for this subagent (starts at 0). */
  loop_count: number;
  modified_files: string[];
  agent_transcript_path: string | null;
}

export interface SubagentStopOutput {
  /** Auto-continue message. Consumed only when `status === 'completed'`. */
  followup_message?: string;
}

/* ───────────────────────────── Shell / MCP ───────────────────────────── */

export interface BeforeShellExecutionInput extends BaseHookInput<"beforeShellExecution"> {
  command: string;
  cwd: string;
  sandbox: boolean;
}

export interface AfterShellExecutionInput extends BaseHookInput<"afterShellExecution"> {
  command: string;
  /** Full terminal output. */
  output: string;
  /** ms, excludes approval wait. */
  duration: number;
  sandbox: boolean;
}

interface BeforeMCPExecutionBase extends BaseHookInput<"beforeMCPExecution"> {
  tool_name: string;
  /** JSON params string. */
  tool_input: string;
  /** Key in `mcp.json`. Treat missing/unexpected as deny. */
  mcp_server_name: string;
}

/** HTTP/SSE server. */
export interface BeforeMCPExecutionHttpInput extends BeforeMCPExecutionBase {
  url: string;
  mcp_server_url: string;
  command?: never;
}

/** stdio server. */
export interface BeforeMCPExecutionStdioInput extends BeforeMCPExecutionBase {
  /** Launch command + args joined by spaces. */
  command: string;
  url?: never;
  mcp_server_url?: never;
}

export type BeforeMCPExecutionInput =
  | BeforeMCPExecutionHttpInput
  | BeforeMCPExecutionStdioInput;

export interface AfterMCPExecutionInput extends BaseHookInput<"afterMCPExecution"> {
  tool_name: string;
  tool_input: string;
  mcp_server_name: string;
  /** HTTP/SSE servers only. */
  mcp_server_url?: string;
  /** JSON string of tool response. */
  result_json: string;
  /** ms, excludes approval wait. */
  duration: number;
}

/** Shared by beforeShellExecution / beforeMCPExecution. */
export interface ExecutionPermissionOutput {
  permission: HookPermission;
  user_message?: string;
  agent_message?: string;
}

/* ───────────────────────────── Files ───────────────────────────── */

export interface BeforeReadFileInput extends BaseHookInput<"beforeReadFile"> {
  file_path: string;
  content: string;
  attachments: PromptAttachment[];
}

export interface BeforeReadFileOutput {
  permission: "allow" | "deny";
  user_message?: string;
}

export interface AfterFileEditInput extends BaseHookInput<"afterFileEdit"> {
  file_path: string;
  edits: FileEdit[];
}

/* ───────────────────────────── Tab ───────────────────────────── */

export interface BeforeTabFileReadInput extends BaseHookInput<"beforeTabFileRead"> {
  file_path: string;
  content: string;
}

export interface BeforeTabFileReadOutput {
  permission: "allow" | "deny";
}

export interface AfterTabFileEditInput extends BaseHookInput<"afterTabFileEdit"> {
  file_path: string;
  edits: TabFileEdit[];
}

/* ───────────────────────────── Prompt / agent output ───────────────────────────── */

export interface BeforeSubmitPromptInput extends BaseHookInput<"beforeSubmitPrompt"> {
  prompt: string;
  attachments: PromptAttachment[];
}

export interface BeforeSubmitPromptOutput {
  continue: boolean;
  /** Shown when blocked. */
  user_message?: string;
}

export interface AfterAgentResponseInput extends BaseHookInput<"afterAgentResponse"> {
  text: string;
}

export interface AfterAgentThoughtInput extends BaseHookInput<"afterAgentThought"> {
  text: string;
  duration_ms?: number;
}

export interface PreCompactInput extends BaseHookInput<"preCompact"> {
  trigger: "auto" | "manual";
  /** 0–100 */
  context_usage_percent: number;
  context_tokens: number;
  context_window_size: number;
  message_count: number;
  messages_to_compact: number;
  is_first_compaction: boolean;
}

/** Observational; cannot block or modify compaction. */
export interface PreCompactOutput {
  user_message?: string;
}

export interface StopInput extends BaseHookInput<"stop"> {
  status: "completed" | "aborted" | "error";
  /** Auto follow-ups already triggered (starts at 0). */
  loop_count: number;
}

export interface StopOutput {
  /** Non-empty → auto-submitted as next user message. Capped by `loop_limit` (default 5). */
  followup_message?: string;
}

/* ───────────────────────────── App lifecycle ───────────────────────────── */

export type WorkspaceOpenInput = AppLifecycleHookInput<"workspaceOpen">;

export interface WorkspaceOpenOutput {
  /** Absolute plugin dirs to load for the current workspace. */
  pluginPaths?: string[];
}

/* ───────────────────────────── Maps ───────────────────────────── */

export interface HookInputMap {
  sessionStart: SessionStartInput;
  sessionEnd: SessionEndInput;
  preToolUse: PreToolUseInput;
  postToolUse: PostToolUseInput;
  postToolUseFailure: PostToolUseFailureInput;
  subagentStart: SubagentStartInput;
  subagentStop: SubagentStopInput;
  beforeShellExecution: BeforeShellExecutionInput;
  afterShellExecution: AfterShellExecutionInput;
  beforeMCPExecution: BeforeMCPExecutionInput;
  afterMCPExecution: AfterMCPExecutionInput;
  beforeReadFile: BeforeReadFileInput;
  afterFileEdit: AfterFileEditInput;
  beforeSubmitPrompt: BeforeSubmitPromptInput;
  preCompact: PreCompactInput;
  stop: StopInput;
  afterAgentResponse: AfterAgentResponseInput;
  afterAgentThought: AfterAgentThoughtInput;
  beforeTabFileRead: BeforeTabFileReadInput;
  afterTabFileEdit: AfterTabFileEditInput;
  workspaceOpen: WorkspaceOpenInput;
}

export interface HookOutputMap {
  sessionStart: SessionStartOutput;
  sessionEnd: NoOutput;
  preToolUse: PreToolUseOutput;
  postToolUse: PostToolUseOutput;
  postToolUseFailure: PostToolUseFailureOutput;
  subagentStart: SubagentStartOutput;
  subagentStop: SubagentStopOutput;
  beforeShellExecution: ExecutionPermissionOutput;
  afterShellExecution: NoOutput;
  beforeMCPExecution: ExecutionPermissionOutput;
  afterMCPExecution: NoOutput;
  beforeReadFile: BeforeReadFileOutput;
  afterFileEdit: NoOutput;
  beforeSubmitPrompt: BeforeSubmitPromptOutput;
  preCompact: PreCompactOutput;
  stop: StopOutput;
  afterAgentResponse: NoOutput;
  afterAgentThought: NoOutput;
  beforeTabFileRead: BeforeTabFileReadOutput;
  afterTabFileEdit: NoOutput;
  workspaceOpen: WorkspaceOpenOutput;
}

export type HookInput<E extends HookEvent = HookEvent> = HookInputMap[E];
export type HookOutput<E extends HookEvent = HookEvent> = HookOutputMap[E];
export type AnyHookInput = HookInputMap[HookEvent];

export type HookHandler<E extends HookEvent> = (
  input: HookInput<E>,
) => HookOutput<E> | Promise<HookOutput<E>>;

/* ───────────────────────────── Process contract ───────────────────────────── */

/** `0` = use JSON output · `2` = block (≡ `permission: 'deny'`) · other = fail-open unless `failClosed`. */
export type HookExitCode = 0 | 2 | (number & {});

export interface CursorHookEnv {
  CURSOR_PROJECT_DIR: string;
  CURSOR_VERSION: string;
  /** If logged in. */
  CURSOR_USER_EMAIL?: string;
  /** If transcripts enabled. */
  CURSOR_TRANSCRIPT_PATH?: string;
  /** `"true"` in remote workspaces. */
  CURSOR_CODE_REMOTE?: "true";
  /** Claude Code compat alias of CURSOR_PROJECT_DIR. */
  CLAUDE_PROJECT_DIR: string;
  /** Plus session-scoped vars from `sessionStart` output `env`. */
  [key: string]: string | undefined;
}

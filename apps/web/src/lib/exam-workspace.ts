import type { AnswerPayload, PublicMvpPaper, PublicMvpQuestion } from "@gaokao-xinsheng/contracts";

export type WorkspaceQuestion = PublicMvpQuestion & { optionLabels?: Record<string, string> };
export type WorkspacePaper = Omit<PublicMvpPaper, "questions"> & { questions: WorkspaceQuestion[] };
export type HintEvent = { id?: string; questionId: string; level: number; message: string; createdAt?: string };
export type SessionView = {
  id: string;
  paperId: string;
  state: string;
  serverVersion: number;
  deadlineAt: string | null;
  reportId: string | null;
  settings?: { timer_mode: "STRICT" | "RELAXED"; ai_tutor_enabled: boolean };
  answers: Record<string, { answer: AnswerPayload; clientVersion?: number }[]>;
  aiHelpEvents?: HintEvent[];
};
export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type WorkspaceTransport = {
  save: (questionId: string, answer: AnswerPayload, clientVersion: number, baseVersion: number) => Promise<{ session: SessionView }>;
  hint: (questionId: string, level: number) => Promise<{ event: HintEvent; preAiAnswerVersionId: string | null }>;
  refresh: () => Promise<SessionView>;
  submit: (serverVersion: number, key: string) => Promise<{ id: string }>;
};
export type WorkspaceSnapshot = {
  session: SessionView;
  answers: Record<string, string>;
  scratch: Record<string, string>;
  marked: string[];
  hints: Record<string, HintEvent[]>;
  currentIndex: number;
  pending: string[];
  conflicts: string[];
  busy: "" | "hint" | "submit" | "refresh";
  saving: boolean;
  message: string;
  error: string;
  storageWarning: string;
};
const MAX_TEXT = 12000;
const CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
const terminal = new Set(["SUBMITTED", "GRADING", "GRADED", "CANCELLED", "FAILED"]);
export function isTerminalSession(state: string) { return terminal.has(state); }
export function answerText(answer?: AnswerPayload) {
  return answer ? (Array.isArray(answer.value) ? answer.value.join(",") : String(answer.value)) : "";
}
export function remainingTime(deadline: string | null, now = Date.now()) {
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return "--:--";
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function errorText(error: unknown) { return error instanceof Error ? error.message : "请求失败，请重试。"; }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function safeString(value: unknown): value is string { return typeof value === "string" && value.length <= MAX_TEXT; }

/** One controller per mounted exam. Only answer payloads go to the server; scratch stays in this tab. */
export class ExamWorkspace {
  private session: SessionView;
  private answers: Record<string, string> = {};
  private acknowledged: Record<string, string> = {};
  private scratch: Record<string, string> = {};
  private marked = new Set<string>();
  private hints: Record<string, HintEvent[]> = {};
  private conflicts = new Set<string>();
  private currentIndex = 0;
  private clientVersion = 0;
  private busy: WorkspaceSnapshot["busy"] = "";
  private saving = false;
  private message = "考试已恢复。草稿只保存在当前浏览器标签页。";
  private error = "";
  private storageWarning = "";
  private refreshRequired = false;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private submitting: Promise<{ id: string }> | null = null;
  private disposed = false;
  private readonly cacheKey: string;
  constructor(
    session: SessionView,
    readonly paper: WorkspacePaper,
    private transport: WorkspaceTransport,
    private storage?: StoragePort,
    private debounceMs = 700,
    private now: () => number = Date.now
  ) {
    if (session.paperId !== paper.id || !paper.questions.length) throw new Error("会话与试卷不匹配，请重新选卷。");
    this.session = session;
    this.cacheKey = `gx-workspace-v1:${session.id}:${paper.id}`;
    this.applyRemote(session);
    this.restoreCache();
    if (!storage) this.storageWarning = "浏览器未提供标签页存储；刷新前请确认答案已同步。";
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  snapshot(): WorkspaceSnapshot {
    return {
      session: this.session, answers: { ...this.answers }, scratch: { ...this.scratch },
      marked: [...this.marked], hints: { ...this.hints }, currentIndex: this.currentIndex,
      pending: this.pendingIds(), conflicts: [...this.conflicts], busy: this.busy,
      saving: this.saving, message: this.message, error: this.error, storageWarning: this.storageWarning
    };
  }
  private question(id: string) {
    const question = this.paper.questions.find((item) => item.id === id);
    if (!question) throw new Error("题目不属于当前试卷。");
    return question;
  }
  private editable() {
    if (this.disposed || isTerminalSession(this.session.state) || this.busy) throw new Error("当前状态不能修改作答。");
  }
  private pendingIds() { return this.paper.questions.filter((q) => (this.answers[q.id] ?? "") !== (this.acknowledged[q.id] ?? "")).map((q) => q.id); }
  private changed() { if (this.disposed) return; this.persist(); for (const listener of this.listeners) listener(); }
  private scheduleSave() {
    if (this.timer) clearTimeout(this.timer);
    if (this.debounceMs < 0 || this.disposed || this.conflicts.size) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => undefined); }, this.debounceMs);
  }
  setAnswer(id: string, value: string) {
    this.editable(); const question = this.question(id);
    if (!safeString(value)) throw new Error(`答案请控制在${MAX_TEXT}字以内。`);
    if (question.type === "single_choice" && !question.options?.includes(value)) throw new Error("请选择有效选项。");
    this.answers[id] = value;
    this.error = ""; this.message = "本机已记录，等待同步。";
    this.changed(); this.scheduleSave();
  }
  setScratch(id: string, value: string) {
    this.editable(); this.question(id);
    if (!safeString(value)) throw new Error(`草稿请控制在${MAX_TEXT}字以内。`);
    this.scratch[id] = value; this.changed();
  }
  mark(id: string) { this.question(id); if (this.marked.has(id)) this.marked.delete(id); else this.marked.add(id); this.changed(); }
  go(index: number) {
    if (this.busy || !Number.isInteger(index) || index < 0 || index >= this.paper.questions.length) return;
    this.currentIndex = index; this.changed(); this.scheduleSave();
  }
  resolveConflict(id: string, useLocal: boolean) {
    this.editable();
    if (!this.conflicts.has(id)) return;
    if (!useLocal) this.answers[id] = this.acknowledged[id] ?? "";
    this.conflicts.delete(id); this.error = ""; this.changed(); this.scheduleSave();
  }
  private applyRemote(session: SessionView) {
    if (session.id !== this.session.id || session.paperId !== this.paper.id) throw new Error("服务器返回了不匹配的考试会话。");
    for (const q of this.paper.questions) {
      const remote = answerText(session.answers[q.id]?.at(-1)?.answer);
      const local = this.answers[q.id] ?? "";
      const base = this.acknowledged[q.id] ?? "";
      if (remote === local || isTerminalSession(session.state)) this.conflicts.delete(q.id);
      if (local !== base && !isTerminalSession(session.state)) {
        if (remote !== base && remote !== local) this.conflicts.add(q.id);
      } else this.answers[q.id] = remote;
      this.acknowledged[q.id] = remote;
    }
    this.session = session;
    this.clientVersion = Math.max(this.clientVersion, ...Object.values(session.answers).flat().map((v) => v.clientVersion ?? 0));
    this.hints = {};
    for (const event of session.aiHelpEvents ?? []) {
      if (this.paper.questions.some((q) => q.id === event.questionId)) this.hints[event.questionId] = [...(this.hints[event.questionId] ?? []), event];
    }
  }
  async refresh() {
    if (this.busy || this.flushing) throw new Error("请等待当前操作完成后再恢复。");
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.busy = "refresh"; this.error = ""; this.changed();
    try {
      this.applyRemote(await this.transport.refresh()); this.refreshRequired = false;
      this.message = this.conflicts.size ? "发现本机与服务器答案不一致，请逐题确认。" : "服务器状态已恢复，可以继续。";
    } catch (e) { this.error = errorText(e); throw e; }
    finally { this.busy = ""; this.changed(); }
  }
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.disposed) return Promise.reject(new Error("页面已经关闭。"));
    if (this.busy === "refresh") return Promise.reject(new Error("正在恢复服务器状态，请完成后再同步。"));
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    // A microtask ensures the promise is assigned before cleanup, including an empty queue.
    this.flushing = Promise.resolve().then(async () => {
      if (this.refreshRequired) throw new Error("提示已返回，但状态同步失败。请先重新读取服务器状态。");
      if (this.conflicts.size) throw new Error("请先处理本机与服务器的答案冲突，再同步或交卷。");
      if (isTerminalSession(this.session.state)) {
        if (this.pendingIds().length) throw new Error("考试已结束，不能覆盖已交卷答案。");
        return;
      }
      while (this.pendingIds().length) {
        if (this.disposed) throw new Error("页面已关闭，未完成同步的答案保留在本机。");
        const id = this.pendingIds()[0];
        const q = this.question(id); const value = this.answers[id] ?? "";
        this.saving = true; this.message = `正在同步第${q.orderNo}题…`; this.changed();
        const saved = await this.transport.save(id, { type: q.type, value } as AnswerPayload, ++this.clientVersion, this.session.serverVersion);
        if (saved.session.id !== this.session.id || saved.session.paperId !== this.paper.id) throw new Error("保存响应与当前考试不一致。");
        // Do not replace a newer edit with the value captured at request start.
        this.acknowledged[id] = value;
        this.session = saved.session;
        this.changed();
      }
      this.message = "全部答案已同步。"; this.error = "";
    }).catch((e: unknown) => {
      this.error = errorText(e); this.message = "同步未完成，本机作答仍保留。"; throw e;
    }).finally(() => { this.saving = false; this.flushing = null; this.changed(); });
    return this.flushing;
  }
  async requestHint(questionId: string, level: number) {
    this.editable(); this.question(questionId);
    if (!Number.isInteger(level) || level < 1 || level > 4) throw new Error("请选择1至4级提示。");
    if (this.session.settings?.ai_tutor_enabled === false) throw new Error("本场考试未开启AI辅导。");
    this.busy = "hint"; this.error = ""; this.changed();
    try {
      await this.flush(); // A failed save MUST stop the hint, preserving the pre-help baseline.
      const result = await this.transport.hint(questionId, level);
      const event = { ...result.event, questionId };
      this.hints[questionId] = [...(this.hints[questionId] ?? []), event];
      this.message = "提示已记录。本题提示前答案由服务器保留。";
      try { this.applyRemote(await this.transport.refresh()); }
      catch { this.refreshRequired = true; this.error = "提示已返回，状态同步失败；继续前请重新读取服务器状态。"; }
      return result;
    } catch (e) { this.error = errorText(e); throw e; }
    finally { this.busy = ""; this.changed(); }
  }
  submit(): Promise<{ id: string }> {
    if (this.submitting) return this.submitting;
    if (this.session.reportId) return Promise.resolve({ id: this.session.reportId });
    try { this.editable(); } catch (e) { return Promise.reject(e); }
    this.busy = "submit"; this.error = ""; this.changed();
    this.submitting = Promise.resolve().then(async () => {
      await this.flush();
      const result = await this.transport.submit(this.session.serverVersion, `submit-${this.session.id}`);
      if (!result.id) throw new Error("服务器未返回成绩报告，请重试交卷。");
      this.session = { ...this.session, state: "GRADED", reportId: result.id };
      this.message = "交卷成功，正在打开报告。";
      return result;
    }).catch((e: unknown) => { this.error = errorText(e); throw e; })
      .finally(() => { this.busy = ""; this.submitting = null; this.changed(); });
    return this.submitting;
  }
  exportRecord() {
    return JSON.stringify({ scope: "personal-browser-record-not-official-score", sessionId: this.session.id, paperId: this.paper.id, exportedAt: new Date(this.now()).toISOString(), answers: this.answers, scratch: this.scratch, marked: [...this.marked] }, null, 2);
  }
  clearLocalNotes() { this.scratch = {}; this.marked.clear(); this.changed(); }
  private persist() {
    if (!this.storage) return;
    try {
      const pending = Object.fromEntries(this.pendingIds().map((id) => [id, { value: this.answers[id], base: this.acknowledged[id] ?? "", conflicted: this.conflicts.has(id) }]));
      this.storage.setItem(this.cacheKey, JSON.stringify({ version: 1, sessionId: this.session.id, paperId: this.paper.id, savedAt: this.now(), currentIndex: this.currentIndex, pending, scratch: this.scratch, marked: [...this.marked] }));
      this.storageWarning = "";
    } catch { this.storageWarning = "本机存储不可用或空间不足；未同步内容仅在内存，请保持页面打开或导出备份。"; }
  }
  private restoreCache() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.cacheKey); if (!raw) return;
      const cache: unknown = JSON.parse(raw);
      if (!record(cache) || cache.version !== 1 || cache.sessionId !== this.session.id || cache.paperId !== this.paper.id || typeof cache.savedAt !== "number" || this.now() - cache.savedAt > CACHE_AGE || cache.savedAt > this.now() + 60000) {
        this.storageWarning = "本机草稿版本不兼容或已过期，未自动恢复。"; return;
      }
      if (typeof cache.currentIndex === "number" && Number.isInteger(cache.currentIndex)) this.currentIndex = Math.max(0, Math.min(cache.currentIndex, this.paper.questions.length - 1));
      for (const q of this.paper.questions) {
        const note = record(cache.scratch) ? cache.scratch[q.id] : undefined;
        if (safeString(note)) this.scratch[q.id] = note;
        if (Array.isArray(cache.marked) && cache.marked.includes(q.id)) this.marked.add(q.id);
        const pending = record(cache.pending) ? cache.pending[q.id] : undefined;
        if (isTerminalSession(this.session.state) || !record(pending) || !safeString(pending.value) || !safeString(pending.base)) continue;
        if (q.type === "single_choice" && !q.options?.includes(pending.value)) continue;
        const remote = this.acknowledged[q.id] ?? "";
        this.answers[q.id] = pending.value;
        if (remote !== pending.value && (remote !== pending.base || pending.conflicted === true)) this.conflicts.add(q.id);
      }
      if (this.conflicts.size) this.message = "本机草稿与服务器答案不同，请确认后再同步。";
      else if (this.pendingIds().length) this.message = "已找回未同步作答，请点击“同步全部答案”。";
    } catch { this.storageWarning = "本机草稿无法读取。服务器答案未受影响，可继续作答。"; }
  }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.listeners.clear(); this.persist(); }
}

export async function requestJson<T>(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const external = init.signal;
  const abort = () => controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  if (external?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
    if (!response.ok || !payload || payload.data == null || payload.error) throw new Error(payload?.error?.message ?? `请求失败（HTTP ${response.status}），请重试。`);
    return payload.data;
  } catch (e) {
    if (controller.signal.aborted) throw new Error("请求已取消或超时；未同步作答仍保留，请重试。");
    throw e;
  } finally { clearTimeout(timer); external?.removeEventListener("abort", abort); }
}
export function workspaceTransport(sessionId: string): WorkspaceTransport {
  const base = `/api/v1/exam-sessions/${encodeURIComponent(sessionId)}`;
  const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    save: (id, answer, clientVersion, baseVersion) => requestJson(`${base}/answers/${encodeURIComponent(id)}`, { ...post({ client_version: clientVersion, base_server_version: baseVersion, answer, client_saved_at: new Date().toISOString() }), method: "PUT" }),
    hint: (id, level) => requestJson(`${base}/ai-help`, post({ question_id: id, level })),
    refresh: () => requestJson<SessionView>(base),
    submit: (version, key) => requestJson(`${base}/submit`, { ...post({ confirm_unanswered: true, last_known_server_version: version }), headers: { "Content-Type": "application/json", "Idempotency-Key": key } }, 60000)
  };
}

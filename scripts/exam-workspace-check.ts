import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ExamWorkspace, answerText, isTerminalSession, remainingTime, requestJson, workspaceTransport,
  type SessionView, type StoragePort, type WorkspacePaper, type WorkspaceTransport
} from "../apps/web/src/lib/exam-workspace";
import { previewChoiceLabels } from "../apps/web/src/lib/preview-choice-labels";

const NOW = 1800000000000;
const paper: WorkspacePaper = {
  id: "fixture", title: "测试卷", year: 2010, region: "测试", track: "理科", subject: "数学", paperType: "QUICK_15", totalScore: 15, durationMinutes: 15, status: "PREVIEW",
  questions: [
    { id: "q1", orderNo: 1, section: "选择题", type: "single_choice", stem: "测试选择题", maxScore: 5, options: ["A", "B", "C", "D"] },
    { id: "q2", orderNo: 2, section: "填空题", type: "fill_blank", stem: "测试填空题", maxScore: 5 },
    { id: "q3", orderNo: 3, section: "解答题", type: "free_response", stem: "测试解答题", maxScore: 5 }
  ]
};
function memoryStorage() {
  const data = new Map<string, string>();
  const storage: StoragePort = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } };
  return { storage, data };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function fixture(options: { storage?: StoragePort; session?: SessionView; debounce?: number } = {}) {
  const remote: SessionView = structuredClone(options.session ?? { id: "exam-test", paperId: paper.id, state: "IN_PROGRESS", serverVersion: 0, deadlineAt: new Date(NOW + 900000).toISOString(), reportId: null, answers: {}, aiHelpEvents: [] });
  const calls: { kind: string; id?: string; value?: unknown; version?: number; base?: number; key?: string }[] = [];
  const flags = { saveFailure: false, submitFailure: false, refreshFailure: false };
  let gate: ReturnType<typeof deferred> | null = null;
  const transport: WorkspaceTransport = {
    async save(id, answer, version, base) {
      calls.push({ kind: "save", id, value: answer.value, version, base });
      if (gate) { const waiting = gate; gate = null; await waiting.promise; }
      if (flags.saveFailure) throw new Error("网络不可用");
      remote.serverVersion++;
      remote.answers[id] = [...(remote.answers[id] ?? []), { answer, clientVersion: version }];
      return { session: structuredClone(remote) };
    },
    async hint(id, level) {
      calls.push({ kind: "hint", id });
      const event = { id: `hint-${calls.length}`, questionId: id, level, message: `第${level}级测试提示` };
      remote.aiHelpEvents = [...(remote.aiHelpEvents ?? []), event];
      return { event, preAiAnswerVersionId: "snapshot" };
    },
    async refresh() { calls.push({ kind: "refresh" }); if (flags.refreshFailure) throw new Error("刷新失败"); return structuredClone(remote); },
    async submit(version, key) {
      calls.push({ kind: "submit", version, key });
      if (flags.submitFailure) throw new Error("交卷网络失败");
      remote.state = "GRADED"; remote.reportId = "report-test";
      return { id: remote.reportId };
    }
  };
  const store = options.storage ?? memoryStorage().storage;
  const ws = new ExamWorkspace(structuredClone(remote), paper, transport, store, options.debounce ?? -1, () => NOW);
  return { ws, remote, calls, flags, transport, store, holdNextSave: () => { gate = deferred(); return gate; } };
}

test("switching questions retains and serially saves EVERY edited answer", async () => {
  const f = fixture(); f.ws.setAnswer("q1", "B"); f.ws.go(1); f.ws.setAnswer("q2", "8"); f.ws.go(2); f.ws.setAnswer("q3", "步骤");
  await f.ws.flush(); assert.deepEqual(f.calls.map((c) => [c.id, c.base]), [["q1", 0], ["q2", 1], ["q3", 2]]); assert.equal(f.ws.snapshot().pending.length, 0);
});
test("editing during a save cannot be replaced by the earlier response", async () => {
  const f = fixture(); const gate = f.holdNextSave(); f.ws.setAnswer("q2", "old"); const saving = f.ws.flush();
  await new Promise((r) => setImmediate(r)); f.ws.setAnswer("q2", "new"); gate.resolve(); await saving;
  assert.deepEqual(f.calls.filter((c) => c.kind === "save").map((c) => c.value), ["old", "new"]); assert.equal(f.ws.snapshot().answers.q2, "new");
});
test("a failed save blocks hint calls and preserves the local answer", async () => {
  const f = fixture(); f.ws.setAnswer("q1", "B"); f.flags.saveFailure = true;
  await assert.rejects(f.ws.requestHint("q1", 1)); assert.equal(f.calls.some((c) => c.kind === "hint"), false); assert.deepEqual(f.ws.snapshot().pending, ["q1"]);
});
test("a failed save blocks submit calls", async () => {
  const f = fixture(); f.ws.setAnswer("q2", "8"); f.flags.saveFailure = true;
  await assert.rejects(f.ws.submit()); assert.equal(f.calls.some((c) => c.kind === "submit"), false); assert.equal(f.ws.snapshot().busy, "");
});
test("network recovery resends retained pending answers before submit", async () => {
  const f = fixture(); f.ws.setAnswer("q2", "8"); f.flags.saveFailure = true; await assert.rejects(f.ws.flush()); f.flags.saveFailure = false;
  await f.ws.submit(); assert.equal(f.remote.answers.q2.at(-1)?.answer.value, "8"); assert.equal(f.calls.at(-1)?.kind, "submit");
});
test("submit drains every pending question and passes the latest server version", async () => {
  const f = fixture(); f.ws.setAnswer("q1", "B"); f.ws.setAnswer("q2", "8"); await f.ws.submit();
  assert.deepEqual(f.calls.at(-1), { kind: "submit", version: 2, key: "submit-exam-test" });
});
test("double submit shares one in-flight request", async () => {
  const f = fixture(); const one = f.ws.submit(); const two = f.ws.submit(); assert.equal(one, two); await Promise.all([one, two]); assert.equal(f.calls.filter((c) => c.kind === "submit").length, 1);
});
test("submit retry reuses its idempotency key", async () => {
  const f = fixture(); f.flags.submitFailure = true; await assert.rejects(f.ws.submit()); f.flags.submitFailure = false; await f.ws.submit();
  assert.deepEqual(f.calls.filter((c) => c.kind === "submit").map((c) => c.key), ["submit-exam-test", "submit-exam-test"]);
});
test("successful submit locks edits and subsequent submit reuses its report", async () => {
  const f = fixture(); await f.ws.submit(); assert.throws(() => f.ws.setAnswer("q2", "9")); assert.equal((await f.ws.submit()).id, "report-test"); assert.equal(f.calls.length, 1);
});
test("hint cannot overwrite a draft while its baseline is being saved", async () => {
  const f = fixture(); f.ws.setAnswer("q2", "8"); const pending = f.ws.requestHint("q2", 2); assert.throws(() => f.ws.setAnswer("q2", "9")); await pending;
  assert.deepEqual(f.calls.map((c) => c.kind), ["save", "hint", "refresh"]);
});
test("hints remain attached to their question when navigating", async () => {
  const f = fixture(); await f.ws.requestHint("q1", 1); f.ws.go(1); assert.equal(f.ws.snapshot().hints.q2, undefined); f.ws.go(0); assert.equal(f.ws.snapshot().hints.q1.length, 1);
});
test("no attempt before a choice hint does not submit a fake empty choice payload", async () => {
  const f = fixture(); await f.ws.requestHint("q1", 1); assert.equal(f.calls.some((c) => c.kind === "save"), false);
});
test("a successful hint followed by failed refresh blocks further writes until recovery", async () => {
  const f = fixture(); f.flags.refreshFailure = true; await f.ws.requestHint("q1", 1); assert.equal(f.ws.snapshot().hints.q1.length, 1);
  f.ws.setAnswer("q2", "8"); await assert.rejects(f.ws.flush()); assert.equal(f.calls.some((c) => c.kind === "save"), false);
  f.flags.refreshFailure = false; await f.ws.refresh(); await f.ws.flush(); assert.equal(f.remote.answers.q2.at(-1)?.answer.value, "8");
});
test("rehydration recovers unsynced answers, per-question notes, marks and position", () => {
  const storage = memoryStorage(); const f = fixture({ storage: storage.storage }); f.ws.setAnswer("q2", "8"); f.ws.setScratch("q2", "不发送的草稿"); f.ws.mark("q2"); f.ws.go(1); f.ws.dispose();
  const r = fixture({ storage: storage.storage }); assert.equal(r.ws.snapshot().answers.q2, "8"); assert.equal(r.ws.snapshot().scratch.q2, "不发送的草稿"); assert.deepEqual(r.ws.snapshot().marked, ["q2"]); assert.equal(r.ws.snapshot().currentIndex, 1);
});
test("local draft conflict requires an explicit decision before writing", async () => {
  const storage = memoryStorage(); const f = fixture({ storage: storage.storage }); f.ws.setAnswer("q2", "local"); f.ws.dispose();
  f.remote.answers.q2 = [{ answer: { type: "fill_blank", value: "remote" } }];
  const r = fixture({ storage: storage.storage, session: f.remote }); assert.deepEqual(r.ws.snapshot().conflicts, ["q2"]); await assert.rejects(r.ws.flush()); assert.equal(r.calls.length, 0);
  r.ws.resolveConflict("q2", true); await r.ws.flush(); assert.equal(r.remote.answers.q2.at(-1)?.answer.value, "local");
});
test("choosing the server answer clears the conflicting local write", async () => {
  const storage = memoryStorage(); const f = fixture({ storage: storage.storage }); f.ws.setAnswer("q2", "local"); f.ws.dispose(); f.remote.answers.q2 = [{ answer: { type: "fill_blank", value: "remote" } }];
  const r = fixture({ storage: storage.storage, session: f.remote }); r.ws.resolveConflict("q2", false); await r.ws.flush(); assert.equal(r.ws.snapshot().answers.q2, "remote"); assert.equal(r.calls.length, 0);
});
test("lost acknowledgment is recognized when the server already has the same answer", () => {
  const storage = memoryStorage(); const f = fixture({ storage: storage.storage }); f.ws.setAnswer("q2", "8"); f.ws.dispose(); f.remote.answers.q2 = [{ answer: { type: "fill_blank", value: "8" } }];
  const r = fixture({ storage: storage.storage, session: f.remote }); assert.equal(r.ws.snapshot().pending.length, 0); assert.equal(r.ws.snapshot().conflicts.length, 0);
});
test("cache for another session is never restored", () => {
  const storage = memoryStorage(); const f = fixture({ storage: storage.storage }); f.ws.setAnswer("q2", "private"); f.ws.dispose(); const session = { ...f.remote, id: "another-user-session" };
  assert.equal(fixture({ storage: storage.storage, session }).ws.snapshot().answers.q2, "");
});
test("completed sessions ignore unsynced cache and preserve the submitted answer", () => {
  const storage = memoryStorage(); const f = fixture({ storage: storage.storage }); f.ws.setAnswer("q2", "stale"); f.ws.dispose(); f.remote.state = "GRADED"; f.remote.reportId = "report";
  const r = fixture({ storage: storage.storage, session: f.remote }); assert.equal(r.ws.snapshot().answers.q2, ""); assert.equal(r.ws.snapshot().pending.length, 0);
});
test("expired, corrupted, invalid choice and unknown-question cache data are not trusted", () => {
  const storage = memoryStorage(); const key = "gx-workspace-v1:exam-test:fixture";
  storage.storage.setItem(key, "{broken"); assert.match(fixture({ storage: storage.storage }).ws.snapshot().storageWarning, /无法读取/);
  storage.storage.setItem(key, JSON.stringify({ version: 1, sessionId: "exam-test", paperId: "fixture", savedAt: NOW - 8 * 86400000 })); assert.match(fixture({ storage: storage.storage }).ws.snapshot().storageWarning, /过期/);
  storage.storage.setItem(key, JSON.stringify({ version: 1, sessionId: "exam-test", paperId: "fixture", savedAt: NOW, currentIndex: 999, pending: { q1: { value: "INVALID", base: "" }, intruder: { value: "x", base: "" } } }));
  const r = fixture({ storage: storage.storage }); assert.equal(r.ws.snapshot().pending.length, 0); assert.equal(r.ws.snapshot().currentIndex, 2);
});
test("storage denial is surfaced without losing the in-memory answer", async () => {
  const denied: StoragePort = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => undefined };
  const f = fixture({ storage: denied }); f.ws.setAnswer("q2", "8"); assert.match(f.ws.snapshot().storageWarning, /存储不可用/); await f.ws.flush(); assert.equal(f.remote.answers.q2.at(-1)?.answer.value, "8");
});
test("scratch and marks never enter the answer transport", async () => {
  const f = fixture(); f.ws.setScratch("q2", "secret note"); f.ws.mark("q2"); f.ws.setAnswer("q2", "8"); await f.ws.flush();
  assert.equal(JSON.stringify(f.calls).includes("secret note"), false); f.ws.clearLocalNotes(); assert.deepEqual(f.ws.snapshot().scratch, {}); assert.equal(f.ws.snapshot().answers.q2, "8");
});
test("clearing a text answer persists the empty value", async () => {
  const f = fixture(); f.ws.setAnswer("q2", "8"); await f.ws.flush(); f.ws.setAnswer("q2", ""); await f.ws.flush(); assert.equal(f.remote.answers.q2.at(-1)?.answer.value, "");
});
test("client versions resume from the server maximum", async () => {
  const f = fixture(); f.remote.answers.q2 = [{ answer: { type: "fill_blank", value: "8" }, clientVersion: 17 }];
  const r = fixture({ session: f.remote }); r.ws.setAnswer("q2", "9"); await r.ws.flush(); assert.equal(r.calls[0].version, 18);
});
test("unchanged answers do not create duplicate answer versions", async () => {
  const f = fixture(); f.ws.setAnswer("q2", "8"); await f.ws.flush(); f.ws.setAnswer("q2", "8"); await f.ws.flush(); assert.equal(f.calls.length, 1);
});
test("debounced autosave and disposal do not leak scheduled writes", async () => {
  const f = fixture({ debounce: 5 }); f.ws.setAnswer("q2", "8"); await new Promise((r) => setTimeout(r, 30)); assert.equal(f.calls.length, 1);
  f.ws.setAnswer("q2", "9"); f.ws.dispose(); await new Promise((r) => setTimeout(r, 30)); assert.equal(f.calls.length, 1);
});
test("invalid questions, hint levels and oversized text are rejected", async () => {
  const f = fixture(); assert.throws(() => f.ws.setAnswer("unknown", "x")); assert.throws(() => f.ws.setAnswer("q1", "E")); assert.throws(() => f.ws.setScratch("q2", "x".repeat(12001))); await assert.rejects(f.ws.requestHint("q1", 5)); assert.equal(f.calls.length, 0);
});
test("clock and answer format utilities handle edge cases", () => {
  assert.equal(remainingTime(new Date(NOW + 65000).toISOString(), NOW), "01:05"); assert.equal(remainingTime(new Date(NOW - 1).toISOString(), NOW), "00:00"); assert.equal(remainingTime("invalid", NOW), "--:--"); assert.equal(answerText(undefined), ""); assert.equal(isTerminalSession("GRADED"), true);
});
test("all fourteen synthetic choice questions have four distinct visible labels", () => {
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 25, 26]) {
    const labels = previewChoiceLabels(`q_2010_sd_math_${String(id).padStart(2, "0")}`)!;
    assert.deepEqual(Object.keys(labels), ["A", "B", "C", "D"]); assert.equal(new Set(Object.values(labels)).size, 4);
  }
  assert.equal(previewChoiceLabels("real-paper-2012-question-1"), undefined);
});
test("client imports public types only and loads the session paper by ID", () => {
  const client = readFileSync("apps/web/src/app/exam/[sessionId]/ExamClient.tsx", "utf8");
  const engine = readFileSync("apps/web/src/lib/exam-workspace.ts", "utf8");
  assert.ok(!client.includes("mvpPaper")); assert.ok(client.includes("encodeURIComponent(session.paperId)")); assert.match(engine, /^import type /); assert.ok(!engine.includes("correctAnswer")); assert.ok(client.includes("流程演示样卷"));
});
test("HTTP transport propagates save errors instead of pretending success", async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: null, error: { message: "保存被拒绝" } }), { status: 409 });
  try { await assert.rejects(workspaceTransport("exam-test").save("q2", { type: "fill_blank", value: "8" }, 1, 0), /保存被拒绝/); }
  finally { globalThis.fetch = old; }
});
test("HTTP transport rejects malformed envelopes and timeout", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("not json", { status: 200 }); await assert.rejects(requestJson("/fixture"), /请求失败/);
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    await assert.rejects(requestJson("/fixture", {}, 10), /超时/);
  } finally { globalThis.fetch = old; }
});

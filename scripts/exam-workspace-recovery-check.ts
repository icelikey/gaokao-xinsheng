import { test } from "node:test";
import assert from "node:assert/strict";
import { ExamWorkspace, type SessionView, type WorkspacePaper, type WorkspaceTransport, type StoragePort } from "../apps/web/src/lib/exam-workspace";
const paper: WorkspacePaper = {
  id: "recovery-fixture", title: "恢复测试卷", year: 2010, region: "测试", track: "理科", subject: "数学", paperType: "QUICK_15", totalScore: 5, durationMinutes: 15, status: "PREVIEW",
  questions: [{ id: "q", orderNo: 1, section: "填空题", type: "fill_blank", stem: "测试", maxScore: 5 }]
};
function fixture() {
  const data = new Map<string, string>();
  const storage: StoragePort = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
  const remote: SessionView = { id: "session", paperId: paper.id, state: "IN_PROGRESS", serverVersion: 0, deadlineAt: null, reportId: null, answers: {} };
  const saves: string[] = [];
  const transport: WorkspaceTransport = {
    save: async (id, answer) => { saves.push(id); remote.answers[id] = [{ answer }]; return { session: structuredClone(remote) }; },
    refresh: async () => structuredClone(remote),
    hint: async (id, level) => ({ event: { questionId: id, level, message: "test" }, preAiAnswerVersionId: null }),
    submit: async () => ({ id: "report" })
  };
  return { remote, storage, saves, transport, create: (delay = -1) => new ExamWorkspace(structuredClone(remote), paper, transport, storage, delay) };
}
test("an unresolved answer conflict remains unresolved after another reload", async () => {
  const f = fixture(); const first = f.create(); first.setAnswer("q", "local"); first.dispose();
  f.remote.answers.q = [{ answer: { type: "fill_blank", value: "remote" } }];
  const second = f.create(); assert.deepEqual(second.snapshot().conflicts, ["q"]); second.dispose();
  const third = f.create(); assert.deepEqual(third.snapshot().conflicts, ["q"]);
  await assert.rejects(third.flush()); assert.equal(f.saves.length, 0); third.dispose();
});
test("refresh cancels a pending autosave and prevents concurrent writes until reconciliation", async () => {
  const f = fixture(); const ws = f.create(5);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  ws.setAnswer("q", "local"); f.remote.answers.q = [{ answer: { type: "fill_blank", value: "remote" } }];
  f.transport.refresh = async () => { await gate; return structuredClone(f.remote); };
  const refreshing = ws.refresh();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(f.saves.length, 0); await assert.rejects(ws.flush(), /恢复/);
  release(); await refreshing; assert.deepEqual(ws.snapshot().conflicts, ["q"]); ws.dispose();
});

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ExamWorkspace, isTerminalSession, remainingTime, requestJson, workspaceTransport,
  type SessionView, type StoragePort, type WorkspacePaper, type WorkspaceSnapshot
} from "@/lib/exam-workspace";
import "./workspace.css";

const typeLabel = { single_choice: "选择题", fill_blank: "填空题", free_response: "解答题" } as const;
const hintLabels = ["读懂题目", "知识提醒", "第一步提示", "分步讲解"];

type ModalKind = "submit" | "hint" | "rest" | "clear" | "";
function SheetDialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !element.current?.open) element.current?.showModal();
    if (!open && element.current?.open) element.current.close();
  }, [open]);
  return <dialog ref={element} className="workspaceDialog" aria-labelledby="workspace-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="workspace-dialog-title">{title}</h2>{children}
  </dialog>;
}

export function ExamClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const controller = useRef<ExamWorkspace | null>(null);
  const [paper, setPaper] = useState<WorkspacePaper | null>(null);
  const [view, setView] = useState<WorkspaceSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [dialog, setDialog] = useState<ModalKind>("");
  const [filter, setFilter] = useState("all");
  const [showScratch, setShowScratch] = useState(false);
  const [hideClock, setHideClock] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    let workspace: ExamWorkspace | undefined;
    let unsubscribe: (() => void) | undefined;
    async function restore() {
      setLoadError(""); setView(null); setPaper(null);
      try {
        const session = await requestJson<SessionView>(`/api/v1/exam-sessions/${encodeURIComponent(sessionId)}`, { signal: abort.signal });
        const loaded = await requestJson<WorkspacePaper>(`/api/v1/papers/${encodeURIComponent(session.paperId)}`, { signal: abort.signal });
        if (!active) return;
        let storage: StoragePort | undefined;
        try { storage = window.sessionStorage; } catch { /* Storage denial is shown by the controller. */ }
        workspace = new ExamWorkspace(session, loaded, workspaceTransport(sessionId), storage);
        controller.current = workspace;
        const store = workspace;
        unsubscribe = store.subscribe(() => { if (active) setView(store.snapshot()); });
        setPaper(loaded); setView(store.snapshot());
      } catch (error) { if (active) setLoadError(error instanceof Error ? error.message : "无法恢复考试，请重试。"); }
    }
    void restore();
    return () => { active = false; abort.abort(); unsubscribe?.(); workspace?.dispose(); if (controller.current === workspace) controller.current = null; };
  }, [sessionId, retry]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const protect = (event: BeforeUnloadEvent) => {
      const state = controller.current?.snapshot();
      if (state && (state.pending.length || state.busy || state.saving)) { event.preventDefault(); event.returnValue = ""; }
    };
    const reconnect = () => {
      const store = controller.current; const state = store?.snapshot();
      if (store && state && !state.busy && !state.conflicts.length && !isTerminalSession(state.session.state)) void store.flush().catch(() => undefined);
    };
    window.addEventListener("beforeunload", protect);
    window.addEventListener("online", reconnect);
    return () => { clearInterval(timer); window.removeEventListener("beforeunload", protect); window.removeEventListener("online", reconnect); };
  }, []);

  function act(operation: () => void | Promise<unknown>) {
    setNotice("");
    try { void Promise.resolve(operation()).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "操作失败，请重试。")); }
    catch (error) { setNotice(error instanceof Error ? error.message : "操作失败，请重试。"); }
  }
  function downloadRecord() {
    const store = controller.current; if (!store) return;
    const url = URL.createObjectURL(new Blob([store.exportRecord()], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `高考新生-本机作答-${sessionId.slice(-8)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!view || !paper) return <main className="examShell workspaceLoading">
    <Link href="/exam">← 返回考生登记</Link><section className="questionPanel"><p className="eyebrow">考场档案</p><h1>正在找回你的试卷</h1>
      <p role={loadError ? "alert" : "status"}>{loadError || "读取考试会话与公开题目…"}</p>
      {loadError && <button className="primaryButton" onClick={() => setRetry((n) => n + 1)}>重新读取</button>}
    </section></main>;

  const store = controller.current;
  const question = paper.questions[view.currentIndex];
  const finished = isTerminalSession(view.session.state);
  const locked = Boolean(view.busy) || finished || !store;
  const answered = paper.questions.filter((q) => (view.answers[q.id] ?? "").trim()).length;
  const hints = view.hints[question.id] ?? [];
  const currentMarked = view.marked.includes(question.id);
  const currentConflict = view.conflicts.includes(question.id);
  const visibleQuestions = paper.questions.filter((q) => filter === "all" || (filter === "unanswered" ? !(view.answers[q.id] ?? "").trim() : view.marked.includes(q.id)));
  const clock = remainingTime(view.session.deadlineAt, now || Date.now());

  return <main className="examShell workspacePage" id="main-content">
    <header className="workspaceTopbar">
      <Link className="workspaceBrand" href="/exam" onClick={(event) => {
        if (view.pending.length || view.busy || view.saving) {
          event.preventDefault(); act(async () => { if (view.busy) throw new Error("请等待当前操作结束。"); await store?.flush(); router.push("/exam"); });
        }
      }}><b>新</b><span>高考新生<small>考生作答室</small></span></Link>
      <div className="workspaceClock"><span>参考剩余时间</span><strong>{hideClock ? "已隐藏" : clock}</strong><button onClick={() => setHideClock(!hideClock)}>{hideClock ? "显示计时" : "隐藏计时"}</button></div>
      <button className="secondaryButton darkButton" disabled={Boolean(view.busy)} onClick={() => setDialog("rest")}>暂离一下</button>
    </header>
    <aside className="workspacePreviewNote" role="note">流程演示样卷 · 届次标签不代表当年高考原卷。当前辅导与估分为预置规则演示，非真实模型评阅。</aside>
    {finished && <section className="workspaceNotice"><strong>这场考试已结束。</strong>已交卷答案不可修改。{view.session.reportId && <Link href={`/reports/${view.session.reportId}`}>查看本次报告 →</Link>}</section>}
    {(notice || view.error || view.storageWarning) && <section className="workspaceWarning" role="alert">
      <p>{notice || view.error || view.storageWarning}</p>
      {view.storageWarning && (notice || view.error) && <p>{view.storageWarning}</p>}
      <div className="workspaceInlineActions"><button disabled={locked || view.saving} onClick={() => act(() => store?.refresh())}>重新读取服务器状态</button><button onClick={downloadRecord}>导出本机备份</button></div>
    </section>}
    {view.conflicts.length > 0 && <section className="workspaceWarning">有{view.conflicts.length}题存在本机与服务器答案冲突。请在对应题目中确认，未确认前不会自动覆盖或交卷。</section>}

    <div className="examWorkspace workspaceColumns">
      <aside className="answerCardPanel workspaceAnswerCard">
        <p className="eyebrow">答题卡 · 当前样卷</p><h2><strong>{answered}</strong> / {paper.questions.length}<small>已作答</small></h2>
        <div className="workspaceFilters" aria-label="题目筛选">
          {[["all", "全部"], ["unanswered", "未答"], ["marked", "标记"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <div className="answerGrid workspaceAnswerGrid">
          {visibleQuestions.map((q) => <button key={q.id} disabled={Boolean(view.busy)} aria-current={q.id === question.id ? "step" : undefined}
            aria-label={`第${q.orderNo}题${view.answers[q.id]?.trim() ? "，已答" : "，未答"}${view.marked.includes(q.id) ? "，已标记" : ""}${view.pending.includes(q.id) ? "，未同步" : ""}`}
            className={[view.answers[q.id]?.trim() ? "answered" : "", view.marked.includes(q.id) ? "marked" : "", view.conflicts.includes(q.id) ? "conflicted" : ""].join(" ")}
            onClick={() => store?.go(paper.questions.indexOf(q))}>{q.orderNo}{view.pending.includes(q.id) && <i aria-hidden="true" />}</button>)}
        </div>
        {!visibleQuestions.length && <p className="workspaceMuted">当前筛选下没有题目。</p>}
        <p className="workspaceLegend">实心：已答　角标：标记　小点：待同步</p>
        <div className="workspaceSaveBox" role="status" aria-live="polite"><strong>{view.saving ? "正在同步…" : view.pending.length ? `${view.pending.length}题待同步` : "答案已同步"}</strong><p>{view.message}</p></div>
        <button className="secondaryButton darkButton wideButton" disabled={locked || view.saving} onClick={() => act(() => store?.flush())}>同步全部答案</button>
        <button className="primaryButton submitButton" disabled={locked} onClick={() => setDialog("submit")}>{view.busy === "submit" ? "正在交卷…" : "检查并交卷"}</button>
        <p className="workspaceFootnote">演示计时不自动交卷。可以只完成一部分，也可以继续检查。</p>
      </aside>

      <section className="questionPanel workspaceQuestion" aria-labelledby="question-heading">
        <div className="workspacePaperTitle"><span>{paper.title}</span><span>{paper.subject} / 作答页</span></div>
        <div className="questionMeta"><span>{typeLabel[question.type]}</span><span>第{question.orderNo}题 · {question.maxScore}分</span><button disabled={Boolean(view.busy)} aria-pressed={currentMarked} onClick={() => store?.mark(question.id)}>{currentMarked ? "已标记，取消" : "标记这道题"}</button></div>
        <h1 id="question-heading">{question.stem}</h1>
        {currentConflict && <div className="workspaceWarning"><p>本机答案与服务器版本不同，选择要保留的版本。</p><p>服务器：{String(view.session.answers[question.id]?.at(-1)?.answer.value ?? "未作答")}</p><div className="workspaceInlineActions"><button disabled={locked} onClick={() => act(() => store?.resolveConflict(question.id, true))}>使用当前本机答案</button><button disabled={locked} onClick={() => act(() => store?.resolveConflict(question.id, false))}>保留服务器答案</button></div></div>}
        {question.type === "single_choice" ? <div className="choiceGroup workspaceChoices" role="group" aria-label="本题选项">
          {question.options?.map((option) => <button key={option} disabled={locked} aria-pressed={view.answers[question.id] === option} className={view.answers[question.id] === option ? "selected" : ""} onClick={() => act(() => store?.setAnswer(question.id, option))}><b>{option}</b><span>{question.optionLabels?.[option] ?? "题库未提供选项文字"}</span></button>)}
        </div> : <label className="workspaceAnswerLabel">{question.type === "free_response" ? "写下答案和推导步骤" : "填写答案"}<textarea aria-label={question.type === "free_response" ? "写下答案和推导步骤" : "填写答案"} key={question.id} disabled={locked} maxLength={12000} value={view.answers[question.id] ?? ""} onChange={(event) => act(() => store?.setAnswer(question.id, event.target.value))} placeholder={question.type === "free_response" ? "例如：先列出已知条件，再写出推导。不完整的步骤也可以保留。" : "输入数字或表达式，例如 3x^2"} /></label>}

        <div className="workspaceScratchTools"><button aria-expanded={showScratch} onClick={() => setShowScratch(!showScratch)}>{showScratch ? "收起草稿纸" : "打开草稿纸"}</button><span>草稿不参与评分，不发送给AI</span></div>
        {showScratch && <section className="workspaceScratch"><label>第{question.orderNo}题 · 本机草稿<textarea disabled={locked} maxLength={12000} value={view.scratch[question.id] ?? ""} onChange={(event) => act(() => store?.setScratch(question.id, event.target.value))} placeholder="先把想到的写在这里…" /></label>
          {question.type === "free_response" && <button disabled={locked || !view.scratch[question.id]} onClick={() => act(() => store?.setAnswer(question.id, `${view.answers[question.id] ?? ""}\n${view.scratch[question.id] ?? ""}`.trim()))}>将草稿追加到正式答案</button>}
          <small>保存在当前标签页，关闭标签页可能清除。参与批改的思路请写入正式答案。</small></section>}
        <div className="examActions workspaceQuestionNavigation"><button className="secondaryButton darkButton" disabled={view.currentIndex === 0 || Boolean(view.busy)} onClick={() => store?.go(view.currentIndex - 1)}>← 上一题</button><span>{view.currentIndex + 1} / {paper.questions.length}</span><button className="primaryButton" disabled={view.currentIndex === paper.questions.length - 1 || Boolean(view.busy)} onClick={() => store?.go(view.currentIndex + 1)}>下一题 →</button></div>

        <section className="aiPanel workspaceTutor" aria-labelledby="tutor-title"><div className="workspaceTutorHeader"><span aria-hidden="true">问</span><div><p className="eyebrow">AI老师 · 预置提示演示</p><h2 id="tutor-title">不会的地方，慢慢来。</h2></div></div>
          <p>按你需要的程度选择帮助。会先同步答案，再记录本题提示前版本。</p>
          <div className="hintButtons workspaceHints">{hintLabels.map((label, index) => <button key={label} disabled={locked || view.session.settings?.ai_tutor_enabled === false} onClick={() => { if (index === 3) setDialog("hint"); else act(() => store?.requestHint(question.id, index + 1)); }}><small>0{index + 1}</small>{label}</button>)}</div>
          <div className="workspaceHintHistory" aria-live="polite">{view.busy === "hint" && <p role="status">正在保存提示前答案并读取讲解…</p>}
            {!hints.length && <p className="workspaceHintEmpty">还没有请求本题的提示。忘记了知识点，也可以从第一步开始。</p>}
            {hints.map((hint, index) => <article key={hint.id ?? `${question.id}-${index}`}><b>{hintLabels[hint.level - 1] ?? "本题提示"}</b><p>{hint.message}</p></article>)}
          </div>
        </section>
      </section>
    </div>
    <footer className="workspaceBottom"><span>高考新生 · 记录这一次的作答，不评价你的人生。</span><div><button onClick={downloadRecord}>导出本机作答</button><button disabled={Boolean(view.busy)} onClick={() => setDialog("clear")}>清除本机草稿与标记</button></div></footer>

    <SheetDialog open={Boolean(dialog)} title={dialog === "submit" ? "交卷前，再看一眼" : dialog === "hint" ? "请求第四级分步讲解？" : dialog === "clear" ? "清除本机草稿与标记？" : "先休息一下"} onClose={() => { if (!view.busy) setDialog(""); }}>
      {dialog === "submit" && <><p>已作答{answered}题，未答{paper.questions.length - answered}题，标记{view.marked.length}题。</p><p>将先同步全部待保存答案，再提交。保存失败不会交卷。草稿纸不参与评分。</p>{view.error && <p role="alert" className="workspaceDialogError">{view.error}</p>}<div className="workspaceDialogActions"><button disabled={Boolean(view.busy)} onClick={() => setDialog("")}>返回检查</button><button className="primaryButton" disabled={locked || view.conflicts.length > 0} onClick={() => act(async () => { if (!store) return; const result = await store.submit(); setDialog(""); router.push(`/reports/${result.id}`); })}>{view.busy === "submit" ? "正在同步并交卷…" : "确认交卷"}</button></div></>}
      {dialog === "hint" && <><p>本题后续作答会标记为使用过辅助。当前版本展示预置分步提示，并不调用真实模型。</p><div className="workspaceDialogActions"><button onClick={() => setDialog("")}>我再想一想</button><button className="primaryButton" onClick={() => { setDialog(""); act(() => store?.requestHint(question.id, 4)); }}>确认查看讲解</button></div></>}
      {dialog === "rest" && <><p>答案和草稿仍然保留。暂离只遮住题目，不暂停服务器参考计时。</p><p>不必急着做完，准备好后再继续。</p><button className="primaryButton" onClick={() => setDialog("")}>继续作答</button></>}
      {dialog === "clear" && <><p>只清除这个标签页中的草稿和题目标记，不删除正式答案，也不删除服务器记录。</p><div className="workspaceDialogActions"><button onClick={() => setDialog("")}>保留</button><button className="primaryButton" onClick={() => { store?.clearLocalNotes(); setDialog(""); }}>确认清除</button></div></>}
    </SheetDialog>
  </main>;
}

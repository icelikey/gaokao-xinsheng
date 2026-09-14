"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDefaultPaperMatchInput, type CatalogRegion, type CatalogYear, type PaperCandidate } from "@gaokao-xinsheng/contracts";

type ApiResponse<T> = { data: T | null; error: { code: string; message: string } | null };
type PaperMatchResult = { candidates: PaperCandidate[]; autoSelectedPaperId: string | null };
const defaults = getDefaultPaperMatchInput();

async function readData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.error || payload.data == null) {
    throw new Error(payload.error?.message ?? "请求未完成，请重试。");
  }
  return payload.data;
}

export default function ExamEntryPage() {
  const router = useRouter();
  const [status, setStatus] = useState("正在翻阅试卷目录…");
  const [isStarting, setIsStarting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [years, setYears] = useState<CatalogYear[]>([]);
  const [regions, setRegions] = useState<CatalogRegion[]>([]);
  const [year, setYear] = useState(defaults.year);
  const [region, setRegion] = useState(defaults.region);
  const [track, setTrack] = useState(defaults.track);
  const [subject, setSubject] = useState(defaults.subject);
  const [candidates, setCandidates] = useState<PaperCandidate[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const matchController = useRef<AbortController | null>(null);
  const pendingSession = useRef<{ paperId: string; id: string } | null>(null);
  const startingRef = useRef(false);

  function invalidateMatch() {
    matchController.current?.abort();
    setCandidates([]);
    setSelectedPaperId("");
    setIsMatching(false);
    pendingSession.current = null;
    setStatus("信息已更新，请重新匹配试卷。");
  }

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    async function loadCatalog() {
      try {
        const [availableYears, availableRegions] = await Promise.all([
          fetch("/api/v1/catalog/years", { signal: controller.signal }).then(readData<CatalogYear[]>),
          fetch(`/api/v1/catalog/regions?year=${year}`, { signal: controller.signal }).then(readData<CatalogRegion[]>)
        ]);
        if (controller.signal.aborted) return;
        setYears(availableYears);
        setRegions(availableRegions);
        setRegion((current) => availableRegions.some((item) => item.region === current) ? current : availableRegions[0]?.region ?? "");
        setStatus(availableRegions.length ? "目录已就绪，请确认信息并匹配试卷。" : "这一届暂未收录可选地区，请选择其他届次。");
      } catch {
        if (!controller.signal.aborted) {
          setRegions([]);
          setStatus("目录读取失败。请检查网络后重试，不会自动替换你的试卷。");
        }
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, [year, catalogRetry]);

  useEffect(() => () => matchController.current?.abort(), []);

  async function matchPaper() {
    if (isStarting || catalogLoading || !regions.length) return;
    matchController.current?.abort();
    const controller = new AbortController();
    matchController.current = controller;
    setIsMatching(true);
    setCandidates([]);
    setSelectedPaperId("");
    pendingSession.current = null;
    setStatus("正在查找这一届的试卷…");
    try {
      const result = await fetch("/api/v1/catalog/match", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, region, track, subject, mode: "QUICK_15" })
      }).then(readData<PaperMatchResult>);
      if (controller.signal.aborted) return;
      setCandidates(result.candidates);
      const validAuto = result.candidates.find((item) => item.id === result.autoSelectedPaperId);
      setSelectedPaperId(validAuto?.id ?? result.candidates[0]?.id ?? "");
      setStatus(result.candidates.length ? "已找到候选试卷，请核对卷名与范围后进入。" : "暂未收录匹配试卷。你可以修改条件，但我们不会悄悄替换原卷。");
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "匹配失败，请重试。");
    } finally {
      if (!controller.signal.aborted) setIsMatching(false);
    }
  }

  async function startExam() {
    if (!selectedPaperId || startingRef.current || isMatching || catalogLoading) return;
    startingRef.current = true;
    setIsStarting(true);
    setStatus("正在准备你的答题记录…");
    try {
      let session = pendingSession.current;
      if (!session || session.paperId !== selectedPaperId) {
        const created = await fetch("/api/v1/exam-sessions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paper_id: selectedPaperId, mode: "QUICK_15", settings: {
            timer_mode: "STRICT", paper_style: true, exam_audio: false, ai_tutor_enabled: true
          } })
        }).then(readData<{ id: string }>);
        session = { paperId: selectedPaperId, id: created.id };
        pendingSession.current = session;
      }
      setStatus("正在开启本次考试…");
      const started = await fetch(`/api/v1/exam-sessions/${session.id}/start`, { method: "POST" });
      if (!started.ok) throw new Error("开考未成功，请重试。已创建的会话会继续使用。");
      router.push(`/exam/${session.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "暂时无法进入，请检查网络后重试。");
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  }

  return (
    <main className="examShell">
      <header className="topbar"><Link href="/">高考新生</Link><span>考生登记处 / 01</span></header>
      <section className="examEntry">
        <div><p className="eyebrow">翻开那一年的试卷</p><h1>你是哪一届<br />考生？</h1><p>选好年份与地区，让我们一起找到那张熟悉的卷子。<br />不用填写当年分数，也可以重新开始。</p><p>当前为精选题流程预览，不是正式高考。题目来源、题量与适用范围以候选卷说明为准。</p></div>
        <div className="examSetup" aria-busy={catalogLoading || isMatching || isStarting}>
          <h2>重考登记表</h2>
          <form onSubmit={(event) => { event.preventDefault(); void matchPaper(); }}>
            <div className="matchForm">
              <label><span>高考届次</span><select value={year} disabled={isStarting} onChange={(event) => { invalidateMatch(); setYear(Number(event.target.value)); }}>
                {!years.length ? <option value={year}>{year}届</option> : null}
                {years.map((item) => <option key={item.year} value={item.year}>{item.label} · 距今{item.yearsAgo}年</option>)}
              </select></label>
              <label><span>考试地区</span><select value={region} disabled={catalogLoading || isStarting || !regions.length} onChange={(event) => { invalidateMatch(); setRegion(event.target.value); }}>
                {!regions.length ? <option value={region}>{catalogLoading ? "正在读取…" : "暂无可选地区"}</option> : null}
                {regions.map((item) => <option key={`${item.year}-${item.regionCode}`} value={item.region}>{item.region}</option>)}
              </select></label>
              <label><span>当年科类</span><select value={track} disabled={isStarting} onChange={(event) => { invalidateMatch(); setTrack(event.target.value); }}><option value="理科">理科</option></select></label>
              <label><span>重考科目</span><select value={subject} disabled={isStarting} onChange={(event) => { invalidateMatch(); setSubject(event.target.value); }}><option value="数学">数学</option></select></label>
            </div>
            <button type="submit" className="secondaryButton wideButton" disabled={isStarting || isMatching || catalogLoading || !regions.length}>{isMatching ? "正在查找试卷…" : "查找这张试卷"}</button>
          </form>
          {!catalogLoading && !regions.length ? <button type="button" className="secondaryButton wideButton" disabled={isStarting} onClick={() => { invalidateMatch(); setCatalogRetry((value) => value + 1); }}>重新读取目录</button> : null}
          <div className="candidateList" aria-label="候选试卷">
            {candidates.map((candidate) => <button type="button" className={candidate.id === selectedPaperId ? "candidateButton selected" : "candidateButton"} key={candidate.id} aria-pressed={candidate.id === selectedPaperId} disabled={isStarting} onClick={() => { pendingSession.current = null; setSelectedPaperId(candidate.id); }}>
              <strong>{candidate.title}</strong><span>{candidate.year}届 · {candidate.region} · {candidate.track} · {candidate.questionCount}题</span><small>{candidate.explanation}</small>
            </button>)}
          </div>
          <button type="button" className="primaryButton wideButton" disabled={!selectedPaperId || isStarting || isMatching || catalogLoading} onClick={() => void startExam()}>{isStarting ? "正在进入考场…" : "确认试卷，开始作答 →"}</button>
          <p className="saveStatus" role="status" aria-live="polite">{status}</p>
          <p className="saveStatus">本次为计时精选体验；声音默认关闭。AI估分仅供参考，不代表当年成绩或个人能力评级。</p>
        </div>
      </section>
    </main>
  );
}

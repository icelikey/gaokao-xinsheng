"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDefaultPaperMatchInput, type CatalogRegion, type CatalogYear, type PaperCandidate } from "@gaokao-xinsheng/contracts";

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type CreatedSession = {
  id: string;
};

type PaperMatchResult = {
  candidates: PaperCandidate[];
  autoSelectedPaperId: string | null;
};

const defaultMatchInput = getDefaultPaperMatchInput();

export default function ExamEntryPage() {
  const router = useRouter();
  const [status, setStatus] = useState("正在读取可选届次...");
  const [isStarting, setIsStarting] = useState(false);
  const [years, setYears] = useState<CatalogYear[]>([]);
  const [regions, setRegions] = useState<CatalogRegion[]>([]);
  const [year, setYear] = useState(defaultMatchInput.year);
  const [region, setRegion] = useState(defaultMatchInput.region);
  const [track, setTrack] = useState(defaultMatchInput.track);
  const [subject, setSubject] = useState(defaultMatchInput.subject);
  const [candidates, setCandidates] = useState<PaperCandidate[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");

  useEffect(() => {
    async function loadCatalog() {
      const [yearResponse, regionResponse] = await Promise.all([
        fetch("/api/v1/catalog/years"),
        fetch(`/api/v1/catalog/regions?year=${year}`)
      ]);
      const yearPayload = (await yearResponse.json()) as ApiResponse<CatalogYear[]>;
      const regionPayload = (await regionResponse.json()) as ApiResponse<CatalogRegion[]>;

      setYears(yearPayload.data ?? []);
      setRegions(regionPayload.data ?? []);
      setStatus("请选择届次信息并匹配试卷。");
    }

    void loadCatalog();
  }, [year]);

  async function matchPaper() {
    setStatus("正在匹配候选试卷...");
    const response = await fetch("/api/v1/catalog/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        region,
        track,
        subject,
        mode: "QUICK_15"
      })
    });
    const payload = (await response.json()) as ApiResponse<PaperMatchResult>;

    if (!payload.data || payload.data.candidates.length === 0) {
      setCandidates([]);
      setSelectedPaperId("");
      setStatus(payload.error?.message ?? "暂未匹配到试卷。");
      return;
    }

    setCandidates(payload.data.candidates);
    setSelectedPaperId(payload.data.autoSelectedPaperId ?? payload.data.candidates[0].id);
    setStatus(
      payload.data.autoSelectedPaperId
        ? "已自动匹配到高置信候选卷。"
        : "已匹配到候选卷，请确认后开考。"
    );
  }

  async function startExam() {
    if (!selectedPaperId) {
      await matchPaper();
      return;
    }

    setIsStarting(true);
    setStatus("正在创建会话...");

    const createResponse = await fetch("/api/v1/exam-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper_id: selectedPaperId,
        mode: "QUICK_15",
        settings: {
          timer_mode: "STRICT",
          paper_style: true,
          exam_audio: false,
          ai_tutor_enabled: true
        }
      })
    });
    const created = (await createResponse.json()) as ApiResponse<CreatedSession>;

    if (!created.data) {
      setStatus(created.error?.message ?? "创建失败");
      setIsStarting(false);
      return;
    }

    setStatus("正在开始计时...");
    await fetch(`/api/v1/exam-sessions/${created.data.id}/start`, {
      method: "POST"
    });

    router.push(`/exam/${created.data.id}`);
  }

  return (
    <main className="examShell">
      <header className="topbar">
        <Link href="/">高考新生</Link>
        <span>考试流程预览</span>
      </header>

      <section className="examEntry">
        <div>
          <p className="eyebrow">M3 Exam Flow</p>
          <h1>选择届次，匹配当年的数学卷</h1>
          <p>
            当前预览使用目录匹配API和30题MVP精选卷，验证届次选择、候选卷确认、创建会话、保存答案、AI提示和交卷报告。
          </p>
        </div>

        <div className="examSetup">
          <h2>高考信息</h2>
          <div className="matchForm">
            <label>
              <span>届次</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.length === 0 ? <option value={year}>{year}届</option> : null}
                {years.map((item) => (
                  <option key={item.year} value={item.year}>
                    {item.label} · 距今{item.yearsAgo}年
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>地区</span>
              <select value={region} onChange={(event) => setRegion(event.target.value)}>
                {regions.length === 0 ? <option value={region}>{region}</option> : null}
                {regions.map((item) => (
                  <option key={`${item.year}-${item.regionCode}`} value={item.region}>
                    {item.region}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>科类</span>
              <select value={track} onChange={(event) => setTrack(event.target.value)}>
                <option value="理科">理科</option>
              </select>
            </label>
            <label>
              <span>科目</span>
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="数学">数学</option>
              </select>
            </label>
          </div>
          <button className="secondaryButton wideButton" disabled={isStarting} onClick={() => void matchPaper()}>
            匹配试卷
          </button>

          <div className="candidateList" aria-label="候选试卷">
            {candidates.map((candidate) => (
              <button
                className={candidate.id === selectedPaperId ? "candidateButton selected" : "candidateButton"}
                key={candidate.id}
                onClick={() => setSelectedPaperId(candidate.id)}
              >
                <strong>{candidate.title}</strong>
                <span>
                  {candidate.year}届 · {candidate.region} · {candidate.track} · {candidate.questionCount}题
                </span>
                <small>匹配置信度 {Math.round(candidate.confidence * 100)}% · {candidate.explanation}</small>
              </button>
            ))}
          </div>

          <button className="primaryButton" disabled={isStarting} onClick={startExam}>
            {isStarting ? "正在进入考场" : "开始重新高考"}
          </button>
          <p className="saveStatus">{status}</p>
        </div>
      </section>
    </main>
  );
}

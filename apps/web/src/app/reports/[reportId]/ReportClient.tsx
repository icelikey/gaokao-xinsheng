"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type ReportQuestion = {
  questionId: string;
  orderNo: number;
  stem: string;
  userAnswer: { value: string | string[] } | null;
  correctAnswer: string;
  independentScore: number;
  collaborativeScore: number;
  score: number;
  maxScore: number;
  confidence: string;
  requiresReview: boolean;
  evidence: string;
};

type Report = {
  id: string;
  gradingJobId: string;
  independentScore: number;
  collaborativeScore: number;
  totalScore: number;
  aiHelpCount: number;
  lowConfidenceCount: number;
  reviewCount: number;
  questions: ReportQuestion[];
};

type ShareVisibility = {
  showIndependentScore: boolean;
  showCollaborativeScore: boolean;
  showPaperTitle: boolean;
  showRegion: boolean;
};

type ShareCard = {
  token: string;
  publicFields: {
    title: string;
    paperTitle: string | null;
    region: string | null;
    independentScore: number | null;
    collaborativeScore: number | null;
    totalScore: number | null;
    aiHelpCount: number;
    reviewCount: number;
    disclaimer: string;
    visibility: ShareVisibility;
  };
};

const defaultShareVisibility: ShareVisibility = {
  showIndependentScore: true,
  showCollaborativeScore: true,
  showPaperTitle: false,
  showRegion: false
};

const shareVisibilityOptions: Array<{
  field: keyof ShareVisibility;
  label: string;
}> = [
  { field: "showIndependentScore", label: "独立分" },
  { field: "showCollaborativeScore", label: "AI协作分" },
  { field: "showPaperTitle", label: "试卷名" },
  { field: "showRegion", label: "地区" }
];

function shareVisibilityKey(visibility: ShareVisibility) {
  return Object.entries(visibility)
    .map(([key, value]) => `${key}:${value ? 1 : 0}`)
    .join("-");
}

function renderAnswer(answer: ReportQuestion["userAnswer"]) {
  if (!answer) {
    return "未作答";
  }

  return Array.isArray(answer.value) ? answer.value.join(",") : answer.value || "空答案";
}

export function ReportClient({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState("正在生成报告...");
  const [shareCard, setShareCard] = useState<ShareCard | null>(null);
  const [shareStatus, setShareStatus] = useState("分享卡尚未生成。");
  const [shareVisibility, setShareVisibility] = useState<ShareVisibility>(defaultShareVisibility);

  useEffect(() => {
    async function loadReport() {
      const response = await fetch(`/api/v1/reports/${reportId}`);
      const payload = (await response.json()) as ApiResponse<Report>;

      if (!payload.data) {
        setStatus(payload.error?.message ?? "报告不存在");
        return;
      }

      setReport(payload.data);
      setStatus("AI估分报告已生成。");
    }

    void loadReport();
  }, [reportId]);

  async function generateShareCard() {
    setShareStatus("正在生成分享卡...");
    const visibilityKey = shareVisibilityKey(shareVisibility);
    const response = await fetch(`/api/v1/reports/${reportId}/share-cards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `share-${reportId}-${visibilityKey}`
      },
      body: JSON.stringify({
        visibility: shareVisibility
      })
    });
    const payload = (await response.json()) as ApiResponse<ShareCard>;

    if (!payload.data) {
      setShareStatus(payload.error?.message ?? "分享卡生成失败");
      return;
    }

    setShareCard(payload.data);
    setShareStatus("分享卡已生成，可打开公开分享页。");
  }

  function toggleShareVisibility(field: keyof ShareVisibility) {
    setShareVisibility((current) => ({
      ...current,
      [field]: !current[field]
    }));
    setShareCard(null);
  }

  if (!report) {
    return (
      <main className="adminPage">
        <p>{status}</p>
        <Link className="primaryButton" href="/exam">
          重新开始
        </Link>
      </main>
    );
  }

  return (
    <main className="adminPage">
      <header className="topbar">
        <Link href="/exam">重新作答</Link>
        <span>AI估分报告</span>
      </header>

      <section className="reportHero">
        <p className="eyebrow">Report</p>
        <h1>这是一份今天的重新交卷记录</h1>
        <p>{status} 结果为MVP规则估分，不等同于官方高考成绩。</p>
        <div className="scorePair reportScores">
          <div>
            <span>独立作答分</span>
            <strong>{report.independentScore}</strong>
            <small>/{report.totalScore}</small>
          </div>
          <div>
            <span>AI协作分</span>
            <strong>{report.collaborativeScore}</strong>
            <small>/{report.totalScore}</small>
          </div>
          <div>
            <span>AI提示次数</span>
            <strong>{report.aiHelpCount}</strong>
            <small>次</small>
          </div>
          <div>
            <span>需复核题数</span>
            <strong>{report.reviewCount}</strong>
            <small>题</small>
          </div>
        </div>
        <p className="saveStatus">
          批改任务：{report.gradingJobId} · 低置信度：{report.lowConfidenceCount}
        </p>
        <div className="visibilityControls" aria-label="分享公开字段">
          {shareVisibilityOptions.map((option) => (
            <label className="visibilityToggle" key={option.field}>
              <input
                type="checkbox"
                checked={shareVisibility[option.field]}
                onChange={() => toggleShareVisibility(option.field)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className="reportActions">
          <Link className="secondaryButton" href={`/reports/${report.id}/mistakes`}>
            查看错题回看
          </Link>
          <button className="primaryButton" onClick={() => void generateShareCard()}>
            生成分享卡
          </button>
          {shareCard ? (
            <Link className="secondaryButton darkButton" href={`/share/${shareCard.token}`}>
              打开公开分享页
            </Link>
          ) : null}
        </div>
        <p className="saveStatus">{shareStatus}</p>
      </section>

      <section className="questionTable" aria-label="逐题批改详情">
        <div className="questionTableHeader reportHeader">
          <span>题号</span>
          <span>独立 / 协作</span>
          <span>作答 / 标准答案</span>
          <span>评分依据 / 置信度</span>
        </div>
        {report.questions.map((question) => (
          <article className="questionRow reportRow" key={question.questionId}>
            <strong>{question.orderNo}</strong>
            <span>
              {question.independentScore}/{question.collaborativeScore}/{question.maxScore}
            </span>
            <p>
              作答：{renderAnswer(question.userAnswer)}
              <br />
              标准：{question.correctAnswer}
            </p>
            <div>
              <small>
                {question.evidence}
                <br />
                置信度：{question.confidence} · {question.requiresReview ? "需要复核" : "无需复核"}
              </small>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

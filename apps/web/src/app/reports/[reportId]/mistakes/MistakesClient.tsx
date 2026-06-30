"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function renderAnswer(answer: ReportQuestion["userAnswer"]) {
  if (!answer) {
    return "未作答";
  }

  return Array.isArray(answer.value) ? answer.value.join(",") : answer.value || "空答案";
}

function isMistake(question: ReportQuestion) {
  return question.score < question.maxScore || question.requiresReview;
}

export function MistakesClient({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState("正在读取错题回看...");

  useEffect(() => {
    async function loadReport() {
      const response = await fetch(`/api/v1/reports/${reportId}`);
      const payload = (await response.json()) as ApiResponse<Report>;

      if (!payload.data) {
        setStatus(payload.error?.message ?? "报告不存在");
        return;
      }

      setReport(payload.data);
      setStatus("错题回看已生成。");
    }

    void loadReport();
  }, [reportId]);

  const mistakes = useMemo(() => report?.questions.filter(isMistake) ?? [], [report]);

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
        <Link href={`/reports/${report.id}`}>返回成绩单</Link>
        <span>错题回看</span>
      </header>

      <section className="reportHero mistakesHero">
        <p className="eyebrow">Mistakes</p>
        <h1>把这次没拿稳的题重新看一遍</h1>
        <p>
          {status} 本页只整理本次作答的未满分题与待复核题，不展示模型内部思维链。
        </p>
        <div className="scorePair reportScores">
          <div>
            <span>错题/待复核</span>
            <strong>{mistakes.length}</strong>
            <small>/{report.questions.length}</small>
          </div>
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
            <span>需复核题数</span>
            <strong>{report.reviewCount}</strong>
            <small>题</small>
          </div>
        </div>
      </section>

      <section className="questionTable" aria-label="错题与待复核详情">
        {mistakes.length === 0 ? (
          <article className="emptyState">
            <h2>本次没有错题或待复核题</h2>
            <p>这只是本次 MVP 规则下的结果，不等同于官方高考成绩。</p>
          </article>
        ) : (
          mistakes.map((question) => (
            <article className="mistakeCard" key={question.questionId}>
              <div className="mistakeCardHeader">
                <strong>第 {question.orderNo} 题</strong>
                <span>
                  协作得分 {question.score}/{question.maxScore} · 独立得分 {question.independentScore}
                </span>
              </div>
              <h2>{question.stem}</h2>
              <dl className="mistakeDetailGrid">
                <div>
                  <dt>本次作答</dt>
                  <dd>{renderAnswer(question.userAnswer)}</dd>
                </div>
                <div>
                  <dt>参考答案</dt>
                  <dd>{question.correctAnswer}</dd>
                </div>
                <div>
                  <dt>评分依据</dt>
                  <dd>{question.evidence}</dd>
                </div>
                <div>
                  <dt>复核状态</dt>
                  <dd>
                    {question.requiresReview ? "需要复核" : "无需复核"} · 置信度 {question.confidence}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

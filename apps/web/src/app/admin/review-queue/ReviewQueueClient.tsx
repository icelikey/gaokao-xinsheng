"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type ReviewQueueItem = {
  gradingJobId: string;
  reportId: string;
  sessionId: string;
  reviewStatus: "OPEN" | "ASSIGNED" | "RESOLVED" | "REJECTED";
  assignee: string | null;
  reviewerNote: string | null;
  auditCount: number;
  reviewCount: number;
  lowConfidenceCount: number;
  collaborativeScore: number;
  totalScore: number;
  createdAt: string;
  updatedAt: string;
};

type ReportQuestion = {
  questionId: string;
  maxScore: number;
  score: number;
  requiresReview: boolean;
};

type ExamReport = {
  id: string;
  collaborativeScore: number;
  questions: ReportQuestion[];
};

async function loadReviewQueue() {
  const response = await fetch("/api/v1/admin/review-queue");
  const payload = (await response.json()) as ApiResponse<ReviewQueueItem[]>;

  if (!payload.data) {
    throw new Error(payload.error?.message ?? "复核队列读取失败");
  }

  return payload.data;
}

async function loadReport(reportId: string) {
  const response = await fetch(`/api/v1/reports/${reportId}`);
  const payload = (await response.json()) as ApiResponse<ExamReport>;

  if (!payload.data) {
    throw new Error(payload.error?.message ?? "报告读取失败");
  }

  return payload.data;
}

export function ReviewQueueClient() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [status, setStatus] = useState("正在读取复核队列...");
  const [actionStatus, setActionStatus] = useState("尚未执行复核动作。");

  useEffect(() => {
    async function loadQueue() {
      try {
        const nextItems = await loadReviewQueue();
        setItems(nextItems);
        setStatus(nextItems.length > 0 ? "以下报告需要人工复核。" : "当前没有需要复核的报告。");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "复核队列读取失败");
        return;
      }
    }

    void loadQueue();
  }, []);

  async function runReviewAction(item: ReviewQueueItem, action: "ASSIGN" | "RESOLVE" | "REJECT") {
    setActionStatus("正在写入复核动作...");
    const response = await fetch(`/api/v1/admin/review-queue/${item.reportId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        actor: "local-reviewer",
        note: `${action.toLowerCase()} from local admin preview`
      })
    });
    const payload = (await response.json()) as ApiResponse<{
      auditLog: {
        action: string;
        afterStatus: string;
        createdAt: string;
      };
    }>;

    if (!payload.data) {
      setActionStatus(payload.error?.message ?? "复核动作写入失败");
      return;
    }

    const nextItems = await loadReviewQueue();
    setItems(nextItems);
    setStatus(nextItems.length > 0 ? "以下报告需要人工复核。" : "当前没有需要复核的报告。");
    setActionStatus(`已写入 ${payload.data.auditLog.action}，状态 ${payload.data.auditLog.afterStatus}。`);
  }

  async function runScoreAdjustment(item: ReviewQueueItem) {
    setActionStatus("正在写入人工调分...");

    try {
      const report = await loadReport(item.reportId);
      const targetQuestion = report.questions.find((question) => question.requiresReview) ?? report.questions[0];

      if (!targetQuestion) {
        setActionStatus("报告里没有可调分题目");
        return;
      }

      const response = await fetch(`/api/v1/admin/review-queue/${item.reportId}/score-adjustments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          questionId: targetQuestion.questionId,
          score: targetQuestion.maxScore,
          actor: "local-reviewer",
          reason: "local admin preview calibration"
        })
      });
      const payload = (await response.json()) as ApiResponse<{
        auditLog: {
          action: string;
          questionId: string;
          beforeScore: number;
          afterScore: number;
        };
      }>;

      if (!payload.data) {
        setActionStatus(payload.error?.message ?? "人工调分失败");
        return;
      }

      const nextItems = await loadReviewQueue();
      setItems(nextItems);
      setActionStatus(
        `已调分 ${payload.data.auditLog.questionId}：${payload.data.auditLog.beforeScore} -> ${payload.data.auditLog.afterScore}`
      );
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "人工调分失败");
    }
  }

  return (
    <main className="adminPage">
      <header className="topbar">
        <Link href="/admin">运营后台</Link>
        <span>AI复核队列</span>
      </header>

      <section className="paperHeader">
        <div>
          <p className="eyebrow">Review Queue</p>
          <h1>低置信度与主观题复核</h1>
          <p>{status}</p>
          <p className="saveStatus">{actionStatus}</p>
        </div>
        <Link className="secondaryButton darkButton" href="/api/v1/admin/review-queue">
          查看JSON
        </Link>
      </section>

      <section className="paperList">
        {items.map((item) => (
          <article className="paperRow" key={item.gradingJobId}>
            <div>
              <h2 className="reviewTaskTitle">批改任务 {item.gradingJobId}</h2>
              <p>
                分数：{item.collaborativeScore}/{item.totalScore} · 需复核：{item.reviewCount} · 低置信度：
                {item.lowConfidenceCount}
              </p>
              <p>
                状态：{item.reviewStatus} · 负责人：{item.assignee ?? "未认领"} · 审计：{item.auditCount}
              </p>
              <p>会话：{item.sessionId}</p>
            </div>
            <div className="reviewActions">
              <Link href={`/reports/${item.reportId}`}>打开报告</Link>
              <button type="button" onClick={() => void runReviewAction(item, "ASSIGN")}>
                认领
              </button>
              <button type="button" onClick={() => void runScoreAdjustment(item)}>
                人工调分
              </button>
              <button type="button" onClick={() => void runReviewAction(item, "RESOLVE")}>
                通过
              </button>
              <button type="button" onClick={() => void runReviewAction(item, "REJECT")}>
                退回
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

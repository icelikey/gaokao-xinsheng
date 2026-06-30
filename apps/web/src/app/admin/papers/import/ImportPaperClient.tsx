"use client";

import { useState } from "react";
import type { PaperImportPayload } from "@gaokao-xinsheng/contracts";

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type PaperImportBatch = {
  id: string;
  paperId: string;
  title: string;
  dryRun: boolean;
  conflictPolicy: "replace_preview";
  actor: string;
  status: "VALIDATED" | "REJECTED" | "IMPORTED";
  payloadHash: string;
  summary: {
    questionCount: number;
    totalScore: number;
    maxScoreSum: number;
    answerKeyCount: number;
    rubricQuestionCount: number;
    byType: {
      single_choice: number;
      multiple_choice: number;
      fill_blank: number;
      free_response: number;
    };
  };
  commitSummary: {
    committed: boolean;
    conflictPolicy: "replace_preview";
    paperRows: number;
    sectionRows: number;
    questionRows: number;
    answerKeyRows: number;
    rubricRows: number;
  };
  issues: Array<{
    code: string;
    severity: "error" | "warning";
    message: string;
    questionId?: string;
  }>;
  auditAction: string;
  createdAt: string;
};

async function runPaperImport(samplePaper: PaperImportPayload, dryRun: boolean) {
  const response = await fetch("/api/v1/admin/paper-imports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dryRun,
      conflictPolicy: "replace_preview",
      actor: "local-importer",
      paper: samplePaper
    })
  });
  const payload = (await response.json()) as ApiResponse<PaperImportBatch>;

  if (!payload.data) {
      throw new Error(payload.error?.message ?? "题库导入失败");
  }

  return payload.data;
}

export function ImportPaperClient({ samplePaper }: { samplePaper: PaperImportPayload }) {
  const [batch, setBatch] = useState<PaperImportBatch | null>(null);
  const [status, setStatus] = useState("等待校验 MVP 试卷 payload。");

  async function handleImport(dryRun: boolean) {
    setStatus(dryRun ? "正在执行 dry-run 校验..." : "正在记录导入批次...");

    try {
      const nextBatch = await runPaperImport(samplePaper, dryRun);
      setBatch(nextBatch);
      setStatus(`${nextBatch.status}：${nextBatch.issues.length} 个提示，${nextBatch.summary.questionCount} 题。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "题库导入失败");
    }
  }

  return (
    <>
      <section className="adminMetricGrid">
        <div>
          <strong>{samplePaper.questions.length}</strong>
          <span>题目数</span>
        </div>
        <div>
          <strong>{samplePaper.totalScore}</strong>
          <span>卷面总分</span>
        </div>
        <div>
          <strong>{samplePaper.questions.filter((question) => question.answer.trim()).length}</strong>
          <span>答案键</span>
        </div>
        <div>
          <strong>{samplePaper.questions.filter((question) => question.rubric?.length).length}</strong>
          <span>rubric题数</span>
        </div>
      </section>

      <section className="paperList">
        <article className="paperRow importPanel">
          <div>
            <h2>{samplePaper.title}</h2>
            <p>
              {samplePaper.paperType} / {samplePaper.status ?? "DRAFT"} / {samplePaper.durationMinutes} 分钟
            </p>
            <p className="saveStatus">{status}</p>
          </div>
          <div className="reviewActions">
            <button type="button" onClick={() => void handleImport(true)}>
              校验演练
            </button>
            <button type="button" onClick={() => void handleImport(false)}>
              记录批次
            </button>
          </div>
        </article>
      </section>

      {batch ? (
        <section className="importResult">
          <div className="importResultGrid">
            <div>
              <span>状态</span>
              <strong>{batch.status}</strong>
            </div>
            <div>
              <span>题目分值合计</span>
              <strong>{batch.summary.maxScoreSum}</strong>
            </div>
            <div>
              <span>Rubric题数</span>
              <strong>{batch.summary.rubricQuestionCount}</strong>
            </div>
            <div>
              <span>审计动作</span>
              <strong>{batch.auditAction}</strong>
            </div>
            <div>
              <span>提交行数</span>
              <strong>{batch.commitSummary.questionRows}</strong>
            </div>
          </div>

          <article className="paperRow importPanel">
            <div>
              <h2>批次 {batch.id}</h2>
              <p>
                操作人：{batch.actor} / Dry run：{String(batch.dryRun)} / 创建时间：{batch.createdAt}
              </p>
              <p>
                冲突策略：{batch.conflictPolicy} / 已提交：{String(batch.commitSummary.committed)}
              </p>
              <p>Payload hash：{batch.payloadHash}</p>
            </div>
          </article>

          <section className="paperList">
            {batch.issues.length === 0 ? (
              <article className="paperRow">
                <div>
                  <h2>无阻断问题</h2>
                  <p>该 payload 已通过本地导入合同。</p>
                </div>
              </article>
            ) : (
              batch.issues.map((issue) => (
                <article className="paperRow" key={`${issue.code}-${issue.questionId ?? "paper"}`}>
                  <div>
                    <h2>{issue.code}</h2>
                    <p>
                      {issue.severity} / {issue.questionId ?? "paper"} / {issue.message}
                    </p>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
      ) : null}
    </>
  );
}

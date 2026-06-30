"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type AnswerPayload,
  type MvpQuestion,
  mvpPaper
} from "@gaokao-xinsheng/contracts";

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type AnswerVersion = {
  answer: AnswerPayload;
};

type ExamSession = {
  id: string;
  state: string;
  serverVersion: number;
  deadlineAt: string | null;
  reportId: string | null;
  answers: Record<string, AnswerVersion[]>;
};

type AiHelpResponse = {
  event: {
    message: string;
    level: number;
  };
  preAiAnswerVersionId: string | null;
};

type Report = {
  id: string;
};

const typeLabel = {
  single_choice: "选择题",
  fill_blank: "填空题",
  free_response: "解答题"
} as const;

function toPayload(question: MvpQuestion, value: string): AnswerPayload {
  if (question.type === "single_choice") {
    return {
      type: "single_choice",
      value
    };
  }

  return {
    type: question.type,
    value
  } as AnswerPayload;
}

function answerToText(answer: AnswerPayload | undefined) {
  if (!answer) {
    return "";
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(",");
  }

  return String(answer.value);
}

export function ExamClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [clientVersion, setClientVersion] = useState(1);
  const [saveStatus, setSaveStatus] = useState("正在恢复考试...");
  const [aiHint, setAiHint] = useState<string>("还没有请求AI提示。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = mvpPaper.questions[currentIndex];
  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim().length > 0).length,
    [answers]
  );

  useEffect(() => {
    async function restoreSession() {
      const response = await fetch(`/api/v1/exam-sessions/${sessionId}`);
      const payload = (await response.json()) as ApiResponse<ExamSession>;

      if (!payload.data) {
        setSaveStatus(payload.error?.message ?? "无法恢复考试");
        return;
      }

      const restoredAnswers = Object.fromEntries(
        Object.entries(payload.data.answers).map(([questionId, versions]) => [
          questionId,
          answerToText(versions.at(-1)?.answer)
        ])
      );

      setSession(payload.data);
      setAnswers(restoredAnswers);
      setSaveStatus("恢复成功，可以继续作答。");
    }

    void restoreSession();
  }, [sessionId]);

  async function saveCurrentAnswer(question = currentQuestion) {
    const value = answers[question.id] ?? "";
    const response = await fetch(`/api/v1/exam-sessions/${sessionId}/answers/${question.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_version: clientVersion,
        base_server_version: session?.serverVersion ?? 0,
        answer: toPayload(question, value),
        client_saved_at: new Date().toISOString()
      })
    });
    const payload = (await response.json()) as ApiResponse<{ session: ExamSession }>;

    if (!payload.data) {
      setSaveStatus(payload.error?.message ?? "保存失败");
      return false;
    }

    setClientVersion((version) => version + 1);
    setSession(payload.data.session);
    setSaveStatus(`自动保存成功：第${question.orderNo}题`);
    return true;
  }

  async function requestHint(level: number) {
    await saveCurrentAnswer();
    const response = await fetch(`/api/v1/exam-sessions/${sessionId}/ai-help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: currentQuestion.id,
        level
      })
    });
    const payload = (await response.json()) as ApiResponse<AiHelpResponse>;

    if (!payload.data) {
      setAiHint(payload.error?.message ?? "AI提示失败");
      return;
    }

    setAiHint(
      `L${payload.data.event.level}：${payload.data.event.message}（pre_ai版本：${payload.data.preAiAnswerVersionId ?? "空答案快照"}）`
    );
  }

  async function submitExam() {
    setIsSubmitting(true);
    await saveCurrentAnswer();
    const response = await fetch(`/api/v1/exam-sessions/${sessionId}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `submit-${sessionId}`
      },
      body: JSON.stringify({
        confirm_unanswered: true,
        last_known_server_version: session?.serverVersion ?? 0
      })
    });
    const payload = (await response.json()) as ApiResponse<Report>;

    if (!payload.data) {
      setSaveStatus(payload.error?.message ?? "交卷失败");
      setIsSubmitting(false);
      return;
    }

    router.push(`/reports/${payload.data.id}`);
  }

  return (
    <main className="examShell">
      <header className="topbar">
        <Link href="/exam">考前准备</Link>
        <span>{session?.state ?? "RESTORING"}</span>
      </header>

      <section className="examWorkspace">
        <aside className="answerCardPanel">
          <p className="eyebrow">Answer Card</p>
          <h2>{answeredCount}/{mvpPaper.questions.length}</h2>
          <div className="answerGrid">
            {mvpPaper.questions.map((question, index) => (
              <button
                className={answers[question.id] ? "answered" : ""}
                key={question.id}
                onClick={() => setCurrentIndex(index)}
              >
                {question.orderNo}
              </button>
            ))}
          </div>
          <button className="primaryButton submitButton" disabled={isSubmitting} onClick={submitExam}>
            {isSubmitting ? "正在交卷" : "交卷并生成AI估分"}
          </button>
          <p className="saveStatus">{saveStatus}</p>
        </aside>

        <section className="questionPanel">
          <div className="questionMeta">
            <span>{typeLabel[currentQuestion.type]}</span>
            <span>第 {currentQuestion.orderNo} 题</span>
            <span>{currentQuestion.maxScore} 分</span>
          </div>
          <h1>{currentQuestion.stem}</h1>

          {currentQuestion.type === "single_choice" ? (
            <div className="choiceGroup">
              {currentQuestion.options?.map((option) => (
                <button
                  className={answers[currentQuestion.id] === option ? "selected" : ""}
                  key={option}
                  onClick={() =>
                    setAnswers((current) => ({
                      ...current,
                      [currentQuestion.id]: option
                    }))
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[currentQuestion.id] ?? ""}
              onBlur={() => void saveCurrentAnswer()}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [currentQuestion.id]: event.target.value
                }))
              }
              placeholder="在这里输入你的答案"
            />
          )}

          <div className="examActions">
            <button className="secondaryButton darkButton" onClick={() => void saveCurrentAnswer()}>
              保存答案
            </button>
            <button
              className="secondaryButton darkButton"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            >
              上一题
            </button>
            <button
              className="primaryButton"
              disabled={currentIndex === mvpPaper.questions.length - 1}
              onClick={() => setCurrentIndex((index) => Math.min(mvpPaper.questions.length - 1, index + 1))}
            >
              下一题
            </button>
          </div>

          <section className="aiPanel">
            <div>
              <p className="eyebrow">AI Tutor</p>
              <h2>AI辅导面板</h2>
            </div>
            <div className="hintButtons">
              {[1, 2, 3, 4].map((level) => (
                <button key={level} onClick={() => void requestHint(level)}>
                  L{level}
                </button>
              ))}
            </div>
            <p>{aiHint}</p>
          </section>
        </section>
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getMvpPaper, getMvpQuestionStats } from "@gaokao-xinsheng/contracts";

type PaperPreviewPageProps = {
  params: Promise<{
    paperId: string;
  }>;
};

const questionTypeLabel = {
  single_choice: "选择题",
  fill_blank: "填空题",
  free_response: "解答题"
} as const;

export default async function PaperPreviewPage({ params }: PaperPreviewPageProps) {
  const { paperId } = await params;
  const paper = getMvpPaper(paperId);

  if (!paper) {
    notFound();
  }

  const stats = getMvpQuestionStats(paper);

  return (
    <main className="adminPage">
      <header className="topbar">
        <Link href="/admin/papers">题库预览</Link>
        <span>{paper.status}</span>
      </header>

      <section className="paperHeader">
        <div>
          <p className="eyebrow">Question Preview</p>
          <h1>{paper.title}</h1>
          <p>
            {stats.total}题 · {stats.maxScore}分 ·{" "}
            {paper.durationMinutes}分钟 · rubric版本预览
          </p>
        </div>
        <Link className="secondaryButton darkButton" href={`/api/catalog/papers/${paper.id}`}>
          查看JSON
        </Link>
      </section>

      <section className="questionTable" aria-label="题目预览">
        <div className="questionTableHeader">
          <span>题号</span>
          <span>题型</span>
          <span>题干</span>
          <span>答案 / Rubric</span>
        </div>
        {paper.questions.map((question) => (
          <article className="questionRow" key={question.id}>
            <strong>{question.orderNo}</strong>
            <span>{questionTypeLabel[question.type]}</span>
            <p>{question.stem}</p>
            <div>
              <b>{question.answer}</b>
              {question.rubric ? (
                <small>
                  {question.rubric.map((item) => `${item.name}${item.score}分`).join("；")}
                </small>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

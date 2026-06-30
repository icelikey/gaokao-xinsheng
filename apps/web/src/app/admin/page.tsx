import Link from "next/link";
import { getMvpQuestionStats, mvpPaper } from "@gaokao-xinsheng/contracts";

const modules = [
  ["题库导入", "批量导入30到50道数学样题，支持题干block结构。"],
  ["Rubric审核", "维护答案、得分点、容错规则和不可变版本。"],
  ["AI复核队列", "查看低置信度评分、重评申请和人工抽检。"],
  ["Prompt版本", "管理辅导、评分、报告模型的Prompt上线状态。"]
] as const;

export default function AdminPage() {
  const stats = getMvpQuestionStats(mvpPaper);

  return (
    <main className="adminPage">
      <header className="topbar">
        <Link href="/">高考新生</Link>
        <span>运营后台预览</span>
      </header>

      <section className="adminHero">
        <p className="eyebrow">Operations</p>
        <h1>先让题库、评分规则和AI复核可管理</h1>
        <p>
          后台的第一目标不是复杂权限，而是让30到50道数学题能被导入、审核、校准和预览。
        </p>
        <div className="heroActions adminActions">
          <Link className="primaryButton" href="/admin/papers">
            查看MVP题库
          </Link>
          <Link className="secondaryButton darkButton" href="/admin/papers/import">
            题库导入演练
          </Link>
          <Link className="secondaryButton darkButton" href="/api/catalog/papers">
            查看只读API
          </Link>
          <Link className="secondaryButton darkButton" href="/admin/review-queue">
            查看复核队列
          </Link>
        </div>
      </section>

      <section className="adminMetricGrid">
        <div>
          <strong>{stats.total}</strong>
          <span>题目数</span>
        </div>
        <div>
          <strong>{stats.byType.single_choice}</strong>
          <span>选择题</span>
        </div>
        <div>
          <strong>{stats.byType.fill_blank}</strong>
          <span>填空题</span>
        </div>
        <div>
          <strong>{stats.byType.free_response}</strong>
          <span>解答题</span>
        </div>
      </section>

      <section className="moduleGrid">
        {modules.map(([title, detail]) => (
          <article className="moduleCard" key={title}>
            <h2>{title}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

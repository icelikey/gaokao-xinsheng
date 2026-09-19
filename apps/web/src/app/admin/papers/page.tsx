import Link from "next/link";
import { getMvpQuestionStats, mvpPaper } from "@gaokao-xinsheng/contracts";

export default function AdminPapersPage() {
  const stats = getMvpQuestionStats(mvpPaper);
  return (
    <main className="adminPage">
      <header className="topbar"><Link href="/admin">运营后台</Link><span>题库预览</span></header>
      <section className="paperHeader">
        <div><p className="eyebrow">Paper</p><h1>{mvpPaper.title}</h1><p>{mvpPaper.year}届 · {mvpPaper.region} · {mvpPaper.track} · {mvpPaper.subject} · {mvpPaper.durationMinutes}分钟</p></div>
        <div className="heroActions adminActions">
          <Link className="primaryButton" href={`/admin/papers/${mvpPaper.id}`}>预览题目</Link>
          <Link className="secondaryButton darkButton" href="/admin/papers/import">导入演练</Link>
          <Link className="secondaryButton darkButton" href="/admin/papers/intake">真题来源整理</Link>
          <Link className="secondaryButton darkButton" href="/admin/papers/archive">2000—2025 语数英档案</Link>
        </div>
      </section>
      <section className="adminMetricGrid">
        <div><strong>{stats.total}</strong><span>题目</span></div>
        <div><strong>{stats.maxScore}</strong><span>总分</span></div>
        <div><strong>{stats.byType.single_choice}</strong><span>选择</span></div>
        <div><strong>{stats.byType.fill_blank}</strong><span>填空</span></div>
      </section>
      <section className="paperList"><article className="paperRow"><div><h2>{mvpPaper.title}</h2><p>状态：{mvpPaper.status} · 题库ID：{mvpPaper.id}</p></div><Link href={`/admin/papers/${mvpPaper.id}`}>打开</Link></article></section>
    </main>
  );
}

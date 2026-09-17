import Link from 'next/link';
import { SourceIntakeClient } from './SourceIntakeClient';
import './intake.css';
export default function SourceIntakePage() {
  return <main className="adminPage sourceIntake">
    <header className="topbar"><Link href="/admin/papers">← 返回题库</Link><span>教务室 / 真题来源整理</span></header>
    <section className="paperHeader"><div><p className="eyebrow">原卷档案 · 来源先于答案</p><h1>让每一道题，<br/>都有来处。</h1><p>原卷、子题与参考解答分开核验。缺失就是缺失，不用AI补成“真题”。</p></div><span className="intakeStamp">待复核<br/>非发布</span></section>
    <SourceIntakeClient />
  </main>;
}

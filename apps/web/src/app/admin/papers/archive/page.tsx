import Link from 'next/link';
import ArchiveClient from './ArchiveClient';
import './archive.css';
export default function ArchivePage(){return <main className="adminPage archivePage"><header className="topbar"><Link href="/admin/papers">← 题库教务室</Link><span>高考新生 · 历年档案室</span></header><section className="archiveHeading"><p className="eyebrow">2000—2025 / 三门主科</p><h1>把那一年的试卷，<br/>好好收起来。</h1><p>按年份、科目与实际版本整理。找到来源不等于取得原卷，取得文件不等于完成核验。</p></section><ArchiveClient/></main>}

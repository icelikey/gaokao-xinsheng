'use client';
import { useRef, useState } from 'react';
import { buildQuestionDraft, buildRetrievalDraft, validateSourceIntake, isOfficialSourceUrl, type IntakeReport } from '@/lib/source-intake';
export function SourceIntakeClient() {
  const [report, setReport] = useState<IntakeReport | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState('questions');
  const generation = useRef(0);
  const paper = report?.paper;
  const question = paper?.questions[selected];
  async function readFile(file?: File) {
    const request = ++generation.current; setError(''); setReport(null); setSelected(0);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('JSON整理包不能超过5MB，原图应单独保管。'); return; }
    try { const input: unknown = JSON.parse(await file.text()); if (generation.current === request) setReport(validateSourceIntake(input)); }
    catch { if (generation.current === request) setError('无法读取JSON，请使用 source-paper/1 整理包。'); }
  }
  function save(value: unknown, suffix: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `source-intake-${suffix}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <section className="intakeUpload" aria-label="来源整理包导入">
      <div><h2>导入本机整理包</h2><p>只在浏览器中检查，不上传文件，不写题库。刷新后清空。原件和答案请保留在私有存储。</p></div>
      <label className="intakeFile">选择 JSON 文件<input aria-label="选择来源JSON" type="file" accept=".json,application/json" onChange={e => { const file=e.target.files?.[0]; e.target.value=''; void readFile(file); }}/></label>
    </section>
    <p className="intakeNotice">本期来源：<a href="https://www.eeafj.cn/systsj/20120608/2148.html" target="_blank" rel="noreferrer">福建省教育考试院 · 2012理科数学发布页 ↗</a>。第21题三选二；有一页参考解答待补。此入口不是原有30题演示卷的“导入演练”。</p>
    {error ? <p role="alert" className="intakeError">{error}</p> : null}
    {!report ? <div className="intakeEmpty"><b>先校题，再开考。</b><p>选择本次交付的 fj-2012-math-science.source.json，可查看题目首稿、来源、选考规则和缺失项。<br/>本页不内置整套授权真题，不会将答案推送到公开仓库。</p></div> : <>
      <div role="status" className={report.structurallyValid ? 'intakeNotice' : 'intakeError'}>{report.structurallyValid ? '结构校验通过 · 内容仍待复核，不能直接发布' : '结构校验未通过 · 请修正错误后重试'}</div>
      <section className="intakeMetrics" aria-label="整理统计">
        <div><span>结构化题目项</span><strong>{paper?.questions.length ?? 0}</strong></div>
        <div><span>按选考规则满分</span><strong>{report.selectableScore}</strong><small>全部项目相加 {report.rawScore} 分（不可直接计分）</small></div>
        <div><span>已转录参考答案项</span><strong>{report.answerCount}</strong><small>不代表逐步评分标准已具备</small></div>
        <div><span>正式发布状态</span><strong className="intakeHeld">待复核</strong><small>没有自动发布或批准按钮</small></div>
      </section>
      <nav className="intakeTabs" aria-label="整理视图">{[['questions','题目与参考答案'],['sources','来源清单'],['issues','待复核事项']].map(([key,label]) => <button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</nav>
      {tab === 'questions' && paper ? <section className="intakeWorkspace">
        <aside><h2>原题号</h2><div className="intakeNumbers">{paper.questions.map((q,index)=><button type="button" key={`${q.id}-${index}`} aria-label={`查看原题${q.number}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{q.number}</button>)}</div><p>保留原题号；选考题独立列项，不重复计算整卷满分。</p></aside>
        {question ? <article className="intakeQuestion"><div className="intakeMeta">第{question.number}题 · {question.maxScore}分 · {question.reviewStatus}</div><h2>{paper.title}</h2><p className="intakeText">{question.stem}</p>{question.options.map(o=><p key={o.key}>{o.key}．{o.text}</p>)}{question.parts.map(p=><p key={p.id}>（{p.id}）{p.text}</p>)}{question.figureCount>0?<p className="intakeNotice">本题含{question.figureCount}幅图示，必须对照原图；图形没有被AI补画。</p>:null}
          <details><summary>查看参考答案转录（仅内容核验用）</summary><p className="intakeText">{question.referenceAnswer.text ?? '参考答案未完整取得，留空待补。'}</p><small>参考解答不等于官方逐步评分细则，本页不自动打分。</small></details>
          <p>题面依据：{question.sourceRefs.join('、')}　参考答案依据：{question.referenceAnswer.sourceRefs.join('、') || '待补'}</p>
        </article>:null}
      </section>:null}
      {tab === 'sources' ? <section className="intakeSources">{paper?.assets.map(a=><article key={a.id}><b>{a.id}</b><span>{a.status}</span><a href={isOfficialSourceUrl(a.url) ? a.url : undefined} target="_blank" rel="noreferrer">在官方站点核对 ↗</a><small>网址可见不等于本地原图已下载或教研已签收。</small></article>)}</section>:null}
      {tab === 'issues' ? <section className="intakeIssues" aria-label="校验问题">{report.issues.map((i,index)=><article key={index}><b>{i.severity==='error'?'结构错误':'发布阻断'} · {i.questionId ?? '整卷'}</b><p>{i.message}</p><small>{i.code}</small></article>)}</section>:null}
      <div className="intakeExports"><button type="button" onClick={()=>save(report,'report')}>导出核验报告</button><button type="button" disabled={!report.structurallyValid} onClick={()=>save(buildRetrievalDraft(report),'rag-draft')}>导出 RAG 整理草稿</button><button type="button" disabled={!report.structurallyValid} onClick={()=>save(buildQuestionDraft(report),'question-draft')}>导出无答案题面草稿</button><button type="button" onClick={()=>{generation.current++;setReport(null);setError('');}}>清空本页</button></div>
      <p className="intakeNotice">导出的检索片段默认 enabled=false；不会加入在线RAG。后续需人工签收、私有素材入库、选考运行时和评分校准。</p>
    </>}
  </>;
}

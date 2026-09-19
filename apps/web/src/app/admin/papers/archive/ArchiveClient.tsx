'use client';
import {useMemo,useState} from 'react';
import {ARCHIVE_YEARS,ARCHIVE_SUBJECTS,STATUS_LABELS,parseArchiveInventory,archiveStats,archiveCoverage,type ArchiveInventory,type ArchiveStatus} from '@/lib/archive-inventory';
export default function ArchiveClient(){
 const [inventory,setInventory]=useState<ArchiveInventory|null>(null),[error,setError]=useState('');
 const [year,setYear]=useState('all'),[subject,setSubject]=useState('all'),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(50);
 const records=useMemo(()=>inventory?.records??[],[inventory]);
 const stats=useMemo(()=>archiveStats(records),[records]);
 const coverage=useMemo(()=>archiveCoverage(records),[records]);
 const shown=useMemo(()=>records.filter(r=>(year==='all'||String(r.year)===year)&&(subject==='all'||r.subject===subject)&&(status==='all'||r.status===status)&&`${r.title} ${r.track} ${r.session} ${r.provider}`.toLowerCase().includes(query.toLowerCase())),[records,year,subject,status,query]);
 async function load(file:File|undefined){
   if(!file)return;
   setError('');
   try{if(file.size>20*1024*1024)throw new Error('清单不能超过20MB');const parsed=parseArchiveInventory(JSON.parse(await file.text()));setInventory(parsed);setLimit(50);}
   catch(e){setError(e instanceof Error?e.message:'清单读取失败');}
 }
 function exportInventory(){
   if(!inventory)return;
   const data={...inventory,counts:archiveStats(records),coverage:archiveCoverage(records)};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='gaokao-archive-inventory.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <>
  <section className="archiveLoad"><div><h2>登记一批资料</h2><p>选择采集器生成的 inventory.json。文件仅在本机读取，不上传，不改变考试题库。</p></div><label className="archiveFile">载入收纳清单<input type="file" accept="application/json,.json" aria-label="载入收纳清单" onChange={e=>void load(e.target.files?.[0])}/></label>{inventory&&<button className="secondaryButton darkButton" onClick={exportInventory}>导出清单</button>}</section>
  {error&&<p role="alert" className="archiveError">{error}</p>}
  <section className="archiveMetrics" aria-label="清单统计">
    {[[stats.sources,'来源记录'],[stats.files,'已取得文档'],[stats.pages,'已缓存网页'],[stats.failed,'获取失败'],[0,'已核验可开考']].map(([n,label])=><div key={String(label)}><strong>{n}</strong><span>{label}</span></div>)}
  </section>
  <p className="archiveNotice" role="status">{inventory?`已载入 ${records.length} 条采集记录；文件状态由清单记载，当前页面没有重新联网核验文件。`:'尚未载入采集清单。下方零值表示当前没有记录，不表示这些年份没有试卷。'}<br/>所有资料处于待审状态；完整卷型数量尚未核定，不显示虚假的“收齐百分比”。英语听力与参考答案需另行核验。</p>
  <section className="archiveBody"><div className="archiveMatrix"><h2>26年 · 语数英收纳表</h2><div className="archiveMatrixHeader"><span>届次</span>{ARCHIVE_SUBJECTS.map(s=><b key={s}>{s}</b>)}</div>
    {ARCHIVE_YEARS.map(y=><div className="archiveYear" key={y}><b>{y}</b>{ARCHIVE_SUBJECTS.map(s=>{const c=coverage.find(c=>c.year===y&&c.subject===s)!;return <button key={s} className={c.files||c.pages?'hasSources':''} aria-label={`${y}年${s}来源${c.sources}条`} onClick={()=>{setYear(String(y));setSubject(s);setLimit(50);}}><strong>{c.sources}</strong><small>文档{c.files} / 网页{c.pages}</small></button>})}</div>)}
    <p>{stats.unknownYear} 条来源的年份仍待核定。一个来源记录可能是答案、重复转载或合集，不能直接作为一套原卷计数。</p>
  </div><div className="archiveList"><div className="archiveListHeading"><h2>来源与缺口</h2><button className="secondaryButton darkButton" onClick={()=>{setYear('all');setSubject('all');setStatus('all');setQuery('');setLimit(50);}}>重置筛选</button></div>
    <div className="archiveFilters"><label>年份<select value={year} onChange={e=>{setYear(e.target.value);setLimit(50);}}><option value="all">全部年份</option>{ARCHIVE_YEARS.map(y=><option key={y}>{y}</option>)}<option value="null">年份待核定</option></select></label><label>科目<select value={subject} onChange={e=>{setSubject(e.target.value);setLimit(50);}}><option value="all">语数英</option>{ARCHIVE_SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></label><label>状态<select value={status} onChange={e=>{setStatus(e.target.value);setLimit(50);}}><option value="all">全部状态</option>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
    <label className="archiveSearch">查找卷名、文理科、春季、来源<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}} placeholder="例如：上海、全国、文科、春季"/></label><p>符合条件 {shown.length} 条</p>
    {shown.slice(0,limit).map(r=><article className="archiveRecord" key={r.id}><div><span className={`archiveStatus status-${r.status}`}>{STATUS_LABELS[r.status as ArchiveStatus]}</span><span className="archiveSubject">{r.year??'年份待定'} · {r.subject}</span></div><h3>{r.title||'未命名来源'}</h3><p>{r.track||'科类待核定'} · {r.session||'场次待核定'} · {r.provider}</p>{r.failureReason&&<p className="archiveFailure">{r.failureReason}</p>}{r.file&&<p className="archiveHash">SHA256 {r.file.sha256.slice(0,20)}… · {(r.file.bytes/1024).toFixed(1)} KB · {r.assets.length} 个附件</p>}<a href={r.url} target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a><small>待核验，不进入考试／RAG</small></article>)}
    {!shown.length&&<div className="archiveEmpty">暂时没有符合条件的记录。没有的卷子会保留为空，不用相似题替代。</div>}
    {shown.length>limit&&<button className="primaryButton" onClick={()=>setLimit(n=>n+50)}>继续查看50条</button>}
  </div></section>
  <footer className="archiveBottom">收纳原件 → 核定版本 → 分离题面与答案 → 结构化 → 独立审校 → 分级辅导／评分校准 → 允许重考<br/>让每份试卷可追溯，也让每一份作答被认真对待。采集不代表治愈效果。</footer>
 </>;
}

/** Collection evidence is not certification of an exam. */
export const ARCHIVE_YEARS = Array.from({length:26},(_,i)=>2000+i);
export const ARCHIVE_SUBJECTS = ['语文','数学','英语'] as const;
export type ArchiveSubject = typeof ARCHIVE_SUBJECTS[number];
export const STATUS_LABELS = {DISCOVERED:'仅发现来源', PAGE_SAVED:'已缓存网页', FILE_SAVED:'已取得文件', FETCH_FAILED:'获取失败'} as const;
export type ArchiveStatus = keyof typeof STATUS_LABELS;
export type ArchiveAsset = {sha256:string; bytes:number; path:string; format:string; url:string};
export type ArchiveRecord = {
  id:string; title:string; url:string; year:number|null; subject:ArchiveSubject;
  track:string; session:string; provider:string; status:ArchiveStatus;
  file?:ArchiveAsset; assets:ArchiveAsset[]; failureReason?:string;
  examReady:false; ragEnabled:false; contentVerified:false;
};
export type ArchiveInventory = {schemaVersion:'archive-inventory/1'; generatedAt:string; complete:false; records:ArchiveRecord[]};
function object(x:unknown):Record<string,unknown>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('清单结构不正确');
  return x as Record<string,unknown>;
}
function text(x:unknown,max=500):string{return typeof x==='string'?x.slice(0,max):'';}
export function sourceLink(x:unknown):string|null{
  if(typeof x!=='string'||x.length>4000)return null;
  try{
    const u=new URL(x);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    const allowed=['gaokao.eol.cn','www.eol.cn','img.eol.cn','edu.sina.com.cn','www.eeafj.cn',
      'api.github.com','raw.githubusercontent.com','github.com','i0.sinaimg.cn','i1.sinaimg.cn','i2.sinaimg.cn','i3.sinaimg.cn','image2.sina.com.cn'];
    return allowed.includes(u.hostname)?u.href:null;
  }catch{return null;}
}
function asset(x:unknown):ArchiveAsset{
  const a=object(x),url=sourceLink(a.url);
  if(!url||!(/^[a-f0-9]{64}$/i.test(String(a.sha256)))||typeof a.bytes!=='number'||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>25*1024*1024
    ||typeof a.path!=='string'||!/^raw\/[a-f0-9]{64}\.[a-z.0-9]+$/i.test(a.path))throw new Error('文件证据缺少合法哈希、长度或路径');
  return {sha256:String(a.sha256),bytes:a.bytes,path:a.path,format:text(a.format,20),url};
}
export function parseArchiveInventory(raw:unknown):ArchiveInventory{
  const x=object(raw);
  if(x.schemaVersion!=='archive-inventory/1'||x.complete!==false||!Array.isArray(x.records)||x.records.length>20000)throw new Error('仅支持未发布的 archive-inventory/1 清单（最多20000条）');
  const ids=new Set<string>();
  const records=x.records.map((item):ArchiveRecord=>{
    const r=object(item),url=sourceLink(r.url),id=text(r.id,120);
    if(!id||ids.has(id)||!url)throw new Error('来源ID重复或地址不受支持');ids.add(id);
    if(r.year!==null&&(!Number.isInteger(r.year)||Number(r.year)<2000||Number(r.year)>2025))throw new Error('年份超出2000—2025');
    if(!ARCHIVE_SUBJECTS.includes(r.subject as ArchiveSubject)||!Object.hasOwn(STATUS_LABELS,String(r.status)))throw new Error('科目或采集状态不正确');
    if(r.examReady!==false||r.ragEnabled!==false||r.contentVerified!==false)throw new Error('采集清单不能声明已审核、已开考或启用RAG');
    if(!Array.isArray(r.assets)||r.assets.length>1000)throw new Error('附件列表不正确');
    const f=r.file===undefined?undefined:asset(r.file);
    if(['FILE_SAVED','PAGE_SAVED'].includes(String(r.status))&&!f)throw new Error('已取得状态必须有文件证据');
    if(r.status==='FILE_SAVED'&&f?.format==='html.txt')throw new Error('网页缓存不是原卷文件');
    return {id,title:text(r.title),url,year:r.year as number|null,subject:r.subject as ArchiveSubject,
      track:text(r.track,60),session:text(r.session,60),provider:text(r.provider,60),status:r.status as ArchiveStatus,
      file:f,assets:r.assets.map(asset),failureReason:text(r.failureReason),examReady:false,ragEnabled:false,contentVerified:false};
  });
  return {schemaVersion:'archive-inventory/1',complete:false,generatedAt:text(x.generatedAt,60),records};
}
export function archiveStats(records:ArchiveRecord[]){
  const assets=new Map<string,ArchiveAsset>();
  for(const r of records){for(const a of r.assets)assets.set(a.sha256,a);if(r.file&&r.status==='FILE_SAVED')assets.set(r.file.sha256,r.file);}
  return {sources:records.length,files:records.filter(r=>r.status==='FILE_SAVED').length,pages:records.filter(r=>r.status==='PAGE_SAVED').length,
    failed:records.filter(r=>r.status==='FETCH_FAILED').length,discovered:records.filter(r=>r.status==='DISCOVERED').length,
    assetFiles:assets.size,bytes:[...assets.values()].reduce((n,a)=>n+a.bytes,0),unknownYear:records.filter(r=>r.year===null).length,
    verifiedPapers:0,examReady:0};
}
export function archiveCoverage(records:ArchiveRecord[]){
  return ARCHIVE_YEARS.flatMap(year=>ARCHIVE_SUBJECTS.map(subject=>({year,subject,...archiveStats(records.filter(r=>r.year===year&&r.subject===subject)),expectedDistinctEditions:null,allEditionsComplete:false})));
}

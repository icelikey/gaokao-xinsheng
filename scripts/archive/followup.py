#!/usr/bin/env python3
"""Explicit second batch: published pagination + previous missing math files.
Collection only; never publish content to the exam runtime.
"""
from __future__ import annotations
import argparse,base64,collections,concurrent.futures,gzip,hashlib,io,json,re,time,urllib.parse,zipfile
from pathlib import Path
import collect as c
original_kind=c.file_kind

def bundle_kind(b):
    try:return original_kind(b)
    except ValueError:
        if not b.startswith(b'PK\x03\x04'):raise
        with zipfile.ZipFile(io.BytesIO(b)) as z:
            if len(z.infolist())>1000 or sum(i.file_size for i in z.infolist())>100*1024*1024:raise ValueError('ZIP_EXPANSION_LIMIT')
            if any(i.filename.startswith(('/', '\\')) or '..' in i.filename.replace('\\','/').split('/') for i in z.infolist()):raise ValueError('UNSAFE_ZIP_NAMES')
        return 'zip'
c.file_kind=bundle_kind

def page_urls(url,text):
    m=re.search(r'_PAGE_COUNT\s*=\s*["\']?(\d+)',text)
    if not m:return []
    if not re.search(r'/shiti/(yw|yy)/|/huodong/20\d{2}gkst/',url):return []
    base=url if url.endswith('/') else url.rsplit('/',1)[0]+'/'
    return [urllib.parse.urljoin(base,f'index_{i}.shtml') for i in range(1,min(int(m[1]),40))]

def candidate(url,label,parent):
    result=c.candidate(url,label,parent)
    if result:return result
    if 'edu.sina.com.cn' not in url or not re.search(r'/200[0-5]-',url):return None
    subject=next((s for s in ('语文','英语') if s in label),None)
    if not subject:return None
    return {'id':'src_'+hashlib.sha256(url.encode()).hexdigest()[:20],'url':url,'title':label,
      'year':None,'subject':subject,'track':'未核定','session':'未核定','provider':'sina',
      'discoveredFrom':parent,'status':'DISCOVERED','assets':[],
      'examReady':False,'ragEnabled':False,'contentVerified':False,'metadataVerified':False,
      'editionIdentityVerified':False,'completePaperVerified':False,'referenceAnswerStatus':'UNREVIEWED',
      'audioStatus':'UNREVIEWED' if subject=='英语' else 'NOT_APPLICABLE'}

def run(args):
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    start=time.monotonic();f=c.Fetcher(out,args.max_mb*1024*1024,start+args.seconds)
    paths=json.loads(gzip.decompress(base64.b64decode(Path(args.pending).read_text())))
    records={};events=[]
    for path in paths:
        if not re.match(r'(普通高考|春季高考)/20\d{2}/[^/]+\.pdf$',path):raise ValueError('INVALID_PENDING_PATH')
        year=int(path.split('/')[1])
        if year not in c.YEARS:raise ValueError('INVALID_PENDING_YEAR')
        u=f'https://raw.githubusercontent.com/{c.MATH_REPO}/{c.PIN}/'+urllib.parse.quote(path)
        title=path.rsplit('/',1)[-1]
        records[u]={'id':'src_'+hashlib.sha256(u.encode()).hexdigest()[:20],'url':u,'title':title,
          **c.metadata(title+' 数学'),'year':year,'subject':'数学','session':'春季' if path.startswith('春季') else '普通',
          'provider':'community_math','repositoryPath':path,'discoveredFrom':'round1-inventory',
          'status':'DISCOVERED','assets':[],'examReady':False,'ragEnabled':False,'contentVerified':False,
          'editionIdentityVerified':False,'completePaperVerified':False,'referenceAnswerStatus':'UNREVIEWED','audioStatus':'NOT_APPLICABLE'}
    queue=collections.deque(['https://gaokao.eol.cn/shiti/yw/','https://gaokao.eol.cn/shiti/yy/',
      'https://edu.sina.com.cn/focus/gkzt/index.html','https://edu.sina.com.cn/exam2001/jijin/00gk.html',
      'https://gaokao.eol.cn/huodong/2012gkst/','https://gaokao.eol.cn/huodong/2011gkst/',
      'https://gaokao.eol.cn/huodong/2010gkst/'])
    seen=set()
    while queue and len(seen)<80 and time.monotonic()<start+min(180,args.seconds/3):
        u=queue.popleft()
        if u in seen:continue
        seen.add(u)
        try:
            b,info=f.get(u);text=c.decode(b);p=c.Parser();p.feed(text)
            events.append({'url':u,'status':'INDEX_SAVED','sha256':info['sha256']})
            queue.extend(x for x in page_urls(u,text) if x not in seen)
            for link in p.links:
                try:v=c.canonical(link['url'],u)
                except ValueError:continue
                r=candidate(v,link['label'],u)
                if r and r['subject'] in ('语文','英语'):records.setdefault(v,r)
        except Exception as e:events.append({'url':u,'status':'INDEX_FAILED','reason':str(e)[:180]})
    groups=collections.defaultdict(list)
    for r in records.values():groups[(r['year'] or 0,r['subject'])].append(r)
    selected=[]
    while groups and len(selected)<args.max_records:
        for k in sorted(list(groups)):
            selected.append(groups[k].pop(0))
            if not groups[k]:del groups[k]
            if len(selected)>=args.max_records:break
    print(json.dumps({'sourceRecords':len(records),'selected':len(selected),'indexes':len(events)}),flush=True)
    def one(r):
        try:
            direct=urllib.parse.urlsplit(r['url']).path.lower().endswith(('.pdf','.doc','.docx','.zip'))
            b,info=f.get(r['url'],'asset' if direct else 'page')
            if direct:r.update(status='FILE_SAVED',file=info);return
            p=c.Parser();p.feed(c.decode(b));title=(p.heading or p.title).strip();m=c.metadata(title,r['url'])
            if m['year'] is not None:r['year']=m['year']
            if m['subject']:r['subject']=m['subject']
            r.update(status='PAGE_SAVED',file=info,pageTitle=title,assetFailures=[],pageFiles=[])
            (out/'raw'/f'{info["sha256"]}.text.txt').write_text('\n'.join(p.text),encoding='utf-8')
            r['textPath']=f'raw/{info["sha256"]}.text.txt'
            pages=[(r['url'],p)];stem=urllib.parse.urlsplit(r['url']).path.rsplit('.',1)[0]
            for a in p.links:
                try:v=c.canonical(a['url'],r['url'])
                except ValueError:continue
                vpath=urllib.parse.urlsplit(v).path
                if len(pages)>=7 or not re.fullmatch(re.escape(stem)+r'_\d+\.s?html',vpath):continue
                try:
                    bb,ii=f.get(v);pp=c.Parser();pp.feed(c.decode(bb));pages.append((v,pp));r['pageFiles'].append(ii)
                    (out/'raw'/f'{ii["sha256"]}.text.txt').write_text('\n'.join(pp.text),encoding='utf-8')
                except Exception as e:r['assetFailures'].append({'url':v,'reason':str(e)[:160]})
            asset_urls=[]
            for base,pp in pages:
                for a in pp.links+pp.images:
                    try:v=c.canonical(a['url'],base)
                    except ValueError:continue
                    path=urllib.parse.urlsplit(v).path.lower()
                    if not path.endswith(c.SUFFIXES+('.zip',)):continue
                    if re.search(r'logo|banner|qrcode|weixin|icon|guanzhu|ewm',v+' '+a['label'],re.I):continue
                    if path.endswith(('.jpg','.jpeg','.png','.gif')) and not (v.startswith(base.rsplit('/',1)[0]+'/') or '/upload/' in v or '/u/cms/' in v or 'sinaimg.cn' in v or 'image2.sina.com.cn' in v):continue
                    if v not in asset_urls:asset_urls.append(v)
            r['linkedAssetCount']=len(asset_urls);r['remainingAssetUrls']=asset_urls[36:]
            for v in asset_urls[:36]:
                try:_,a=f.get(v,'asset');r['assets'].append(a)
                except Exception as e:r['assetFailures'].append({'url':v,'reason':str(e)[:160]})
        except Exception as e:r.update(status='FETCH_FAILED',failureReason=type(e).__name__+':'+str(e)[:180])
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i,_ in enumerate(pool.map(one,selected),1):
            if i%50==0:print(json.dumps({'processed':i,'bytes':f.bytes}),flush=True)
    result=c.summarize(list(records.values()),events)
    result['batch']='second';result['limits']={'seconds':args.seconds,'maxRecords':args.max_records,'maxBytes':args.max_mb*1024*1024}
    result['scopeNote']='标题/链接元信息仍待复核。网页多页、附件、ZIP都不是已验证整卷。所有内容禁止开考与RAG。'
    (out/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result['counts']),flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--pending',required=True)
    p.add_argument('--seconds',type=int,default=600);p.add_argument('--max-mb',type=int,default=450);p.add_argument('--max-records',type=int,default=900)
    a=p.parse_args()
    if not (1<=a.seconds<=900 and 1<=a.max_mb<=500 and 1<=a.max_records<=1500):p.error('invalid budgets')
    run(a)

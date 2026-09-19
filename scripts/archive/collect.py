#!/usr/bin/env python3
"""Bounded source archiver. Downloaded bytes are NOT verified papers or RAG data.
No authentication, OCR, model call, publishing, or generated exam content.
"""
from __future__ import annotations
import argparse, collections, concurrent.futures, hashlib, html, ipaddress, json
import re, socket, threading, time, urllib.error, urllib.parse, urllib.request
import urllib.robotparser
from html.parser import HTMLParser
from pathlib import Path

YEARS = range(2000, 2026)
SUBJECTS = ('语文', '数学', '英语')
PIN = 'd5f0d0f66daa92051586b0850ecb1f3c0b14603f'
MATH_REPO = 'deekur/gaokaomath'
HOSTS = {'gaokao.eol.cn','www.eol.cn','img.eol.cn','edu.sina.com.cn',
         'i0.sinaimg.cn','i1.sinaimg.cn','i2.sinaimg.cn','i3.sinaimg.cn',
         'image2.sina.com.cn','www.eeafj.cn','api.github.com','raw.githubusercontent.com'}
SEEDS = [
 'https://gaokao.eol.cn/huodong/',
 'https://gaokao.eol.cn/e_html/gk/gkst/2025st.shtml',
 'https://gaokao.eol.cn/e_html/gk/gkst/2024st.shtml',
 'https://gaokao.eol.cn/shiti/yw/',
 'https://gaokao.eol.cn/shiti/sx/',
 'https://gaokao.eol.cn/shiti/yy/',
 'https://edu.sina.com.cn/focus/gkzt/index.html',
 'https://edu.sina.com.cn/exam2001/jijin/00gk.html',
 'https://www.eeafj.cn/systsj/20120608/2148.html',
 'https://www.eeafj.cn/systsj/20120608/2147.html',
]
UA = 'GaokaoXinshengArchive/0.1 (limited historical exam archival; no login)'
BLOCK = re.compile(r'模拟|预测|联考|适应性|备考|押题|满分作文|状元|点评|评析|趋势|招生政策|报名|成人|高职')
SUFFIXES = ('.pdf','.doc','.docx','.jpg','.jpeg','.png','.gif','.mp3','.wav','.m4a')

def canonical(url: str, base: str = '') -> str:
    p = urllib.parse.urlsplit(urllib.parse.urljoin(base, html.unescape(url.strip())))
    if p.scheme not in ('http','https') or p.username or p.password:
        raise ValueError('URL_SCHEME_OR_CREDENTIALS')
    if p.hostname not in HOSTS or p.port not in (None,80,443):
        raise ValueError('HOST_NOT_ALLOWED')
    if p.hostname == 'api.github.com' and not p.path.startswith(f'/repos/{MATH_REPO}/'):
        raise ValueError('API_PATH_NOT_ALLOWED')
    if p.hostname == 'raw.githubusercontent.com' and not p.path.startswith(f'/{MATH_REPO}/{PIN}/'):
        raise ValueError('RAW_PATH_NOT_ALLOWED')
    return urllib.parse.urlunsplit(('https',p.hostname,urllib.parse.quote(urllib.parse.unquote(p.path),safe='/@,:+()'),p.query,''))

def metadata(title: str, url: str = '') -> dict:
    """Title/path assertions remain unverified; never infer province applicability."""
    years = sorted(set(int(x) for x in re.findall(r'(?<!\d)(20\d{2})(?!\d)',title) if int(x) in YEARS))
    subject = next((x for x in SUBJECTS if x in title),None)
    if not subject and ('文数' in title or '理数' in title): subject = '数学'
    if not subject:
        subject = next((v for k,v in (('/yw/','语文'),('/sx/','数学'),('/yy/','英语')) if k in url),None)
    return {'year': years[0] if len(years)==1 else None, 'subject':subject,
            'track': '文科' if re.search(r'文科|文数|文\.pdf',title) else '理科' if re.search(r'理科|理数|理\.pdf',title) else '未核定',
            'session': '春季' if '春季' in title else '未核定',
            'editionLabel':title,'metadataVerified':False}

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links=[]; self.images=[]; self._a=None; self.title=''; self._title=False
        self._h1=False; self.heading=''; self.text=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='title': self._title=True
        if tag=='h1': self._h1=True
        if tag=='a': self._a={'url':a.get('href',''),'label':a.get('title','')}
        if tag=='img' and a.get('src'): self.images.append({'url':a['src'],'label':a.get('alt','')})
        if tag in ('audio','source') and a.get('src'): self.links.append({'url':a['src'],'label':'听力音频'})
    def handle_data(self,d):
        self.text.append(d)
        if self._title:self.title+=d
        if self._h1:self.heading+=d
        if self._a:self._a['label']+=d
    def handle_endtag(self,tag):
        if tag=='title':self._title=False
        if tag=='h1':self._h1=False
        if tag=='a' and self._a:self.links.append(self._a);self._a=None

def decode(b: bytes) -> str:
    m=re.search(br'charset\s*=\s*["\']?([\w-]+)',b[:6000],re.I)
    encoding=m.group(1).decode('ascii') if m else 'utf-8'
    for enc in (encoding,'utf-8','gb18030'):
        try:return b.decode(enc)
        except (UnicodeError,LookupError):pass
    return b.decode('utf-8','replace')

def file_kind(data:bytes) -> str:
    if data.startswith(b'%PDF-') and b'%%EOF' in data[-4096:]:return 'pdf'
    if data.startswith(b'\xff\xd8\xff') and data.endswith(b'\xff\xd9'):return 'jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):return 'png'
    if data.startswith((b'GIF87a',b'GIF89a')):return 'gif'
    if data.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):return 'doc'
    if data.startswith(b'PK\x03\x04') and b'word/' in data:return 'docx'
    if data.startswith(b'ID3') or data[:2] in (b'\xff\xfb',b'\xff\xf3',b'\xff\xf2'):return 'mp3'
    if data.startswith(b'RIFF') and data[8:12]==b'WAVE':return 'wav'
    if len(data)>12 and data[4:8]==b'ftyp':return 'm4a'
    raise ValueError('UNRECOGNIZED_FILE_BYTES')

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return super().redirect_request(req,fp,code,msg,headers,canonical(newurl,req.full_url))

class Fetcher:
    def __init__(self,out:Path,max_bytes:int,deadline:float):
        self.out=out; self.max_bytes=max_bytes; self.deadline=deadline; self.bytes=0
        self.lock=threading.Lock();self.hostlocks=collections.defaultdict(threading.Lock)
        self.last={}; self.robots={}; self.cache={}
        self.opener=urllib.request.build_opener(SafeRedirect())
    def _get(self,url:str,limit:int=20*1024*1024):
        if time.monotonic()>self.deadline:raise ValueError('RUN_BUDGET_REACHED')
        host=urllib.parse.urlsplit(url).hostname
        with self.hostlocks[host]:
            time.sleep(max(0,self.last.get(host,0)+0.30-time.monotonic()))
            self.last[host]=time.monotonic()
        for entry in socket.getaddrinfo(host,443,type=socket.SOCK_STREAM):
            if not ipaddress.ip_address(entry[4][0]).is_global:raise ValueError('NON_PUBLIC_ADDRESS')
        req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Encoding':'identity'})
        with self.opener.open(req,timeout=9) as response:
            final=canonical(response.url)
            if int(response.headers.get('Content-Length','0'))>limit:raise ValueError('FILE_TOO_LARGE')
            parts=[]; n=0
            while True:
                chunk=response.read(65536)
                if not chunk:break
                n+=len(chunk)
                with self.lock:
                    if self.bytes+len(chunk)>self.max_bytes:raise ValueError('BYTE_BUDGET_REACHED')
                    self.bytes+=len(chunk)
                if n>limit:raise ValueError('FILE_TOO_LARGE')
                if time.monotonic()>self.deadline:raise ValueError('RUN_BUDGET_REACHED')
                parts.append(chunk)
            return b''.join(parts),final,response.headers.get('Content-Type','')
    def permitted(self,url):
        host=urllib.parse.urlsplit(url).hostname
        if host in ('api.github.com','raw.githubusercontent.com'):return True
        with self.lock:cached=self.robots.get(host)
        if cached is None:
            p=urllib.robotparser.RobotFileParser()
            try:
                b,_,_=self._get(f'https://{host}/robots.txt',256*1024)
                p.parse(decode(b).splitlines());cached=p
            except urllib.error.HTTPError as e:
                cached=True if e.code in (404,410) else False
            except Exception:cached=False
            with self.lock:self.robots[host]=cached
        return cached if isinstance(cached,bool) else cached.can_fetch(UA,url)
    def get(self,url,kind='page'):
        url=canonical(url)
        if url in self.cache:return self.cache[url]
        if not self.permitted(url):raise ValueError('ROBOTS_BLOCKED_OR_UNAVAILABLE')
        b,final,mime=self._get(url,5*1024*1024 if kind=='page' else 20*1024*1024)
        sha=hashlib.sha256(b).hexdigest()
        ext='html.txt' if kind=='page' else file_kind(b)
        if kind=='page' and not re.search(br'<(?:html|!doctype|head)',b[:8000],re.I):raise ValueError('NOT_HTML')
        relative=f'raw/{sha}.{ext}'; path=self.out/relative
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b)
        result=(b,{'url':url,'finalUrl':final,'sha256':sha,'bytes':len(b),'path':relative,'format':ext,'mime':mime})
        self.cache[url]=result;return result

def is_listing(url,label):
    p=urllib.parse.urlsplit(url).path
    return bool(re.search(r'/huodong/20\d\dgkst/(?:index(?:_\d+)?\.(?:s?html))?$',p)
        or re.search(r'/e_html/gk/gkst/(?:20\d\dst\.shtml)?$',p)
        or re.search(r'/shiti/(?:yw|sx|yy)/(?:index(?:_\d+)?\.(?:s?html))?$',p))

def candidate(url,label,parent):
    label=re.sub(r'\s+',' ',label).strip()
    m=metadata(label,url)
    if not m['subject'] or BLOCK.search(label):return None
    stated_years=[int(x) for x in re.findall(r'(?<!\d)((?:19|20)\d{2})(?!\d)',label)]
    if stated_years and not any(y in YEARS for y in stated_years):return None
    if not m['year'] and not re.search(r'/shiti/(yw|sx|yy)/20\d{4}/|/200[0-3]/',url):return None
    if not re.search(r'高考|试题|试卷|答案|真题|语文|数学|英语|文数|理数',label):return None
    return {'id':'src_'+hashlib.sha256(url.encode()).hexdigest()[:20], 'url':url,'title':label,
      **m,'discoveredFrom':parent,'provider':'sina' if 'sina.' in url else 'eol' if 'eol.cn' in url else 'official_fujian',
      'status':'DISCOVERED','assets':[],'examReady':False,'ragEnabled':False,'contentVerified':False,
      'editionIdentityVerified':False,'completePaperVerified':False,'referenceAnswerStatus':'UNREVIEWED',
      'audioStatus':'UNREVIEWED' if m['subject']=='英语' else 'NOT_APPLICABLE'}

def summarize(records,events):
    cells=[]
    for year in YEARS:
        for subject in SUBJECTS:
            rs=[x for x in records if x.get('year')==year and x.get('subject')==subject]
            cells.append({'year':year,'subject':subject,'sources':len(rs),
              'filesSaved':sum(x['status']=='FILE_SAVED' for x in rs),
              'pagesSaved':sum(x['status']=='PAGE_SAVED' for x in rs),
              'failures':sum(x['status']=='FETCH_FAILED' for x in rs),
              'verifiedPapers':0,'examReady':0,'expectedDistinctEditions':None,'allEditionsComplete':False})
    hashes={a['sha256']:a['bytes'] for r in records for a in r.get('assets',[])}
    for r in records:
        if r.get('file'):hashes[r['file']['sha256']]=r['file']['bytes']
    return {'schemaVersion':'archive-inventory/1','scope':{'startYear':2000,'endYear':2025,'subjects':list(SUBJECTS)},
       'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'complete':False,
       'counts':{'sourceRecords':len(records),'filesSaved':sum(r['status']=='FILE_SAVED' for r in records),
         'pagesSaved':sum(r['status']=='PAGE_SAVED' for r in records),'assetFiles':len(hashes),
         'assetBytes':sum(hashes.values()),'failedRecords':sum(r['status']=='FETCH_FAILED' for r in records),
         'verifiedPapers':0,'examReady':0},'coverage':cells,'records':records,'events':events}

def run(args):
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    f=Fetcher(out,args.max_mb*1024*1024,time.monotonic()+args.seconds)
    records={}; events=[]; queue=collections.deque(SEEDS);seen=set()
    while queue and len(seen)<args.max_listings and time.monotonic()<f.deadline:
        u=queue.popleft()
        if u in seen:continue
        seen.add(u)
        try:
            b,info=f.get(u);text=decode(b);p=Parser();p.feed(text)
            events.append({'url':u,'status':'INDEX_SAVED','sha256':info['sha256']})
            own=candidate(u,(p.heading or p.title).strip(),u)
            if own and not is_listing(u,''):records.setdefault(u,own)
            for a in p.links:
                try:v=canonical(a['url'],u)
                except ValueError:continue
                if is_listing(v,a['label']) and v not in seen:queue.append(v)
                r=candidate(v,a['label'],u)
                if r and v not in records:records[v]=r
            m=re.search(r'createPageHTML\(\s*(\d+)',text)
            if m and ('/huodong/' in u or '/shiti/' in u):
                base=u.rsplit('/',1)[0]+'/' if not u.endswith('/') else u
                for page in range(1,min(int(m.group(1)),args.max_pages_per_listing)):
                    v=urllib.parse.urljoin(base,f'index_{page}.shtml')
                    if v not in seen:queue.append(v)
        except Exception as e:events.append({'url':u,'status':'INDEX_FAILED','reason':type(e).__name__+':'+str(e)[:180]})
    api=f'https://api.github.com/repos/{MATH_REPO}/git/trees/{PIN}?recursive=1'
    try:
        b,_,_=f._get(api,5*1024*1024);tree=json.loads(b)
        if tree.get('truncated'):raise ValueError('GITHUB_TREE_TRUNCATED')
        for entry in tree['tree']:
            path=entry['path'];m=re.match(r'(普通高考|春季高考)/(20\d{2})/',path)
            if entry['type']!='blob' or not path.endswith('.pdf') or not m or int(m[2]) not in YEARS:continue
            u=f'https://raw.githubusercontent.com/{MATH_REPO}/{PIN}/'+urllib.parse.quote(path)
            title=path.rsplit('/',1)[-1]
            records[u]={'id':'src_'+hashlib.sha256(u.encode()).hexdigest()[:20],'url':u,'title':title,
                **metadata(title+' 数学'), 'year':int(m[2]),'subject':'数学','session':'春季' if m[1]=='春季高考' else '普通',
                'discoveredFrom':api,'provider':'community_math','repositoryPath':path,'gitBlobSha':entry['sha'],
                'status':'DISCOVERED','assets':[],'examReady':False,'ragEnabled':False,'contentVerified':False,
                'editionIdentityVerified':False,'completePaperVerified':False,'referenceAnswerStatus':'UNREVIEWED','audioStatus':'NOT_APPLICABLE'}
        events.append({'url':api,'status':'TREE_READ','commit':PIN})
    except Exception as e:events.append({'url':api,'status':'INDEX_FAILED','reason':str(e)[:180]})
    raw=list(records.values());groups=collections.defaultdict(list)
    for r in raw:groups[(r.get('year') or 0,r['subject'])].append(r)
    selected=[]
    while groups and len(selected)<args.max_records:
        for key in sorted(list(groups)):
            selected.append(groups[key].pop(0))
            if not groups[key]:del groups[key]
            if len(selected)>=args.max_records:break
    def fetch_record(r):
        try:
            direct=r['url'].lower().split('?')[0].endswith(('.pdf','.doc','.docx'))
            b,info=f.get(r['url'],'asset' if direct else 'page')
            if direct:r.update(status='FILE_SAVED',file=info);return
            p=Parser();p.feed(decode(b));title=(p.heading or p.title).strip();m=metadata(title,r['url'])
            if m['year'] is not None:r['year']=m['year']
            if m['subject']:r['subject']=m['subject']
            r.update(status='PAGE_SAVED',file=info,pageTitle=title)
            (out/'raw'/f'{info["sha256"]}.text.txt').write_text('\n'.join(p.text),encoding='utf-8')
            r['textPath']=f'raw/{info["sha256"]}.text.txt';candidates=[]
            for a in p.links+p.images:
                try:u=canonical(a['url'],r['url'])
                except ValueError:continue
                path=urllib.parse.urlsplit(u).path.lower()
                if not path.endswith(SUFFIXES):continue
                if re.search(r'logo|banner|qrcode|weixin|icon|guanzhu|ewm',u+' '+a['label'],re.I):continue
                if path.endswith(('.jpg','.jpeg','.png','.gif')):
                    page_dir=r['url'].rsplit('/',1)[0]+'/'
                    if not (u.startswith(page_dir) or '/upload/' in u or '/u/cms/' in u):continue
                if u not in candidates:candidates.append(u)
            r['linkedAssetCount']=len(candidates);r['assetFailures']=[]
            for u in candidates[:args.max_assets_per_record]:
                try:_,a=f.get(u,'asset');r['assets'].append(a)
                except Exception as e:r['assetFailures'].append({'url':u,'reason':str(e)[:120]})
            r['remainingAssetUrls']=candidates[args.max_assets_per_record:]
        except Exception as e:r.update(status='FETCH_FAILED',failureReason=type(e).__name__+':'+str(e)[:180])
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i,_ in enumerate(pool.map(fetch_record,selected),1):
            if i%25==0:
                print(json.dumps({'processed':i,'selected':len(selected),'bytesFetched':f.bytes}),flush=True)
                (out/'inventory.checkpoint.json').write_text(json.dumps(summarize(raw,events),ensure_ascii=False),encoding='utf-8')
    result=summarize(raw,events)
    result['limits']={'maxRecords':args.max_records,'maxListings':args.max_listings,'maxBytes':args.max_mb*1024*1024,'seconds':args.seconds}
    result['scopeNote']='文件/来源记录不是独立原卷数。未经逐页、版本、答案、音频与授权范围匹配核验；全部禁止考试与RAG。'
    (out/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'counts':result['counts'],'indexEvents':len(events),'complete':False},ensure_ascii=False),flush=True)
    return result

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True)
    ap.add_argument('--max-mb',type=int,default=350);ap.add_argument('--seconds',type=int,default=600)
    ap.add_argument('--max-records',type=int,default=800);ap.add_argument('--max-listings',type=int,default=100)
    ap.add_argument('--max-pages-per-listing',type=int,default=8);ap.add_argument('--max-assets-per-record',type=int,default=12)
    a=ap.parse_args()
    if not (1<=a.max_mb<=600 and 1<=a.max_records<=3000 and 1<=a.seconds<=1200):ap.error('Limits outside safe bounds')
    run(a)

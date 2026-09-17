#!/usr/bin/env python3
"""Download an approved source inventory into PRIVATE local storage; no OCR/publishing.
Default is plan-only. Explicit --download is required. Missing assets exit nonzero.
"""
from __future__ import annotations
import argparse, hashlib, json, re, time, urllib.request
from pathlib import Path
from urllib.parse import urlsplit

LIMIT = 12 * 1024 * 1024
HOST = 'www.eeafj.cn'
def allowed(url: str) -> bool:
    try:
        u = urlsplit(url)
        return u.scheme == 'https' and u.hostname == HOST and not u.username and not u.password and u.port is None and not u.query and not u.fragment and u.path.startswith('/u/cms/default/201206/') and u.path.endswith('.jpg')
    except (ValueError, TypeError): return False
class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed(newurl): raise ValueError('Redirect left approved source scope')
        return super().redirect_request(req, fp, code, msg, headers, newurl)
def fetch_jpeg(url: str, *, opener=None, attempts: int = 3) -> bytes:
    if not allowed(url): raise ValueError('Unapproved source URL')
    opener = opener or urllib.request.build_opener(SafeRedirect())
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'GaokaoXinsheng-SourceIntake/1.0 (source verification)'})
            with opener.open(req, timeout=20) as res:
                if not allowed(res.geturl()): raise ValueError('Unapproved final URL')
                data = res.read(LIMIT + 1)
                if len(data) > LIMIT: raise ValueError('Asset exceeds size limit')
                if not data.startswith(b'\xff\xd8\xff') or not data.endswith(b'\xff\xd9'): raise ValueError('Not a complete JPEG; might be an error page')
                return data
        except (OSError, ValueError) as exc:
            last = exc
            if attempt + 1 < attempts: time.sleep(1 + attempt)
    raise OSError(f'Source could not be fetched after {attempts} attempts: {type(last).__name__}')
def acquire(manifest: dict, out: Path, *, downloader=fetch_jpeg) -> dict:
    if out.is_symlink(): raise ValueError('Output may not be a symlink')
    out.mkdir(parents=True, exist_ok=True)
    rows, seen = [], set()
    for item in manifest['assets']:
        asset_id = item.get('id', '')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', asset_id) or asset_id in seen: raise ValueError('Invalid or duplicate asset ID')
        seen.add(asset_id)
        if not allowed(item.get('url','')): raise ValueError('Inventory contains unapproved URL')
        row = {'id':asset_id,'url':item['url'],'status':'UNAVAILABLE','sha256':None,'path':None}
        try:
            data = downloader(item['url']); digest = hashlib.sha256(data).hexdigest()
            target = out / f'{asset_id}-{digest[:16]}.jpg'
            if target.is_symlink(): raise ValueError('Refuse symlink destination')
            if target.exists() and target.read_bytes() != data: raise ValueError('Content address collision')
            if not target.exists():
                with target.open('xb') as stream: stream.write(data)
            row.update(status='DOWNLOADED',sha256=digest,path=target.name,bytes=len(data))
        except (OSError, ValueError) as exc: row['error'] = str(exc)
        rows.append(row)
    result = {'schemaVersion':'source-receipt/1','paperId':manifest['id'],'complete':all(r['status']=='DOWNLOADED' for r in rows),'humanVerified':False,'assets':rows}
    destination = out/'download-receipt.json'
    if destination.is_symlink(): raise ValueError('Refuse receipt symlink')
    destination.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    return result
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',type=Path,default=Path('docs/content/fj-2012-math-science.sources.json'))
    parser.add_argument('--out',type=Path,default=Path('private-content/fj-2012-math-science/raw'))
    parser.add_argument('--download',action='store_true')
    args=parser.parse_args()
    manifest=json.loads(args.manifest.read_text(encoding='utf-8'))
    if not args.download:
        print(json.dumps({'mode':'PLAN_ONLY','paperId':manifest['id'],'assetCount':len(manifest['assets']),'output':str(args.out),'note':'Nothing downloaded. Add --download to write PRIVATE source files.'},ensure_ascii=False,indent=2));return
    result=acquire(manifest,args.out)
    print(json.dumps({'paperId':result['paperId'],'downloaded':sum(x['status']=='DOWNLOADED' for x in result['assets']),'complete':result['complete'],'receipt':str(args.out/'download-receipt.json')},ensure_ascii=False,indent=2))
    if not result['complete']: raise SystemExit(2)
if __name__=='__main__': main()

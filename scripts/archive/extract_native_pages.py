#!/usr/bin/env python3
"""Optional private preprocessing with PyMuPDF; no OCR, model calls or publishing.
Usage: python3 scripts/archive/extract_native_pages.py private-content/archive
Native formula/column order is preserved as extracted, never silently repaired.
"""
from __future__ import annotations
import collections,json,sys
from pathlib import Path

def run(directory:str):
    import fitz
    root=Path(directory).resolve()
    inv=json.loads((root/'inventory.json').read_text(encoding='utf-8'))
    if inv.get('schemaVersion')!='archive-inventory/1' or inv.get('complete') is not False:raise ValueError('Expected staging inventory')
    sources=collections.defaultdict(list);files={}
    for r in inv['records']:
        for f in [r.get('file')]+r.get('assets',[]):
            if f and f['format']=='pdf':
                files[f['sha256']]=f
                sources[f['sha256']].append({'sourceId':r['id'],'year':r['year'],'subject':r['subject'],'title':r['title'],'url':r['url']})
    out=root/'native-text-draft';out.mkdir(exist_ok=True)
    results=[];page_count=0;with_text=0
    with (root/'source-pages.disabled.jsonl').open('w',encoding='utf-8') as target:
        for sha,f in files.items():
            try:
                path=(root/f['path']).resolve()
                if not path.is_relative_to(root) or len(sha)!=64 or not all(c in '0123456789abcdef' for c in sha):raise ValueError('Invalid local source path or hash')
                with fitz.open(path) as doc:
                    count=len(doc)
                    if count>1000:raise ValueError('Page limit reached')
                    for num,page in enumerate(doc,1):
                        text=page.get_text('text',sort=False)
                        (out/f'{sha}-p{num:03d}.txt').write_text(text,encoding='utf-8')
                        item={'id':sha+':p'+str(num),'sourceSha256':sha,'sourcePath':f['path'],'page':num,
                          'references':sources[sha],'text':text,'nativeTextChars':len(text),
                          'contentRole':'unclassified_source_page','enabled':False,'reviewStatus':'UNREVIEWED',
                          'extractionMethod':'native-text','requiresLayoutReview':True,
                          'warnings':['Native text may scramble formulas or columns; not corrected or validated.',
                           'May contain both questions and answers; unsafe for unreviewed tutoring.']}
                        target.write(json.dumps(item,ensure_ascii=False)+'\n');page_count+=1;with_text+=bool(text.strip())
                results.append({'sha256':sha,'pages':count,'status':'TEXT_LAYER_EXTRACTED'})
            except Exception as e:results.append({'sha256':sha,'status':'FAILED','error':str(e)})
    summary={'pdfFiles':len(files),'pagesExtracted':page_count,'pagesWithText':with_text,'pagesWithoutText':page_count-with_text,
      'embeddingEnabled':False,'ocrUsed':False,'questionSegmentationComplete':False,'results':results}
    (root/'native-text-report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k!='results'}));return summary
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: extract_native_pages.py private-content/archive')
    run(sys.argv[1])

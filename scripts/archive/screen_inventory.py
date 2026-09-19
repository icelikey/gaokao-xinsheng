#!/usr/bin/env python3
"""Quarantine clear non-original-paper titles. Never delete or rewrite source bytes.
Remaining candidates are NOT certified original exams. Private input/output only.
"""
from __future__ import annotations
import argparse,json,re
from pathlib import Path
import collect as collector
NON_TARGET=re.compile(r'模拟|预测|联考|适应性|备考|押题|满分作文|状元|点评|评析|趋势|招生政策|报名|成人|高职|期中|期末|一模|二模|三模|调研|诊断|练习|复习|冲刺|增分点|公费教育|师范生|自主招生|月考|阶段性|教研|考点梳理|教学')

def screen(inventory):
    if inventory.get('schemaVersion')!='archive-inventory/1' or inventory.get('complete') is not False:
        raise ValueError('Expected unpublished archive-inventory/1')
    records=inventory.get('records')
    if not isinstance(records,list) or len(records)>20000:raise ValueError('Record limit')
    kept=[];quarantined=[]
    for original in records:
        if any(original.get(k) is not False for k in ('examReady','ragEnabled','contentVerified')):
            raise ValueError('Cannot screen published/verified records as collection evidence')
        record=dict(original)
        hit=None if record.get('provider')=='community_math' else (
            NON_TARGET.search(str(record.get('title',''))) or NON_TARGET.search(str(record.get('pageTitle',''))))
        if hit:
            record.update(scopeDisposition='QUARANTINED_NON_TARGET',scopeReason='标题出现非原卷线索：'+hit.group(),scopeReview='TITLE_RULE_ONLY')
            quarantined.append(record)
        else:
            record['scopeDisposition']='CANDIDATE_UNREVIEWED';kept.append(record)
    result={**inventory,**collector.summarize(kept,inventory.get('events',[]))}
    result.update(totalDiscoveredBeforeScopeScreen=len(records),excludedSourceRecords=len(quarantined))
    result['scopeNote']='明确非原卷标题独立隔离；其余仍为待核验候选，未启用考试或RAG。原始字节不改变。'
    result['counts']['quarantinedNonTargetSources']=len(quarantined)
    return result,{'reason':'Title-based quarantine, not certification of remaining records','records':quarantined}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--quarantine',required=True);a=p.parse_args()
    src=Path(a.input)
    if src.stat().st_size>20*1024*1024:raise SystemExit('Input exceeds 20MB')
    if len({src.resolve(),Path(a.output).resolve(),Path(a.quarantine).resolve()})<3:raise SystemExit('Use separate input/output/quarantine files')
    kept,excluded=screen(json.loads(src.read_text(encoding='utf-8')))
    for name,data in [(a.output,kept),(a.quarantine,excluded)]:
        out=Path(name);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'candidateRecords':len(kept['records']),'quarantined':len(excluded['records']),'examReady':0}))

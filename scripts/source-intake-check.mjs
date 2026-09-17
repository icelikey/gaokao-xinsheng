import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceIntake, buildRetrievalDraft, buildQuestionDraft, isOfficialSourceUrl } from '../apps/web/src/lib/source-intake.ts';
const asset = 'https://www.eeafj.cn/u/cms/default/201206/example.jpg';
function sample() { return { schemaVersion:'source-paper/1', id:'original-test-fixture',title:'原创结构测试，不是真题',status:'STAGING',totalScore:17,source:{articleUrl:'https://www.eeafj.cn/systsj/20120608/2148.html'},assets:[{id:'s1',url:asset,status:'VISUALLY_READ'}], questions:[
 {id:'q1',number:'1',type:'single_choice',stem:'原创：1+1=?',maxScore:3,options:['1','2','3','4'].map((text,i)=>({key:'ABCD'[i],text})),sourceRefs:['s1'],referenceAnswer:{text:'B',sourceRefs:['s1'],status:'TRANSCRIBED'},reviewStatus:'TRANSCRIBED'},
 ...['a','b','c'].map(id=>({id,number:`2-${id}`,type:'free_response',stem:'原创选考测试',maxScore:7,selectionGroup:'g',sourceRefs:['s1'],referenceAnswer:{text:null,sourceRefs:[],status:'MISSING'},reviewStatus:'TRANSCRIBED'}))], selectionGroups:[{id:'g',choose:2,questionIds:['a','b','c'],maxScore:14,overAnswerPolicy:'FIRST_TWO'}] }; }
const has=(r,code)=>r.issues.some(i=>i.code===code);
test('accepts source shape without inflating question count',()=>{const r=validateSourceIntake(sample());assert.equal(r.structurallyValid,true);assert.equal(r.paper.questions.length,4);});
test('choice group computes selectable score, not raw sum',()=>{const r=validateSourceIntake(sample());assert.equal(r.rawScore,24);assert.equal(r.selectableScore,17);});
test('never publishes a staged package',()=>assert.equal(validateSourceIntake(sample()).canPublish,false));
test('missing answers held instead of invented',()=>{const r=validateSourceIntake(sample());assert.equal(r.answerCount,1);assert.equal(has(r,'ANSWER_MISSING'),true);});
test('rejects forged status',()=>{const x=sample();x.status='PUBLISHED';assert.equal(has(validateSourceIntake(x),'STAGING_ONLY'),true);});
test('all structured unknowns fail closed',()=>{for(const x of [null,[],42,'x',{}])assert.equal(validateSourceIntake(x).structurallyValid,false);});
test('rejects duplicate question ids',()=>{const x=sample();x.questions[1].id='q1';assert.equal(has(validateSourceIntake(x),'QUESTION_ID'),true);});
test('rejects duplicate printed item number',()=>{const x=sample();x.questions[1].number='1';assert.equal(has(validateSourceIntake(x),'QUESTION_NUMBER'),true);});
test('requires option wording',()=>{const x=sample();x.questions[0].options[1].text='';assert.equal(has(validateSourceIntake(x),'OPTIONS'),true);});
test('requires a valid answer letter',()=>{const x=sample();x.questions[0].referenceAnswer.text='E';assert.equal(has(validateSourceIntake(x),'ANSWER_KEY'),true);});
test('requires source evidence for answers',()=>{const x=sample();x.questions[0].referenceAnswer.sourceRefs=[];assert.equal(has(validateSourceIntake(x),'SOURCE_REF'),true);});
test('unknown source ids rejected',()=>{const x=sample();x.questions[0].sourceRefs=['missing'];assert.equal(has(validateSourceIntake(x),'SOURCE_REF'),true);});
test('unavailable source is a release hold',()=>{const x=sample();x.assets[0].status='UNAVAILABLE';assert.equal(has(validateSourceIntake(x),'SOURCE_UNAVAILABLE'),true);});
test('off-origin URLs are not accepted',()=>{for(const s of ['javascript:alert(1)','https://evil.example/a','https://www.eeafj.cn.evil.example/a','https://u:p@www.eeafj.cn/u/cms/default/201206/a.jpg','https://www.eeafj.cn:444/u/cms/default/201206/a.jpg'])assert.equal(isOfficialSourceUrl(s),false);});
test('official URL accepted',()=>assert.equal(isOfficialSourceUrl(asset),true));
test('date and duration never inferred',()=>{const r=validateSourceIntake(sample());assert.ok(has(r,'EXAM_DATE_UNKNOWN'));assert.ok(has(r,'DURATION_UNKNOWN'));});
test('rejects wrong total from naïve summation',()=>{const x=sample();x.totalScore=24;assert.ok(has(validateSourceIntake(x),'SCORE_TOTAL'));});
test('rejects group mismatch',()=>{const x=sample();x.selectionGroups[0].questionIds=['a','b'];assert.ok(has(validateSourceIntake(x),'GROUP_MEMBERS'));});
test('rejects invalid choose count',()=>{const x=sample();x.selectionGroups[0].choose=4;assert.ok(has(validateSourceIntake(x),'GROUP_CHOOSE'));});
test('rejects repeated optional item',()=>{const x=sample();x.selectionGroups[0].questionIds=['a','a','c'];assert.ok(has(validateSourceIntake(x),'GROUP_DUPLICATE_MEMBER'));});
test('does not silently score highest two',()=>{const x=sample();x.selectionGroups[0].overAnswerPolicy='BEST_TWO';assert.ok(has(validateSourceIntake(x),'GROUP_POLICY'));});
test('rejects NaN scores',()=>{const x=sample();x.questions[0].maxScore=NaN;assert.ok(has(validateSourceIntake(x),'QUESTION_CONTENT'));});
test('rejects mismatched group score',()=>{const x=sample();x.selectionGroups[0].maxScore=21;assert.ok(has(validateSourceIntake(x),'GROUP_SCORE'));});
test('keeps RAG question and reference separate and disabled',()=>{const r=buildRetrievalDraft(validateSourceIntake(sample()));assert.equal(r.enabled,false);assert.equal(r.documents.length,5);assert.ok(r.documents.every(d=>!d.enabled));assert.equal(r.documents.filter(d=>d.kind==='reference_answer').length,1);});
test('student draft strips answer fields, raw scan URLs and injected extras',()=>{const x=sample();x.questions[0].extraAnswer='LEAK';x.questions[0].rubric='LEAK';const s=JSON.stringify(buildQuestionDraft(validateSourceIntake(x)));assert.ok(!s.includes('referenceAnswer'));assert.ok(!s.includes('LEAK'));assert.ok(!s.includes('eeafj.cn'));});
test('rejects exporting invalid data',()=>{assert.throws(()=>buildRetrievalDraft(validateSourceIntake(null)));assert.throws(()=>buildQuestionDraft(validateSourceIntake(null)));});

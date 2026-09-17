import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GX_BROWSER_MODULE || 'playwright');
const base='http://127.0.0.1:3101';const out='output/source-intake-e2e';fs.mkdirSync(out,{recursive:true});
let ready=false;for(let i=0;i<60;i++){try{if((await fetch(`${base}/api/health`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert.ok(ready,'Next server not ready');
const fixture={schemaVersion:'source-paper/1',id:'browser-original-fixture',title:'原创浏览器结构测试（不是真题）',status:'STAGING',totalScore:3,source:{articleUrl:'https://www.eeafj.cn/systsj/20120608/2148.html'},assets:[{id:'s1',url:'https://www.eeafj.cn/u/cms/default/201206/example.jpg',status:'VISUALLY_READ'}],questions:[{id:'q1',number:'1',type:'single_choice',maxScore:3,stem:'原创测试：1+1=?',options:['1','2','3','4'].map((text,i)=>({key:'ABCD'[i],text})),sourceRefs:['s1'],referenceAnswer:{text:'B',sourceRefs:['s1'],status:'TRANSCRIBED'},reviewStatus:'TRANSCRIBED'}],selectionGroups:[]};
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));const results=[];
try{
 await page.goto(`${base}/admin/papers/intake`);await page.getByLabel('选择来源JSON').waitFor();
 await page.getByLabel('选择来源JSON').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole('status').filter({hasText:'结构校验通过'}).waitFor();results.push('local JSON intake and staged gate');
 await page.getByText('查看参考答案转录（仅内容核验用）').click();await page.getByText('B',{exact:true}).waitFor();results.push('reference answer is explicit review action');
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出 RAG 整理草稿'}).click();const download=await dl;await download.saveAs(`${out}/fixture-rag.json`);const rag=JSON.parse(fs.readFileSync(`${out}/fixture-rag.json`));assert.equal(rag.enabled,false);assert.equal(rag.documents.length,2);results.push('disabled RAG draft export');
 await page.screenshot({path:`${out}/intake-desktop.png`,fullPage:true});
 for(const width of [375,390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);}results.push('375/390/768/1440 widths');
 await page.setViewportSize({width:390,height:900});await page.screenshot({path:`${out}/intake-mobile.png`,fullPage:true});
 await page.getByRole('button',{name:'清空本页',exact:true}).click();await page.getByText('先校题，再开考。').waitFor();
 await page.getByLabel('选择来源JSON').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.getByRole('alert').waitFor();results.push('clear and invalid JSON');
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/results.json`,JSON.stringify({ok:true,results,pageErrors:errors,fixture:'ORIGINAL_SYNTHETIC_NOT_EXAM'},null,2));
} catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});fs.writeFileSync(`${out}/failure.txt`,String(e));throw e;}finally{await browser.close();}

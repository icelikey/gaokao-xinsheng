// Actual Next route checks with original fixtures; no historical question bodies.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GX_BROWSER_MODULE||'playwright');
const base=process.env.GX_BASE_URL||'http://127.0.0.1:3100';
const out='output/archive-e2e';mkdirSync(out,{recursive:true});
for(let n=0;n<60;n++){try{const r=await fetch(base+'/api/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const seed={id:'fixture1',title:'浏览器测试来源（原创占位，无真实试题）',url:'https://gaokao.eol.cn/example',year:2000,subject:'语文',track:'未核定',session:'普通',provider:'test',status:'DISCOVERED',assets:[],examReady:false,ragEnabled:false,contentVerified:false};
const inventory={schemaVersion:'archive-inventory/1',complete:false,generatedAt:'2026-09-19T00:00:00Z',records:[seed,{...seed,id:'fixture2',year:2025,subject:'英语',status:'FETCH_FAILED',failureReason:'测试：缺少听力音频'}]};
const results=[];
try{
 await page.goto(base+'/admin/papers/archive');await page.getByRole('heading',{name:'26年 · 语数英收纳表'}).waitFor();
 assert.equal(await page.locator('.archiveYear').count(),26);results.push('26-year empty matrix');
 await page.getByLabel('载入收纳清单',{exact:true}).setInputFiles({name:'inventory.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(inventory))});
 await page.getByText('已载入 2 条采集记录',{exact:false}).waitFor();assert.equal(await page.locator('.archiveRecord').count(),2);results.push('local-only file import');
 await page.getByRole('button',{name:'2025年英语来源1条',exact:true}).click();assert.equal(await page.locator('.archiveRecord').count(),1);await page.getByText('测试：缺少听力音频',{exact:true}).waitFor();results.push('year/subject filtering keeps gaps');
 await page.getByRole('button',{name:'重置筛选',exact:true}).click();assert.equal(await page.locator('.archiveRecord').count(),2);
 await page.screenshot({path:out+'/archive-desktop.png',fullPage:true});
 for(const width of [375,390,768,1440]){await page.setViewportSize({width,height:900});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`overflow at ${width}`);}results.push('375/390/768/1440 responsive');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/archive-mobile.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出清单',exact:true}).click();await (await download).saveAs(out+'/fixture-export.json');results.push('JSON export');
 await page.getByLabel('载入收纳清单',{exact:true}).setInputFiles({name:'unsafe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...inventory,complete:true}))});
 await page.locator('.archiveError[role="alert"]').waitFor();assert.equal(await page.locator('.archiveRecord').count(),2);results.push('invalid completion rejected without replacing current data');
 assert.equal(errors.length,0);results.push('no page errors');
 writeFileSync(out+'/results.json',JSON.stringify({ok:true,results,pageErrors:errors,fixture:true,notCorpusValidation:true},null,2));
 console.log(JSON.stringify({ok:true,checks:results}));
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true});writeFileSync(out+'/error.txt',String(e));throw e;}
finally{await browser.close();}

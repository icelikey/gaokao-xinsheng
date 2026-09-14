import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
const css = read('apps/web/src/app/retro.css');
const home = read('apps/web/src/app/page.tsx');
const entry = read('apps/web/src/app/exam/page.tsx');
const prefs = read('apps/web/src/components/RetroPreferences.tsx');
const layout = read('apps/web/src/app/layout.tsx');

test('theme loads after existing global styles', () => {
  assert.ok(layout.indexOf('"./globals.css"') < layout.indexOf('"./retro.css"'));
  assert.match(layout, /data-retro-ui="true"/);
});
test('retro palette and material tokens exist', () => {
  for (const value of ['#203f37', '#913a32', '--retro-paper-texture', '--retro-serif']) assert.ok(css.includes(value));
});
test('home sends users to the existing exam route', () => {
  assert.match(home, /href="\/exam"/);
  assert.match(home, /重考入场券/);
  assert.doesNotMatch(home, /Cloud-first|milestones|next\/image/);
});
test('home does not introduce network assets or official score promises', () => {
  assert.doesNotMatch(home, /https?:\/\/|src=/);
  assert.match(home, /AI估分不等于正式高考成绩/);
});
test('all production exam and report surfaces are styled', () => {
  for (const selector of ['.examSetup', '.answerCardPanel', '.questionPanel', '.aiPanel', '.shareCard', '.mistakeCard', '.reportHero']) assert.ok(css.includes(selector));
});
test('theme includes responsive, reduced-motion, focus and print rules', () => {
  for (const rule of ['max-width:760px', 'prefers-reduced-motion', ':focus-visible', '@media print']) assert.ok(css.includes(rule));
});
test('reading preference remains presentation-only and tolerates blocked storage', () => {
  assert.match(prefs, /aria-pressed/);
  assert.match(prefs, /localStorage\.setItem/);
  assert.match(prefs, /catch/);
  assert.doesNotMatch(prefs, /fetch\(|exam-sessions|SUPABASE|API_KEY/);
  assert.match(css, /data-reading="clean"/);
});
test('each catalog input invalidates candidate selection', () => {
  for (const setter of ['setYear', 'setRegion', 'setTrack', 'setSubject']) {
    assert.ok(entry.includes(`invalidateMatch(); ${setter}(`));
  }
  assert.match(entry, /matchController\.current\?\.abort\(\)/);
});
test('start errors are not treated as successful navigation', () => {
  assert.match(entry, /if \(!started\.ok\) throw new Error/);
  assert.match(entry, /startingRef\.current/);
  assert.match(entry, /pendingSession\.current = session/);
});
test('catalog offers an accessible failure/retry state', () => {
  assert.match(entry, /重新读取目录/);
  assert.match(entry, /aria-live="polite"/);
  assert.match(entry, /controller\.signal\.aborted/);
});
test('mini-program keeps original routes and applies the same palette', () => {
  const config = JSON.parse(read('apps/miniprogram/app.json'));
  assert.equal(config.window.navigationBarBackgroundColor, '#203f37');
  assert.deepEqual(config.pages, ['pages/index/index','pages/exam/index','pages/report/index','pages/mistakes/index','pages/share/index']);
  assert.match(read('apps/miniprogram/app.wxss'), /\.page \.choiceButton\.selected/);
});

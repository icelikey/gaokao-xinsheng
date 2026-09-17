/** Browser-safe staging validator. Never publishes content or treats transcription as approval. */
export type SourceAsset = { id: string; url: string; status: string };
export type SourceItem = {
  id: string; number: string; type: string; maxScore: number; selectionGroup: string | null;
  stem: string; options: { key: string; text: string }[];
  parts: { id: string; text: string }[];
  sourceRefs: string[]; referenceAnswer: { text: string | null; sourceRefs: string[]; status: string };
  reviewStatus: string; figureCount: number;
};
export type IntakeIssue = { code: string; message: string; severity: 'error' | 'hold'; questionId?: string };
export type SourcePaper = {
  id: string; title: string; totalScore: number; assets: SourceAsset[]; questions: SourceItem[];
  selectionGroups: { id: string; choose: number; questionIds: string[]; maxScore: number; overAnswerPolicy: string }[];
};
export type IntakeReport = {
  paper: SourcePaper | null; issues: IntakeIssue[]; structurallyValid: boolean;
  canPublish: false; rawScore: number; selectableScore: number; answerCount: number;
};
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown): string => typeof v === 'string' ? v : '';
const texts = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string');
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
export function isOfficialSourceUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'www.eeafj.cn' && !u.username && !u.password && !u.port && !u.hash && !u.search && (u.pathname.startsWith('/u/cms/default/201206/') || u.pathname === '/systsj/20120608/2148.html'); }
  catch { return false; }
}
export function validateSourceIntake(input: unknown): IntakeReport {
  const root = record(input), issues: IntakeIssue[] = [];
  const add = (code: string, message: string, severity: 'error' | 'hold' = 'error', questionId?: string) => issues.push({ code, message, severity, ...(questionId ? { questionId } : {}) });
  if (root.schemaVersion !== 'source-paper/1') add('SCHEMA_VERSION', '只接受 source-paper/1 来源整理包。');
  if (!text(root.id) || !text(root.title)) add('PAPER_ID', '缺少试卷标识或标题。');
  if (!positive(root.totalScore)) add('TOTAL_SCORE', '满分必须是正的有限数。');
  if (!isOfficialSourceUrl(text(record(root.source).articleUrl))) add('SOURCE_URL', '本期只支持已核定的福建考试院来源页。');
  if (!Array.isArray(root.questions) || !root.questions.length || root.questions.length > 200) add('ITEM_COUNT', '结构化题目数必须为1—200；不为满足演示卷题数而补题。');
  if (!Array.isArray(root.assets) || !root.assets.length || root.assets.length > 100) add('ASSET_COUNT', '原始来源清单不能为空且最多100项。');
  if (root.status !== 'STAGING') add('STAGING_ONLY', '本入口只接收STAGING，不能通过JSON字段批准上线。');
  const assets: SourceAsset[] = list(root.assets).slice(0, 100).map(x => { const a = record(x); return { id: text(a.id), url: text(a.url), status: text(a.status) }; });
  const assetIds = new Set<string>();
  for (const a of assets) {
    if (!a.id || assetIds.has(a.id)) add('ASSET_ID', '来源ID缺失或重复。');
    assetIds.add(a.id);
    if (!isOfficialSourceUrl(a.url)) add('ASSET_URL', `来源地址不在允许范围：${a.id}`);
    if (!['VISUALLY_READ', 'UNAVAILABLE', 'DOWNLOADED', 'HUMAN_VERIFIED'].includes(a.status)) add('ASSET_STATUS', `来源状态无效：${a.id}`);
    if (a.status === 'UNAVAILABLE') add('SOURCE_UNAVAILABLE', `来源尚未取得：${a.id}`, 'hold');
  }
  const questions: SourceItem[] = list(root.questions).slice(0, 200).map(x => {
    const q = record(x), ans = record(q.referenceAnswer);
    return { id: text(q.id), number: text(q.number), type: text(q.type), maxScore: positive(q.maxScore) ? q.maxScore : 0,
      selectionGroup: q.selectionGroup == null ? null : text(q.selectionGroup), stem: text(q.stem),
      options: list(q.options).map(o => { const r = record(o); return { key: text(r.key), text: text(r.text) }; }),
      parts: list(q.parts).map(p => { const r = record(p); return { id: text(r.id), text: text(r.text) }; }),
      sourceRefs: texts(q.sourceRefs), referenceAnswer: { text: typeof ans.text === 'string' ? ans.text : null, sourceRefs: texts(ans.sourceRefs), status: text(ans.status) },
      reviewStatus: text(q.reviewStatus), figureCount: list(q.figures).length };
  });
  const ids = new Set<string>(), numbers = new Set<string>();
  const checkRefs = (refs: string[], qid: string, required = true) => {
    if ((required && !refs.length) || refs.some(id => !assetIds.has(id))) add('SOURCE_REF', '来源引用缺失或指向未知页面。', 'error', qid);
    if (refs.some(id => assets.some(a => a.id === id && a.status === 'UNAVAILABLE'))) add('UNREAD_SOURCE', '引用中含未成功读取页面，不能当作核验完成。', 'hold', qid);
  };
  for (const q of questions) {
    if (!q.id || ids.has(q.id)) add('QUESTION_ID', '题目ID缺失或重复。', 'error', q.id);
    if (!q.number || numbers.has(q.number)) add('QUESTION_NUMBER', '原题号缺失或重复。', 'error', q.id);
    ids.add(q.id); numbers.add(q.number);
    if (!q.stem.trim() || q.stem.length > 30000 || !q.maxScore) add('QUESTION_CONTENT', '题干或分值无效。', 'error', q.id);
    if (!['single_choice', 'fill_blank', 'free_response'].includes(q.type)) add('QUESTION_TYPE', '本期暂不支持该题型。', 'error', q.id);
    if (q.type === 'single_choice') {
      const keys = q.options.map(o => o.key);
      if (q.options.length !== 4 || new Set(keys).size !== 4 || keys.some(k => !['A','B','C','D'].includes(k)) || q.options.some(o => !o.text.trim())) add('OPTIONS', '单选题须有ABCD四个不同键及实际选项文字。', 'error', q.id);
      if (q.referenceAnswer.text !== null && !keys.includes(q.referenceAnswer.text)) add('ANSWER_KEY', '参考答案不是本题选项键。', 'error', q.id);
    }
    if (q.parts.some(p => !p.id || !p.text.trim()) || new Set(q.parts.map(p => p.id)).size !== q.parts.length) add('SUBPARTS', '子题标识重复或文本缺失。', 'error', q.id);
    checkRefs(q.sourceRefs, q.id);
    if (q.referenceAnswer.text === null || !q.referenceAnswer.text.trim()) add('ANSWER_MISSING', '参考答案尚未完整取得；不自动补写。', 'hold', q.id);
    else checkRefs(q.referenceAnswer.sourceRefs, q.id);
    if (q.reviewStatus !== 'HUMAN_VERIFIED') add('REVIEW_PENDING', '需要独立题面与答案复核，模型首校不等于人工批准。', 'hold', q.id);
    if (q.figureCount) add('FIGURE_PENDING', '图题需私有素材落地和裁切复核；不要将混有答案的整页图发给考生。', 'hold', q.id);
    if (q.type === 'free_response') add('GRADING_GATE', '参考解答不等于逐步评分细则，主观评分需另行校准。', 'hold', q.id);
  }
  const groups = list(root.selectionGroups).map(x => { const g = record(x); return { id: text(g.id), choose: typeof g.choose === 'number' ? g.choose : 0, questionIds: texts(g.questionIds), maxScore: positive(g.maxScore) ? g.maxScore : 0, overAnswerPolicy: text(g.overAnswerPolicy) }; });
  const groupIds = new Set<string>(), memberships = new Set<string>();
  let rawScore = 0, selectableScore = 0;
  for (const q of questions) { rawScore += q.maxScore; if (q.selectionGroup === null) selectableScore += q.maxScore; }
  for (const g of groups) {
    if (!g.id || groupIds.has(g.id)) add('GROUP_ID', '选考组ID缺失或重复。');
    groupIds.add(g.id);
    if (!Number.isInteger(g.choose) || g.choose < 1 || g.choose > g.questionIds.length || !g.questionIds.length) add('GROUP_CHOOSE', '选考题选择数量不合法。');
    if (g.overAnswerPolicy !== 'FIRST_TWO' && g.overAnswerPolicy !== 'EXPLICIT_SELECTION') add('GROUP_POLICY', '必须保留并核定超答规则，不默认择高分。');
    const members = g.questionIds.map(id => questions.find(q => q.id === id));
    for (const id of g.questionIds) { if (memberships.has(id)) add('GROUP_DUPLICATE_MEMBER', '同一题不能重复或跨组选考。'); memberships.add(id); }
    if (members.some(q => !q || q.selectionGroup !== g.id) || questions.some(q => q.selectionGroup === g.id && !g.questionIds.includes(q.id))) add('GROUP_MEMBERS', '选考组成员与题目双向关系不一致。');
    const scores = members.filter((q): q is SourceItem => !!q).map(q => q.maxScore);
    if (scores.length && scores.some(s => s !== scores[0])) add('GROUP_UNEQUAL_SCORE', '本版仅支持同分选考题；不同分值须单独设计。');
    const expected = (scores[0] ?? 0) * g.choose;
    if (expected !== g.maxScore) add('GROUP_SCORE', '选考组满分与必选数量不一致。');
    selectableScore += expected;
  }
  for (const q of questions) if (q.selectionGroup !== null && !groupIds.has(q.selectionGroup)) add('GROUP_UNKNOWN', '题目指向未知选考组。', 'error', q.id);
  if (selectableScore !== root.totalScore) add('SCORE_TOTAL', `按选考规则计算的满分${selectableScore}，与声明满分${root.totalScore}不一致。`);
  if (!root.durationMinutes) add('DURATION_UNKNOWN', '来源未核定考试时长，不套用默认120分钟。', 'hold');
  if (!root.examDate) add('EXAM_DATE_UNKNOWN', '来源未核定考试日期，发布日期不能当作考试日期。', 'hold');
  add('STAGING_GATE', '已接入来源整理流程，不等于正式考试发布；无自动发布接口。', 'hold');
  return { paper: { id: text(root.id), title: text(root.title), totalScore: positive(root.totalScore) ? root.totalScore : 0, assets, questions, selectionGroups: groups },
    issues, structurallyValid: !issues.some(i => i.severity === 'error'), canPublish: false, rawScore, selectableScore,
    answerCount: questions.filter(q => !!q.referenceAnswer.text?.trim()).length };
}
/** Draft documents stay disabled and preserve exact source/question boundaries. No generated hints. */
export function buildRetrievalDraft(report: IntakeReport) {
  if (!report.structurallyValid || !report.paper) throw new Error('结构校验未通过，不能导出RAG整理草稿。');
  const paper = report.paper;
  return { schemaVersion: 'source-rag-draft/1', paperId: paper.id, enabled: false,
    documents: paper.questions.flatMap(q => [
      { id: `${q.id}:question`, paperId: paper.id, questionId: q.id, kind: 'question', access: 'STAGING_ONLY', enabled: false, text: [q.stem, ...q.options.map(o => `${o.key}. ${o.text}`), ...q.parts.map(p => `${p.id}. ${p.text}`)].join('\n'), sourceRefs: q.sourceRefs },
      ...(q.referenceAnswer.text ? [{ id: `${q.id}:reference`, paperId: paper.id, questionId: q.id, kind: 'reference_answer', access: 'GRADER_ONLY_AFTER_REVIEW', enabled: false, text: q.referenceAnswer.text, sourceRefs: q.referenceAnswer.sourceRefs }] : [])
    ]) };
}
/** A private client draft: whitelist fields, no answers/rubrics/raw mixed scans. Not a release artifact. */
export function buildQuestionDraft(report: IntakeReport) {
  if (!report.structurallyValid || !report.paper) throw new Error('结构校验未通过。');
  return { paperId: report.paper.id, status: 'STAGING', readyForExam: false, questions: report.paper.questions.map(q => ({
    id: q.id, number: q.number, type: q.type, maxScore: q.maxScore, selectionGroup: q.selectionGroup,
    stem: q.stem, options: q.options, parts: q.parts, requiresFigure: q.figureCount > 0
  })) };
}

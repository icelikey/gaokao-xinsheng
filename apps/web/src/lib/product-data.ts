export const productFlow = [
  {
    step: "01",
    title: "选择届次",
    detail: "从“2010届、山东、理科”等记忆入口开始，而不是先注册账号。"
  },
  {
    step: "02",
    title: "匹配试卷",
    detail: "根据年份、地区、科类和科目匹配候选试卷，保留用户确认。"
  },
  {
    step: "03",
    title: "重新作答",
    detail: "支持15分钟快考和完整数学卷，答案自动保存并可恢复。"
  },
  {
    step: "04",
    title: "AI辅导",
    detail: "L1到L4逐级提示，首次AI前原子化保存pre_ai答案快照。"
  },
  {
    step: "05",
    title: "AI估分",
    detail: "客观题确定性评分，主观题按rubric和置信度进入复核。"
  },
  {
    step: "06",
    title: "双成绩单",
    detail: "展示独立作答分、AI协作分、错题解析和分享海报。"
  }
] as const;

export const cloudStack = [
  ["GitHub", "代码真源、PR、CI"],
  ["Vercel Preview", "流程预览、后台、分享页、轻API"],
  ["Supabase Postgres", "题库、答案版本、评分、审计"],
  ["Supabase Storage", "题图、海报、附件"],
  ["Supabase Queues", "批改、复核、海报异步任务"],
  ["AI Gateway", "模型路由、Prompt版本、成本与审计"]
] as const;

export const milestones = [
  ["M1", "项目骨架与云端环境", "PR可生成Preview，migration可重复执行"],
  ["M2", "数据模型与题库后台", "后台可导入30到50道数学题"],
  ["M3", "考试闭环", "保存、恢复、交卷幂等"],
  ["M4", "AI辅导闭环", "L1/L2黄金集不泄题"],
  ["M5", "AI批改闭环", "报告有逐题证据"],
  ["M6", "分享与运营", "海报和公开页边界不溢出"],
  ["M7", "小程序真机与上线准备", "真机跑通且阻断项清零"]
] as const;

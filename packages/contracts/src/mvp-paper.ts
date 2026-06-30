export type MvpQuestionType = "single_choice" | "fill_blank" | "free_response";

export type MvpRubricItem = {
  id: string;
  name: string;
  score: number;
};

export type MvpQuestion = {
  id: string;
  orderNo: number;
  section: "选择题" | "填空题" | "解答题";
  type: MvpQuestionType;
  stem: string;
  maxScore: number;
  answer: string;
  options?: string[];
  rubric?: MvpRubricItem[];
};

export type MvpPaper = {
  id: string;
  title: string;
  year: number;
  region: string;
  track: string;
  subject: string;
  paperType: "QUICK_15";
  totalScore: number;
  durationMinutes: number;
  status: "PREVIEW";
  questions: MvpQuestion[];
};

export type PublicMvpQuestion = Omit<MvpQuestion, "answer" | "rubric">;

export type PublicMvpPaper = Omit<MvpPaper, "questions"> & {
  questions: PublicMvpQuestion[];
};

const choiceOptions = ["A", "B", "C", "D"];

const freeRubric = (maxScore: number): MvpRubricItem[] => [
  { id: "r1", name: "关键结论正确", score: maxScore * 0.6 },
  { id: "r2", name: "步骤或依据清晰", score: maxScore * 0.4 }
];

export const mvpPaper: MvpPaper = {
  id: "paper_2010_sd_math_sci_mvp",
  title: "2010届山东理科数学MVP精选卷",
  year: 2010,
  region: "山东",
  track: "理科",
  subject: "数学",
  paperType: "QUICK_15",
  totalScore: 150,
  durationMinutes: 15,
  status: "PREVIEW",
  questions: [
    {
      id: "q_2010_sd_math_01",
      orderNo: 1,
      section: "选择题",
      type: "single_choice",
      stem: "集合A={x|x>1}, B={x|x<4}, A∩B为",
      maxScore: 5,
      answer: "B",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_02",
      orderNo: 2,
      section: "选择题",
      type: "single_choice",
      stem: "函数f(x)=x^2-2x的对称轴为",
      maxScore: 5,
      answer: "C",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_03",
      orderNo: 3,
      section: "选择题",
      type: "single_choice",
      stem: "若sinθ=1/2且θ为锐角，则θ为",
      maxScore: 5,
      answer: "A",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_04",
      orderNo: 4,
      section: "选择题",
      type: "single_choice",
      stem: "等差数列首项2、公差3，第5项为",
      maxScore: 5,
      answer: "D",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_05",
      orderNo: 5,
      section: "选择题",
      type: "single_choice",
      stem: "抛物线y=x^2的焦点在",
      maxScore: 5,
      answer: "B",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_06",
      orderNo: 6,
      section: "选择题",
      type: "single_choice",
      stem: "复数i^2等于",
      maxScore: 5,
      answer: "A",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_07",
      orderNo: 7,
      section: "选择题",
      type: "single_choice",
      stem: "函数y=ln x的定义域为",
      maxScore: 5,
      answer: "C",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_08",
      orderNo: 8,
      section: "选择题",
      type: "single_choice",
      stem: "若向量a=(1,2), b=(3,0)，a·b=",
      maxScore: 5,
      answer: "B",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_09",
      orderNo: 9,
      section: "选择题",
      type: "single_choice",
      stem: "不等式x^2-1>0的解集为",
      maxScore: 5,
      answer: "D",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_10",
      orderNo: 10,
      section: "选择题",
      type: "single_choice",
      stem: "圆x^2+y^2=4的半径为",
      maxScore: 5,
      answer: "A",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_11",
      orderNo: 11,
      section: "选择题",
      type: "single_choice",
      stem: "二项式(x+1)^3中x^2项系数为",
      maxScore: 5,
      answer: "C",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_12",
      orderNo: 12,
      section: "选择题",
      type: "single_choice",
      stem: "函数f(x)=2x+1的反函数为",
      maxScore: 5,
      answer: "B",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_13",
      orderNo: 13,
      section: "填空题",
      type: "fill_blank",
      stem: "若log2 x=3，则x=",
      maxScore: 5,
      answer: "8"
    },
    {
      id: "q_2010_sd_math_14",
      orderNo: 14,
      section: "填空题",
      type: "fill_blank",
      stem: "等比数列首项3、公比2，第4项为",
      maxScore: 5,
      answer: "24"
    },
    {
      id: "q_2010_sd_math_15",
      orderNo: 15,
      section: "填空题",
      type: "fill_blank",
      stem: "直线y=3x+2的斜率为",
      maxScore: 5,
      answer: "3"
    },
    {
      id: "q_2010_sd_math_16",
      orderNo: 16,
      section: "填空题",
      type: "fill_blank",
      stem: "若C(5,2)=",
      maxScore: 5,
      answer: "10"
    },
    {
      id: "q_2010_sd_math_17",
      orderNo: 17,
      section: "填空题",
      type: "fill_blank",
      stem: "函数f(x)=x^3的导数为",
      maxScore: 5,
      answer: "3x^2"
    },
    {
      id: "q_2010_sd_math_18",
      orderNo: 18,
      section: "填空题",
      type: "fill_blank",
      stem: "sin^2x+cos^2x=",
      maxScore: 5,
      answer: "1"
    },
    {
      id: "q_2010_sd_math_19",
      orderNo: 19,
      section: "解答题",
      type: "free_response",
      stem: "已知函数f(x)=x^2-4x+3，求其零点并说明步骤。",
      maxScore: 5,
      answer: "x=1,3",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_20",
      orderNo: 20,
      section: "解答题",
      type: "free_response",
      stem: "已知数列an=2n+1，求前10项和。",
      maxScore: 5,
      answer: "120",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_21",
      orderNo: 21,
      section: "解答题",
      type: "free_response",
      stem: "求圆x^2+y^2-4x=0的圆心和半径。",
      maxScore: 5,
      answer: "圆心(2,0),半径2",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_22",
      orderNo: 22,
      section: "解答题",
      type: "free_response",
      stem: "已知向量a=(2,1), b=(1,-1)，求a+b与a·b。",
      maxScore: 5,
      answer: "a+b=(3,0), a·b=1",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_23",
      orderNo: 23,
      section: "解答题",
      type: "free_response",
      stem: "解不等式2x-5<3，并写出解集。",
      maxScore: 5,
      answer: "x<4",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_24",
      orderNo: 24,
      section: "解答题",
      type: "free_response",
      stem: "求函数f(x)=x^2在区间[0,2]上的最大值和最小值。",
      maxScore: 5,
      answer: "最小0,最大4",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_25",
      orderNo: 25,
      section: "选择题",
      type: "single_choice",
      stem: "若tanθ=1且θ为锐角，则θ为",
      maxScore: 5,
      answer: "A",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_26",
      orderNo: 26,
      section: "选择题",
      type: "single_choice",
      stem: "函数y=2^x恒过点",
      maxScore: 5,
      answer: "B",
      options: choiceOptions
    },
    {
      id: "q_2010_sd_math_27",
      orderNo: 27,
      section: "填空题",
      type: "fill_blank",
      stem: "若x^2=16且x>0，则x=",
      maxScore: 5,
      answer: "4"
    },
    {
      id: "q_2010_sd_math_28",
      orderNo: 28,
      section: "填空题",
      type: "fill_blank",
      stem: "平面内两点(0,0),(3,4)距离为",
      maxScore: 5,
      answer: "5"
    },
    {
      id: "q_2010_sd_math_29",
      orderNo: 29,
      section: "解答题",
      type: "free_response",
      stem: "已知直线经过(0,1)和(2,5)，求直线方程。",
      maxScore: 5,
      answer: "y=2x+1",
      rubric: freeRubric(5)
    },
    {
      id: "q_2010_sd_math_30",
      orderNo: 30,
      section: "解答题",
      type: "free_response",
      stem: "求函数f(x)=x^2-2x+2的最小值。",
      maxScore: 5,
      answer: "1",
      rubric: freeRubric(5)
    }
  ]
};

export function getMvpPaper(paperId = mvpPaper.id): MvpPaper | undefined {
  return paperId === mvpPaper.id ? mvpPaper : undefined;
}

export function toPublicMvpPaper(paper: MvpPaper): PublicMvpPaper {
  return {
    ...paper,
    questions: paper.questions.map(({ answer: _answer, rubric: _rubric, ...question }) => question)
  };
}

export function getPublicMvpPaper(paperId = mvpPaper.id): PublicMvpPaper | undefined {
  const paper = getMvpPaper(paperId);
  return paper ? toPublicMvpPaper(paper) : undefined;
}

export function getMvpQuestionStats(paper: MvpPaper = mvpPaper) {
  return paper.questions.reduce(
    (stats, question) => {
      stats.total += 1;
      stats.maxScore += question.maxScore;
      stats.byType[question.type] += 1;
      return stats;
    },
    {
      total: 0,
      maxScore: 0,
      byType: {
        single_choice: 0,
        fill_blank: 0,
        free_response: 0
      } satisfies Record<MvpQuestionType, number>
    }
  );
}

insert into public.papers (
  id,
  title,
  year,
  region,
  track,
  subject,
  paper_type,
  total_score,
  duration_minutes,
  status
) values (
  'paper_2010_sd_math_sci_mvp',
  '2010届山东理科数学MVP精选卷',
  2010,
  '山东',
  '理科',
  '数学',
  'QUICK_15',
  150,
  15,
  'PREVIEW'
) on conflict (id) do nothing;

insert into public.paper_mapping_rules (
  id,
  year,
  region,
  region_code,
  track,
  subject,
  mode,
  paper_id,
  confidence,
  explanation,
  status
) values (
  'pmr_2010_sd_math_sci_quick',
  2010,
  '山东',
  'SD',
  '理科',
  '数学',
  'QUICK_15',
  'paper_2010_sd_math_sci_mvp',
  0.960,
  'MVP首发精选卷：2010届山东理科数学，15分钟快考版本。',
  'ACTIVE'
) on conflict (id) do nothing;

insert into public.sections (paper_id, title, order_no, max_score)
values
  ('paper_2010_sd_math_sci_mvp', '选择题', 1, 70),
  ('paper_2010_sd_math_sci_mvp', '填空题', 2, 40),
  ('paper_2010_sd_math_sci_mvp', '解答题', 3, 40)
on conflict (paper_id, order_no) do nothing;

with section_map as (
  select id, title from public.sections where paper_id = 'paper_2010_sd_math_sci_mvp'
),
question_seed as (
  select *
  from (values
    (1, 'single_choice', '集合A={x|x>1}, B={x|x<4}, A∩B为', 'B', 5),
    (2, 'single_choice', '函数f(x)=x^2-2x的对称轴为', 'C', 5),
    (3, 'single_choice', '若sinθ=1/2且θ为锐角，则θ为', 'A', 5),
    (4, 'single_choice', '等差数列首项2、公差3，第5项为', 'D', 5),
    (5, 'single_choice', '抛物线y=x^2的焦点在', 'B', 5),
    (6, 'single_choice', '复数i^2等于', 'A', 5),
    (7, 'single_choice', '函数y=ln x的定义域为', 'C', 5),
    (8, 'single_choice', '若向量a=(1,2), b=(3,0)，a·b=', 'B', 5),
    (9, 'single_choice', '不等式x^2-1>0的解集为', 'D', 5),
    (10, 'single_choice', '圆x^2+y^2=4的半径为', 'A', 5),
    (11, 'single_choice', '二项式(x+1)^3中x^2项系数为', 'C', 5),
    (12, 'single_choice', '函数f(x)=2x+1的反函数为', 'B', 5),
    (13, 'fill_blank', '若log2 x=3，则x=', '8', 5),
    (14, 'fill_blank', '等比数列首项3、公比2，第4项为', '24', 5),
    (15, 'fill_blank', '直线y=3x+2的斜率为', '3', 5),
    (16, 'fill_blank', '若C(5,2)=', '10', 5),
    (17, 'fill_blank', '函数f(x)=x^3的导数为', '3x^2', 5),
    (18, 'fill_blank', 'sin^2x+cos^2x=', '1', 5),
    (19, 'free_response', '已知函数f(x)=x^2-4x+3，求其零点并说明步骤。', 'x=1,3', 5),
    (20, 'free_response', '已知数列an=2n+1，求前10项和。', '120', 5),
    (21, 'free_response', '求圆x^2+y^2-4x=0的圆心和半径。', '圆心(2,0),半径2', 5),
    (22, 'free_response', '已知向量a=(2,1), b=(1,-1)，求a+b与a·b。', 'a+b=(3,0), a·b=1', 5),
    (23, 'free_response', '解不等式2x-5<3，并写出解集。', 'x<4', 5),
    (24, 'free_response', '求函数f(x)=x^2在区间[0,2]上的最大值和最小值。', '最小0,最大4', 5),
    (25, 'single_choice', '若tanθ=1且θ为锐角，则θ为', 'A', 5),
    (26, 'single_choice', '函数y=2^x恒过点', 'B', 5),
    (27, 'fill_blank', '若x^2=16且x>0，则x=', '4', 5),
    (28, 'fill_blank', '平面内两点(0,0),(3,4)距离为', '5', 5),
    (29, 'free_response', '已知直线经过(0,1)和(2,5)，求直线方程。', 'y=2x+1', 5),
    (30, 'free_response', '求函数f(x)=x^2-2x+2的最小值。', '1', 5)
  ) as q(order_no, type, stem, answer, max_score)
)
insert into public.questions (
  id,
  paper_id,
  section_id,
  order_no,
  type,
  stem_json,
  input_schema,
  max_score
)
select
  'q_2010_sd_math_' || lpad(order_no::text, 2, '0'),
  'paper_2010_sd_math_sci_mvp',
  case
    when order_no <= 12 then (select id from section_map where title = '选择题')
    when order_no <= 18 then (select id from section_map where title = '填空题')
    else (select id from section_map where title = '解答题')
  end,
  order_no,
  type::public.question_type,
  jsonb_build_array(jsonb_build_object('type', 'paragraph', 'text', stem)),
  case
    when type = 'single_choice' then '{"options":["A","B","C","D"]}'::jsonb
    else '{}'::jsonb
  end,
  max_score
from question_seed
on conflict (id) do nothing;

with question_seed as (
  select *
  from (values
    (1, 'B'), (2, 'C'), (3, 'A'), (4, 'D'), (5, 'B'), (6, 'A'),
    (7, 'C'), (8, 'B'), (9, 'D'), (10, 'A'), (11, 'C'), (12, 'B'),
    (13, '8'), (14, '24'), (15, '3'), (16, '10'), (17, '3x^2'), (18, '1'),
    (19, 'x=1,3'), (20, '120'), (21, '圆心(2,0),半径2'), (22, 'a+b=(3,0), a·b=1'),
    (23, 'x<4'), (24, '最小0,最大4'), (25, 'A'), (26, 'B'), (27, '4'), (28, '5'),
    (29, 'y=2x+1'), (30, '1')
  ) as q(order_no, answer)
)
insert into public.answer_keys (question_id, version, canonical_answer, equivalence_rules)
select
  'q_2010_sd_math_' || lpad(order_no::text, 2, '0'),
  1,
  jsonb_build_object('value', answer),
  jsonb_build_object('mvp', true)
from question_seed
on conflict (question_id, version) do nothing;

insert into public.grading_rubrics (question_id, version, rubric_items_json)
select
  id,
  1,
  jsonb_build_array(
    jsonb_build_object('rubric_id', 'r1', 'name', '关键结论正确', 'score', max_score * 0.6),
    jsonb_build_object('rubric_id', 'r2', 'name', '步骤或依据清晰', 'score', max_score * 0.4)
  )
from public.questions
where paper_id = 'paper_2010_sd_math_sci_mvp'
  and type = 'free_response'
on conflict (question_id, version) do nothing;

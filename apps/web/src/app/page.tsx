import Link from "next/link";

export default function HomePage() {
  return (
    <main className="retroHome" id="main-content">
      <header className="retroNav">
        <Link className="retroBrand" href="/" aria-label="高考新生首页"><span>新</span>高考新生<small>重新作答 · 重新出发</small></Link>
        <nav aria-label="主要导航"><Link href="/exam">进入考场</Link><a href="#about-experience">本次体验</a><Link href="/admin">教务室</Link></nav>
      </header>
      <section className="retroFoyer" aria-labelledby="welcome-title">
        <div className="retroBlackboard">
          <div className="retroBoardTop"><span>致每一个曾经的考生</span><span>此刻，重新落笔</span></div>
          <p className="retroKicker">那些年，没写完的故事</p>
          <h1 id="welcome-title">高考新生</h1>
          <p className="retroChalkLine">那张试卷，<br />这次慢慢答。</p>
          <p className="retroBoardCopy">找回你的那一届，重新面对熟悉的题目。<br />不会时可以问，没做完也可以暂停。</p>
          <div className="retroBoardFooter"><span>再考一次，不必再做一次当年的自己。</span><i aria-hidden="true" /></div>
        </div>
        <div className="retroDesk">
          <article className="retroAdmission" aria-labelledby="admission-title">
            <span className="retroClip" aria-hidden="true" />
            <div className="retroTicketTop"><span>高考新生 · 考生登记处</span><span>体验用</span></div>
            <h2 id="admission-title">重考入场券</h2>
            <p className="retroEnglish">A NEW CHAPTER, YOUR OWN ANSWER.</p>
            <div className="retroTicketRule" />
            <dl className="retroTicketFields">
              <div><dt>考生</dt><dd>今天的你</dd></div>
              <div><dt>届次</dt><dd>你的那一年<span>进入后选择</span></dd></div>
              <div><dt>科目</dt><dd>数学<span>以已收录试卷为准</span></dd></div>
            </dl>
            <div className="retroAdmissionNote"><strong>考生须知</strong><p>这一次，允许求助。<br />每一段写下的思路，都值得认真对待。</p></div>
            <Link className="primaryButton retroEnter" href="/exam">找到我的试卷<span aria-hidden="true">→</span></Link>
            <p className="retroTicketFoot">无需填写当年分数，也可以开始。</p>
          </article>
          <div className="retroDeskNote" aria-hidden="true">愿你写下的，不只是答案。</div>
        </div>
      </section>
      <section className="retroProcess" aria-label="重考流程">
        <div><b>01</b><span>找到原卷<small>选择你的届次</small></span></div>
        <div><b>02</b><span>重新作答<small>保留每一步思路</small></span></div>
        <div><b>03</b><span>按需辅导<small>不会时，问一问</small></span></div>
        <div><b>04</b><span>认真评阅<small>看懂给分的依据</small></span></div>
        <div><b>05</b><span>留一份纪念<small>分享由你决定</small></span></div>
      </section>
      <section className="retroPrinciples" id="about-experience" aria-labelledby="experience-title">
        <div className="retroSectionTitle"><span>这一次，有些不同</span><h2 id="experience-title">回到熟悉的考场，<br />带上今天的选择。</h2></div>
        <article><span className="retroCardNumber">一</span><h3>不懂，可以再讲一遍</h3><p>从读懂题目到逐步讲解，按需选择帮助，而不是直接跳到标准答案。</p></article>
        <article><span className="retroCardNumber">二</span><h3>批改，也看见过程</h3><p>查看本次作答的评分依据；识别有误或解法不同，可以提出复核。</p></article>
        <article><span className="retroCardNumber">三</span><h3>不晒分，也能纪念</h3><p>保留自己的记录，或自主选择公开的内容。没有排名，也不必与谁比较。</p></article>
      </section>
      <footer className="retroFooter"><strong>高考新生</strong><p>当前为产品预览，内容与评分能力以进入后的说明为准。AI估分不等于正式高考成绩。</p><Link href="/exam">准备好了，进入考场 →</Link></footer>
    </main>
  );
}

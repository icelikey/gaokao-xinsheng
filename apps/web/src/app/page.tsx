import Image from "next/image";
import Link from "next/link";
import { cloudStack, milestones, productFlow } from "@/lib/product-data";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">Cloud-first MVP</p>
          <h1>高考新生</h1>
          <p className="lead">
            选择你的届次，重新完成那场考试。AI陪你作答，AI为你评卷。
          </p>
          <div className="heroActions">
            <Link className="primaryButton" href="/exam">
              开始流程预览
            </Link>
            <Link className="secondaryButton" href="/admin">
              查看运营后台
            </Link>
          </div>
        </div>
        <div className="previewFrame">
          <Image
            src="/preview/gaokao-xinsheng-product-preview.png"
            alt="高考新生产品预览图"
            width={1600}
            height={900}
            priority
          />
        </div>
      </section>

      <section className="band">
        <div className="sectionHeader">
          <p className="eyebrow">MVP Flow</p>
          <h2>先跑通一条可信闭环</h2>
        </div>
        <div className="flowGrid">
          {productFlow.map((item) => (
            <article className="flowCard" key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split">
        <div>
          <p className="eyebrow">Stack</p>
          <h2>GitHub + Vercel + Supabase</h2>
          <p>
            GitHub管理代码与迁移，Vercel提供持续预览，Supabase承担数据库、存储和异步队列。本机只做流程效果与美工确认。
          </p>
        </div>
        <div className="stackList">
          {cloudStack.map(([name, detail]) => (
            <div className="stackItem" key={name}>
              <strong>{name}</strong>
              <span>{detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="sectionHeader">
          <p className="eyebrow">Milestones</p>
          <h2>12周目标拆分</h2>
        </div>
        <div className="milestoneTable" role="table" aria-label="MVP milestones">
          {milestones.map(([id, title, proof]) => (
            <div className="milestoneRow" role="row" key={id}>
              <strong>{id}</strong>
              <span>{title}</span>
              <em>{proof}</em>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { mvpPaper, type PaperImportPayload } from "@gaokao-xinsheng/contracts";
import { ImportPaperClient } from "./ImportPaperClient";

const samplePaper: PaperImportPayload = mvpPaper;

export default function AdminPaperImportPage() {
  return (
    <main className="adminPage">
      <header className="topbar">
        <Link href="/admin/papers">题库</Link>
        <span>题库导入</span>
      </header>

      <section className="paperHeader">
        <div>
          <p className="eyebrow">Import</p>
          <h1>题库导入演练</h1>
          <p>
            先校验 30 题 MVP 试卷、卷面总分、答案键和解答题 rubric，再允许进入云端导入批次。
          </p>
        </div>
        <Link className="secondaryButton darkButton" href="/admin/papers">
          返回题库
        </Link>
      </section>

      <ImportPaperClient samplePaper={samplePaper} />
    </main>
  );
}

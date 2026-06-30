import { NextResponse } from "next/server";
import { getMvpQuestionStats, mvpPaper } from "@gaokao-xinsheng/contracts";

export function GET() {
  const stats = getMvpQuestionStats(mvpPaper);

  return NextResponse.json({
    request_id: crypto.randomUUID(),
    data: [
      {
        id: mvpPaper.id,
        title: mvpPaper.title,
        year: mvpPaper.year,
        region: mvpPaper.region,
        track: mvpPaper.track,
        subject: mvpPaper.subject,
        paper_type: mvpPaper.paperType,
        total_score: mvpPaper.totalScore,
        duration_minutes: mvpPaper.durationMinutes,
        status: mvpPaper.status,
        question_count: stats.total
      }
    ],
    error: null
  });
}

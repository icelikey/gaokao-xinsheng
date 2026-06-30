import { ExamClient } from "./ExamClient";

type ExamPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ExamPage({ params }: ExamPageProps) {
  const { sessionId } = await params;

  return <ExamClient sessionId={sessionId} />;
}

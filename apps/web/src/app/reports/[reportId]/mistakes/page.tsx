import { MistakesClient } from "./MistakesClient";

type MistakesPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function MistakesPage({ params }: MistakesPageProps) {
  const { reportId } = await params;

  return <MistakesClient reportId={reportId} />;
}

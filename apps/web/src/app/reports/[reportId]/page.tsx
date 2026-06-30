import { ReportClient } from "./ReportClient";

type ReportPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { reportId } = await params;

  return <ReportClient reportId={reportId} />;
}

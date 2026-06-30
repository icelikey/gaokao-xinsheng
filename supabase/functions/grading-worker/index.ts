type GradingJobPayload = {
  job_id: string;
  session_id: string;
};

Deno.serve(async (request) => {
  const payload = (await request.json().catch(() => null)) as GradingJobPayload | null;

  if (!payload?.job_id || !payload.session_id) {
    return Response.json(
      { error: "INVALID_GRADING_JOB_PAYLOAD" },
      { status: 400 }
    );
  }

  return Response.json({
    status: "accepted",
    job_id: payload.job_id,
    session_id: payload.session_id,
    note: "MVP stub: wire this function to Supabase Queues before enabling real grading."
  });
});

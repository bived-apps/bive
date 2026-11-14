export type CiRun = {
  url: string;
  checkName: string;
  headSha?: string;
  testedSha?: string;
  baseSha?: string;
  mergeOf?: { head: string; base: string };
  workflowFromBase: boolean;
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "pending" | "neutral";
  totalTests?: number;
  passedTests?: number;
  skippedTests?: number;
  requiredMarkersSkipped?: string[];
  command?: string;
};

export type Review = {
  reviewedHead: string;
  currentBase: string;
  expectedCommand: string;
  changedInputsSinceRun?: boolean;
  localOnly?: boolean;
};

export function canReuse(
  run: CiRun | undefined,
  review: Review,
): { reuse: true; line: string } | { reuse: false; reasons: string[] } {
  if (!run) return { reuse: false, reasons: ["run absent"] };

  const reasons: string[] = [];
  if (run.conclusion === "pending") reasons.push("run is still running");
  else if (run.conclusion !== "success") reasons.push(`run conclusion is ${run.conclusion}`);

  const syntheticMergeMatches =
    run.mergeOf?.head === review.reviewedHead &&
    run.mergeOf.base === review.currentBase;
  if (run.headSha !== review.reviewedHead && !syntheticMergeMatches) {
    reasons.push("run head is stale");
  }
  if (!run.workflowFromBase) reasons.push("workflow is not trusted from the base");
  if (run.totalTests === undefined || run.passedTests !== run.totalTests) {
    reasons.push("run does not cover the whole suite");
  }
  if ((run.skippedTests ?? 0) > 0) reasons.push("run skipped tests");
  if ((run.requiredMarkersSkipped?.length ?? 0) > 0) {
    reasons.push("run skipped required markers");
  }
  if (run.command !== review.expectedCommand) reasons.push("command differs from expected command");
  if (review.changedInputsSinceRun) reasons.push("inputs changed since the run");
  if (review.localOnly) reasons.push("check is local-only");

  if (reasons.length > 0) return { reuse: false, reasons };
  return {
    reuse: true,
    line: `CI ${run.url} head ${review.reviewedHead} base ${review.currentBase}: tests ${run.passedTests}/${run.totalTests}, no skips`,
  };
}

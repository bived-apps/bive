// Branch hygiene: an issue branch must start from the integration base, not from a sibling.
// Detects inherited commits and merge commits that a later pull request would wrongly carry.
// Contract: issue #73.

export function hasInheritedCommits(baseCommits: Set<string>, branchCommits: string[]): boolean {
  // A branch commit that is also a base commit was inherited.
  return branchCommits.some((c) => baseCommits.has(c))
}

export function hasMergeCommits(mergeCommits: string[]): boolean {
  return mergeCommits.length > 0
}

export function isCleanBranch(baseCommits: Set<string>, branchCommits: string[], mergeCommits: string[]): boolean {
  return !hasInheritedCommits(baseCommits, branchCommits) && !hasMergeCommits(mergeCommits)
}
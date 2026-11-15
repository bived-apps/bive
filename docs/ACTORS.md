# Actors (issue #237)

GitHub shows every agent action as `bive-agents[bot]` (`actor.type: "Bot"`, `performed_via_github_app`) and the
owner's login for the owner; the role is proven by the Git author (`coordinator <provider/model>` / `delegate
<provider/model>`) and the signed comment suffix (`— <role> <provider/model>`). A session started without the
App token acts as the owner's login, so its comments must still be signed.

## End to end

| Step | Who acts | GitHub actor | Proof of role |
| --- | --- | --- | --- |
| Claim the issue | coordinator | `bive-agents[bot]` | signed comment |
| Implement and push the branch | delegate | `delegate <provider/model>` author | push: existing git credentials, #236 |
| Open the pull request | coordinator only, never the delegate | `bive-agents[bot]` | delegate author + report |
| Review and hand over | coordinator | `bive-agents[bot]` | Ready to merge comment; no App approval (#238 declined) |
| Apply the dated label | owner only | the owner's login | the gate refuses an App-applied label |
| Merge | owner only | the owner's login | the GitHub merge commit |
| Close the issue after a reachable merge commit | coordinator | `bive-agents[bot]` | merge commit reachable from base |
| An advisor answers | advisor | no GitHub action | advice is not authorization |

## No self-approval

The author of a change never authorizes its merge; only the owner's label does.

## Conflicts with current rules

None found. Open point for the coordinator: the `AGENTS.md` wording assumes per-role Apps (issue #237 adapts it to the
one App, owner decision 2026-11-14).

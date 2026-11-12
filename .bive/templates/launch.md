# Launch #<milestone> <title>

Branch `milestone/<name>` · coordinator clone `<dir>` · model `<provider/model>`

Read: (mandatory; every list non-empty)

- Open issues: #<n>, #<n>, …
- Rule files: `AGENTS.md` › <section>, `.bive/prompts/COORDINATOR.md` › <step>, …
- Existing files: `<path>`, `<path>`, …

Fill-ins only: milestone, branch, model, the owner's narrowing. The rules live in AGENTS.md and the role prompt,
not here (see #118). A hand-over whose Read: is empty or missing is returned to the supervisor before any split.
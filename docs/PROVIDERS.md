# Provider fallback

No probe by default. Each role lists models in order in `.bive/models.json`; when a call fails (unreachable, 429,
quota), the coordinator retries the same brief with the next model and says so in the report. When every model of
the list failed, a project can offer a provider search: a script (or MCP tool) that tries every model OpenCode knows with one
tiny prompt and prints the ones that answer, fastest first, as a `.bive/models.json` line. A delegate's work that a
reviewer rejects is redone by the next model, not patched by the same one.

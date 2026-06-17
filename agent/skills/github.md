Use when Jake asks about GitHub — repos, issues, pull requests, code search, "what's open on X repo", "find the PR for Y", "open an issue", or anything that needs the real state of a repository.

Steps:
1. Call the `github` tool — never answer repo/issue/PR questions from memory. Pass `action` plus the fields it needs:
   - Repo-scoped actions (`get_repo`, `list_issues`, `get_issue`, `list_pull_requests`, `get_pull_request`, `create_issue`) require `owner` and `repo`.
   - Number-scoped actions (`get_issue`, `get_pull_request`) also need `number`.
   - Search actions (`search_repos`, `search_issues`, `search_code`) take a `query`. You can use GitHub qualifiers, e.g. `repo:vercel-labs/personal-agent-template is:open label:bug`.
   - `list_repos` lists repos the token can see; no owner/repo needed.
2. For "open" work, prefer `state: "open"` (the default). `list_issues` already filters PRs out of the issue list.
3. If the tool errors with `GITHUB_TOKEN is not configured`, tell Jake plainly that GitHub isn't connected yet and how to set the token — don't pretend you looked.
4. If a search returns nothing, broaden the query (drop a qualifier, widen the term) before concluding there's nothing there. Say what you filtered on in one line.

Writes:
- `create_issue` is the only outward action. It is gated on approval — draft the `title` and `body` first, show Jake, and only call it once he confirms in the moment. Never open an issue, comment, or otherwise act on a repo on Jake's behalf without that confirmation.

Output: lead with the answer (the count, the title, the status), then list items as `owner/repo#number — title (state)`. Keep it scannable; match Jake's energy.

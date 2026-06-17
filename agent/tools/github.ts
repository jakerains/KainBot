import { defineTool } from "eve/tools";
import { z } from "zod";
import { githubFetch } from "../lib/github.js";

// Action-dispatch GitHub tool. Read actions run freely; the one outward
// write (create_issue) is gated by a needsApproval predicate so Kain never
// acts on a repo without Jake's in-the-moment confirmation.

const inputSchema = z.object({
  action: z
    .enum([
      "list_repos",
      "get_repo",
      "search_repos",
      "list_issues",
      "get_issue",
      "search_issues",
      "list_pull_requests",
      "get_pull_request",
      "search_code",
      "create_issue",
    ])
    .describe("Which GitHub operation to run"),
  owner: z.string().optional().describe("Repo owner / org (e.g. 'vercel-labs'). Required for repo-scoped actions."),
  repo: z.string().optional().describe("Repo name (e.g. 'personal-agent-template'). Required for repo-scoped actions."),
  number: z.number().int().optional().describe("Issue or pull request number, for get_issue / get_pull_request."),
  query: z.string().optional().describe("Search query. GitHub search qualifiers allowed (e.g. 'is:open label:bug')."),
  state: z.enum(["open", "closed", "all"]).optional().describe("Filter for list_issues / list_pull_requests. Default 'open'."),
  title: z.string().optional().describe("Title for create_issue."),
  body: z.string().optional().describe("Body markdown for create_issue."),
  perPage: z.number().int().min(1).max(100).optional().describe("Results per page (max 100). Default 20."),
});

function requireRepo(input: z.infer<typeof inputSchema>) {
  if (!input.owner || !input.repo) {
    throw new Error(`Action '${input.action}' requires both 'owner' and 'repo'`);
  }
  return { owner: input.owner, repo: input.repo };
}

export default defineTool({
  description:
    "Read GitHub via the REST API: list/get/search repos, issues, pull requests, and code. "
    + "Use this instead of guessing about repos or issues. The single write action, 'create_issue', "
    + "opens an issue on a repo and requires Jake's approval before it runs — drafting the title/body "
    + "first and confirming is the expected flow. Uses a shared fine-grained token (GITHUB_TOKEN); "
    + "if it is missing, say so plainly instead of pretending.",
  inputSchema,
  // Only the outward write needs a human. Reads pass through untouched.
  // toolInput is optional on the approval context, so guard with optional chaining.
  needsApproval: ({ toolInput }) => toolInput?.action === "create_issue",
  async execute(input) {
    const perPage = input.perPage ?? 20;

    switch (input.action) {
      case "list_repos": {
        const data = await githubFetch(
          `/user/repos?per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`,
        );
        return { repos: data };
      }
      case "get_repo": {
        const { owner, repo } = requireRepo(input);
        return { repo: await githubFetch(`/repos/${owner}/${repo}`) };
      }
      case "search_repos": {
        if (!input.query) throw new Error("search_repos requires 'query'");
        const data = await githubFetch(
          `/search/repositories?q=${encodeURIComponent(input.query)}&per_page=${perPage}`,
        );
        return { results: data };
      }
      case "list_issues": {
        const { owner, repo } = requireRepo(input);
        const state = input.state ?? "open";
        const data = await githubFetch(
          `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`,
        );
        // GitHub returns PRs in the issues list; callers usually want issues only.
        const issues = Array.isArray(data)
          ? (data as Array<{ pull_request?: unknown }>).filter((i) => !i.pull_request)
          : data;
        return { issues };
      }
      case "get_issue": {
        const { owner, repo } = requireRepo(input);
        if (input.number == null) throw new Error("get_issue requires 'number'");
        return { issue: await githubFetch(`/repos/${owner}/${repo}/issues/${input.number}`) };
      }
      case "search_issues": {
        if (!input.query) throw new Error("search_issues requires 'query'");
        const data = await githubFetch(
          `/search/issues?q=${encodeURIComponent(input.query)}&per_page=${perPage}`,
        );
        return { results: data };
      }
      case "list_pull_requests": {
        const { owner, repo } = requireRepo(input);
        const state = input.state ?? "open";
        const data = await githubFetch(
          `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`,
        );
        return { pullRequests: data };
      }
      case "get_pull_request": {
        const { owner, repo } = requireRepo(input);
        if (input.number == null) throw new Error("get_pull_request requires 'number'");
        return { pullRequest: await githubFetch(`/repos/${owner}/${repo}/pulls/${input.number}`) };
      }
      case "search_code": {
        if (!input.query) throw new Error("search_code requires 'query'");
        const data = await githubFetch(
          `/search/code?q=${encodeURIComponent(input.query)}&per_page=${perPage}`,
        );
        return { results: data };
      }
      case "create_issue": {
        const { owner, repo } = requireRepo(input);
        if (!input.title) throw new Error("create_issue requires 'title'");
        const issue = await githubFetch(`/repos/${owner}/${repo}/issues`, {
          method: "POST",
          body: { title: input.title, body: input.body ?? "" },
        });
        return { created: issue };
      }
    }

    // All enum actions are handled above; this satisfies exhaustiveness.
    throw new Error("Unsupported GitHub action");
  },
});

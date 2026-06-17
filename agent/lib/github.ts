// GitHub REST helper. Mirrors the env-var + header pattern in internal-api.ts.
// One shared app-scoped fine-grained PAT in process.env.GITHUB_TOKEN reaches
// both Vercel services (project-level env var). Node 24 has global fetch.

export const GITHUB_API = "https://api.github.com";
export const GITHUB_API_VERSION = "2022-11-28";

export function githubToken() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return token;
}

export function githubHeaders() {
  return {
    authorization: `Bearer ${githubToken()}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": GITHUB_API_VERSION,
    "user-agent": "kainbot-agent",
  } satisfies Record<string, string>;
}

// Thin wrapper around fetch that throws readable errors for the model.
export async function githubFetch(
  path: string,
  init?: { method?: string; body?: unknown },
) {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      ...githubHeaders(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { message?: string };
      detail = data?.message ? `: ${data.message}` : "";
    }
    catch {
      // non-JSON error body; ignore
    }
    throw new Error(`GitHub API ${response.status} on ${init?.method ?? "GET"} ${path}${detail}`);
  }

  if (response.status === 204) {
    return null;
  }
  return await response.json();
}

import { defineTool } from "eve/tools";
import { z } from "zod";

// Firecrawl v2 REST API.
// Docs: https://docs.firecrawl.dev/api-reference/endpoint/search
//       https://docs.firecrawl.dev/api-reference/endpoint/scrape
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

interface FirecrawlSearchResult {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string | null;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    url?: string;
  };
}

interface FirecrawlSearchResponse {
  success?: boolean;
  data?: {
    web?: FirecrawlSearchResult[];
    news?: FirecrawlSearchResult[];
  };
  error?: string;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      url?: string;
    };
  };
  error?: string;
}

function firecrawlKey() {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }
  return key;
}

function firecrawlHeaders() {
  return {
    authorization: `Bearer ${firecrawlKey()}`,
    "content-type": "application/json",
  };
}

// Firecrawl markdown can be large; keep what the model sees bounded.
const MAX_MARKDOWN_CHARS = 12000;

function trimMarkdown(markdown: string | null | undefined) {
  if (!markdown) {
    return undefined;
  }
  const trimmed = markdown.trim();
  if (trimmed.length <= MAX_MARKDOWN_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_MARKDOWN_CHARS)}\n\n…[truncated]`;
}

async function scrapePage(url: string) {
  const response = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify({
      url,
      formats: [{ type: "markdown" }],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed (${response.status})`);
  }

  const json = (await response.json()) as FirecrawlScrapeResponse;
  return trimMarkdown(json.data?.markdown);
}

export default defineTool({
  description:
    "Search the live web (via Firecrawl) and optionally read full page content. Use for current events, facts that may have changed, docs, prices, or anything you don't reliably know. Returns ranked results with title, url, and snippet; set fetchPage to also pull the top results' page content as markdown. Always cite the source url(s) and never fabricate results or quotes.",
  inputSchema: z.object({
    query: z.string().min(1).describe("What to search the web for"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Max number of results to return (default 5)"),
    fetchPage: z
      .boolean()
      .optional()
      .describe(
        "When true, also scrape full page markdown for the returned results (slower, more tokens). Default false — snippets only.",
      ),
  }),
  outputSchema: z.object({
    query: z.string(),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        markdown: z.string().optional(),
      }),
    ),
  }),
  async execute({ query, limit, fetchPage }) {
    const count = limit ?? 5;

    const searchBody: Record<string, unknown> = {
      query,
      limit: count,
      sources: [{ type: "web" }],
    };
    // Let Firecrawl scrape inline during search when full content is requested —
    // one round trip instead of N follow-up scrapes.
    if (fetchPage) {
      searchBody.scrapeOptions = { formats: [{ type: "markdown" }], onlyMainContent: true };
    }

    const response = await fetch(`${FIRECRAWL_BASE}/search`, {
      method: "POST",
      headers: firecrawlHeaders(),
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl search failed (${response.status})`);
    }

    const json = (await response.json()) as FirecrawlSearchResponse;
    if (json.success === false) {
      throw new Error(json.error ?? "Firecrawl search failed");
    }

    const web = json.data?.web ?? [];

    const results = await Promise.all(
      web.slice(0, count).map(async (item) => {
        const url = item.url ?? item.metadata?.sourceURL ?? item.metadata?.url ?? "";
        const title = item.title ?? item.metadata?.title ?? url;
        const snippet = item.description ?? item.metadata?.description ?? "";

        let markdown = trimMarkdown(item.markdown);
        // If inline scrape didn't return content for this item, fall back to a direct scrape.
        if (fetchPage && !markdown && url) {
          try {
            markdown = await scrapePage(url);
          }
          catch {
            markdown = undefined;
          }
        }

        return { title, url, snippet, ...(markdown ? { markdown } : {}) };
      }),
    );

    return { query, results };
  },
});

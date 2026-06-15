import type { UIMessage } from "ai";
import { isDynamicToolUIPart, isTextUIPart, isToolUIPart } from "ai";
import { sourceToInlineMdc } from "~/utils/tool";

export function hasVisibleParts(parts: UIMessage["parts"]): boolean {
  return parts.some((part) => {
    if (part.type === "text" || part.type === "reasoning") return true;
    return isToolUIPart(part) || isDynamicToolUIPart(part);
  });
}

export function getMergedParts(parts: UIMessage["parts"]): UIMessage["parts"] {
  const result: UIMessage["parts"] = [];
  for (const part of parts) {
    if (part.type === "step-start") continue;

    const prev = result[result.length - 1];
    if (part.type === "source-url") {
      if (prev && isTextUIPart(prev)) {
        result[result.length - 1] = {
          type: "text",
          text: prev.text + sourceToInlineMdc(part.url),
        };
      }
      continue;
    }
    if (isTextUIPart(part) && prev && isTextUIPart(prev)) {
      result[result.length - 1] = { type: "text", text: prev.text + part.text };
    } else {
      result.push(part);
    }
  }
  return result;
}

export type { EveMessage, EveMessagePart } from "eve/vue";

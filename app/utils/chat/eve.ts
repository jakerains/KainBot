import { isDynamicToolUIPart, isTextUIPart, isToolUIPart } from "ai";
import type { UIMessage } from "ai";

export function hasVisibleParts(parts: UIMessage["parts"]): boolean {
  return parts.some((part) => {
    if (part.type === "text" || part.type === "reasoning") return true;
    return isToolUIPart(part) || isDynamicToolUIPart(part);
  });
}

export function normalizeEveParts(parts: UIMessage["parts"]): UIMessage["parts"] {
  return parts.filter((part) => part.type !== "step-start");
}

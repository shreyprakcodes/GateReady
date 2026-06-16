export function cleanAgentText(text: string): string {
  return text
    // strip fenced code blocks
    .replace(/```[\s\S]*?```/g, "")
    // strip inline backtick expressions (tool call patterns like `func()`)
    .replace(/`[a-z_]+\(.*?\)`/g, "")
    // strip remaining inline backticks
    .replace(/`[^`]*`/g, "")
    // strip bold and italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // strip headers
    .replace(/^#{1,6}\s+/gm, "")
    // strip blockquote lines
    .replace(/^>\s?.*/gm, "")
    // strip horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // strip lines that look like tool calls written as text
    .replace(/^[a-z_]+\(.*\)\s*$/gm, "")
    // collapse excessive blank lines to single blank line
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

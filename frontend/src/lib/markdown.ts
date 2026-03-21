import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const turndownService = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
  hr: "---",
  strongDelimiter: "**",
});

turndownService.use(gfm);

turndownService.addRule("fencedCodeBlockWithLanguage", {
  filter(node: Node) {
    return (
      node.nodeName === "PRE" &&
      Boolean((node.firstChild as HTMLElement | null)?.nodeName === "CODE")
    );
  },
  replacement(_content: string, node: Node) {
    const codeElement = (node.firstChild as HTMLElement | null) ?? null;
    const className = codeElement?.getAttribute("class") ?? "";
    const languageMatch = className.match(/language-([A-Za-z0-9_+-]+)/);
    const language = languageMatch?.[1] ?? "";
    const code = codeElement?.textContent?.replace(/\n$/, "") ?? "";
    return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  },
});

export function markdownToHtml(markdown: string) {
  return marked.parse(markdown) as string;
}

export function htmlToMarkdown(html: string) {
  return turndownService.turndown(html).trim();
}

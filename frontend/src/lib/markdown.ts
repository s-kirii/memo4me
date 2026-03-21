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

export function markdownToHtml(markdown: string) {
  return marked.parse(markdown) as string;
}

export function htmlToMarkdown(html: string) {
  return turndownService.turndown(html).trim();
}

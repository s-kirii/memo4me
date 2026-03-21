import { useMemo } from "react";
import { markdownToSafeHtml } from "../lib/markdown";

type MarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

export function MarkdownPreview({
  markdown,
  className = "markdown-preview",
}: MarkdownPreviewProps) {
  const html = useMemo(() => markdownToSafeHtml(markdown), [markdown]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

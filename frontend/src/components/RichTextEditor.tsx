import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { htmlToMarkdown, markdownToHtml } from "../lib/markdown";

type RichTextEditorProps = {
  value: string;
  placeholder?: string;
  onChange: (nextMarkdown: string) => void;
};

export function RichTextEditor({
  value,
  placeholder = "Write your note in Markdown...",
  onChange,
}: RichTextEditorProps) {
  const lastSyncedMarkdownRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: markdownToHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextMarkdown = htmlToMarkdown(currentEditor.getHTML());
      lastSyncedMarkdownRef.current = nextMarkdown;
      onChange(nextMarkdown);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (value === lastSyncedMarkdownRef.current) {
      return;
    }

    editor.commands.setContent(markdownToHtml(value), {
      emitUpdate: false,
    });
    lastSyncedMarkdownRef.current = value;
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}

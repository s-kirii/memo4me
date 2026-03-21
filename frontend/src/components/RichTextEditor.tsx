import { useEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { htmlToMarkdown, markdownToHtml } from "../lib/markdown";
import "highlight.js/styles/github.css";

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
  const lowlight = createLowlight(common);
  const lastSyncedMarkdownRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
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

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isCodeBlockActive: currentEditor ? currentEditor.isActive("codeBlock") : false,
      activeCodeLanguage:
        currentEditor
          ? ((currentEditor.getAttributes("codeBlock").language as string | undefined) ??
            "plaintext")
          : "plaintext",
    }),
  });

  const currentEditorState = editorState ?? {
    isCodeBlockActive: false,
    activeCodeLanguage: "plaintext",
  };

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

  const handleToggleCodeBlock = () => {
    if (!editor) {
      return;
    }

    if (editor.isActive("codeBlock")) {
      editor.chain().focus().setParagraph().run();
      return;
    }

    editor.chain().focus().toggleCodeBlock().run();
    editor.commands.updateAttributes("codeBlock", {
      language: "plaintext",
    });
  };

  const handleLanguageChange = (language: string) => {
    if (!editor) {
      return;
    }

    editor.chain().focus().updateAttributes("codeBlock", { language }).run();
  };

  return (
    <div className="rich-editor">
      <div className="editor-toolbar">
        <button
          type="button"
          className={`editor-toolbar-button${
            currentEditorState.isCodeBlockActive ? " is-active" : ""
          }`}
          onClick={handleToggleCodeBlock}
        >
          Code Block
        </button>

        {currentEditorState.isCodeBlockActive ? (
          <label className="editor-language-select">
            <span>Language</span>
            <select
              value={currentEditorState.activeCodeLanguage}
              onChange={(event) => handleLanguageChange(event.target.value)}
            >
              <option value="plaintext">Plain text</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="json">JSON</option>
              <option value="bash">Bash</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
            </select>
          </label>
        ) : null}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

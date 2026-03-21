import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextEditor } from "./components/RichTextEditor";
import "./App.css";

type SaveState = "idle" | "saving" | "saved" | "error";

type NoteListItem = {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type NoteDetail = {
  id: string;
  title: string;
  contentMd: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type TagItem = {
  id: string;
  name: string;
};

type EditorDraft = {
  title: string;
  contentMd: string;
};

const API_BASE = "http://127.0.0.1:8787/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(errorBody?.error?.message ?? "request failed");
  }

  return (await response.json()) as T;
}

function getDisplayTitle(title: string) {
  return title.trim() || "Untitled";
}

function formatUpdatedAt(value: string) {
  if (value === "just now") {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getExcerptFromMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function App() {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null);
  const [draft, setDraft] = useState<EditorDraft>({ title: "", contentMd: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [tags, setTags] = useState<TagItem[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(true);

  const loadNotes = async () => {
    setIsListLoading(true);

    try {
      const response = await request<{ items: NoteListItem[] }>("/notes");
      setNotes(response.items);
      setErrorMessage(null);

      setSelectedNoteId((currentId) => {
        if (currentId && response.items.some((note) => note.id === currentId)) {
          return currentId;
        }

        return response.items[0]?.id ?? null;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "failed to load notes");
    } finally {
      setIsListLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await request<{ items: TagItem[] }>("/tags");
      setTags(response.items);
    } catch {
      setTags([]);
    }
  };

  const loadNoteDetail = async (noteId: string) => {
    setIsDetailLoading(true);

    try {
      const note = await request<NoteDetail>(`/notes/${noteId}`);
      setSelectedNote(note);
      setDraft({
        title: note.title,
        contentMd: note.contentMd,
      });
      skipNextAutosaveRef.current = true;
      setSaveState("idle");
      setErrorMessage(null);
    } catch (error) {
      setSelectedNote(null);
      setErrorMessage(error instanceof Error ? error.message : "failed to load note");
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
    void loadTags();
  }, []);

  useEffect(() => {
    if (!selectedNoteId) {
      setSelectedNote(null);
      setDraft({ title: "", contentMd: "" });
      setSaveState("idle");
      return;
    }

    void loadNoteDetail(selectedNoteId);
  }, [selectedNoteId]);

  useEffect(() => {
    if (!selectedNote) {
      return;
    }

    const isDirty =
      draft.title !== selectedNote.title || draft.contentMd !== selectedNote.contentMd;

    if (!isDirty) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const updated = await request<NoteDetail>(`/notes/${selectedNote.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: draft.title,
            contentMd: draft.contentMd,
            tags: selectedNote.tags,
          }),
        });

        setSelectedNote(updated);
        setDraft({
          title: updated.title,
          contentMd: updated.contentMd,
        });
        setNotes((currentNotes) =>
          currentNotes.map((note) =>
            note.id === updated.id
              ? {
                  ...note,
                  title: updated.title,
                  excerpt: getExcerptFromMarkdown(updated.contentMd),
                  tags: updated.tags,
                  updatedAt: updated.updatedAt,
                }
              : note,
          ),
        );
        setSaveState("saved");
        setErrorMessage(null);
      } catch (error) {
        setSaveState("error");
        setErrorMessage(error instanceof Error ? error.message : "failed to save note");
      }
    }, 800);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, selectedNote]);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const nextNotes = [...notes];

    if (sort === "updated_asc") {
      nextNotes.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    } else if (sort === "title_asc") {
      nextNotes.sort((a, b) =>
        getDisplayTitle(a.title).localeCompare(getDisplayTitle(b.title)),
      );
    } else {
      nextNotes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    if (!normalizedQuery) {
      return nextNotes;
    }

    return nextNotes.filter((note) => {
      const haystacks = [note.title, note.excerpt, note.tags.join(" ")].map((value) =>
        value.toLowerCase(),
      );
      return haystacks.some((value) => value.includes(normalizedQuery));
    });
  }, [notes, searchQuery, sort]);

  const handleCreateNote = async () => {
    try {
      const created = await request<NoteDetail>("/notes", {
        method: "POST",
        body: JSON.stringify({
          title: "",
          contentMd: "",
          tags: [],
        }),
      });

      setNotes((currentNotes) => [
        {
          id: created.id,
          title: created.title,
          excerpt: "",
          tags: created.tags,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        ...currentNotes,
      ]);
      setSelectedNoteId(created.id);
      await loadTags();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "failed to create note");
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) {
      return;
    }

    const confirmed = window.confirm("このメモを削除しますか？");
    if (!confirmed) {
      return;
    }

    try {
      await request<{ ok: true }>(`/notes/${selectedNote.id}`, {
        method: "DELETE",
      });

      setNotes((currentNotes) => {
        const remainingNotes = currentNotes.filter((note) => note.id !== selectedNote.id);
        setSelectedNoteId(remainingNotes[0]?.id ?? null);
        return remainingNotes;
      });
      setSelectedNote(null);
      setDraft({ title: "", contentMd: "" });
      setSaveState("idle");
      await loadTags();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "failed to delete note");
    }
  };

  const showEmptyState = !selectedNoteId || !selectedNote;
  const emptyStateTitle = notes.length === 0 ? "最初のメモを作成してください" : "メモを選択してください";
  const emptyStateBody =
    notes.length === 0
      ? "左側の New Note から新しいメモを作ると、ここにタイトル入力欄と本文エリアが表示されます。"
      : "左側の一覧からメモを選択すると、ここに内容が表示されます。";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">memo4me</p>
          <h1>Local-first note workspace</h1>
        </div>
        <div className="header-actions">
          <button className="primary-button" onClick={() => void handleCreateNote()}>
            New Note
          </button>
          <label className="search-input">
            <span>Search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search notes, tags, text"
            />
          </label>
        </div>
      </header>

      <main className="app-layout">
        <aside className="sidebar">
          <section className="sidebar-section">
            <div className="sidebar-section-header">
              <h2>Filters</h2>
            </div>
            <div className="filter-stack">
              <label className="field">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="updated_desc">Updated desc</option>
                  <option value="updated_asc">Updated asc</option>
                  <option value="title_asc">Title asc</option>
                </select>
              </label>

              <div className="field">
                <span>Tags</span>
                <div className="tag-list">
                  <button className="tag-chip is-active" type="button">
                    All
                  </button>
                  {tags.map((tag) => (
                    <button key={tag.id} className="tag-chip" type="button">
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="sidebar-section note-list-section">
            <div className="sidebar-section-header">
              <h2>Notes</h2>
              <span>{filteredNotes.length}</span>
            </div>

            <div className="note-list">
              {isListLoading ? (
                <div className="list-empty">Loading notes...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="list-empty">一致するメモはありません</div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={`note-list-item${
                      note.id === selectedNoteId ? " is-selected" : ""
                    }`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <div className="note-list-item-title">
                      {getDisplayTitle(note.title)}
                    </div>
                    <div className="note-list-item-excerpt">
                      {note.excerpt || "No content"}
                    </div>
                    <div className="note-list-item-meta">
                      <span>{formatUpdatedAt(note.updatedAt)}</span>
                      <span>{note.tags[0] ?? "untagged"}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="editor-panel">
          {showEmptyState ? (
            <div className="empty-state">
              <p className="empty-state-label">
                {notes.length === 0 ? "No notes yet" : "No note selected"}
              </p>
              <h2>{emptyStateTitle}</h2>
              <p>{emptyStateBody}</p>
            </div>
          ) : (
            <>
              <div className="editor-meta">
                <div>
                  <p className="eyebrow">Focused note</p>
                  <p className="updated-at">
                    {isDetailLoading
                      ? "Loading..."
                      : `Updated ${formatUpdatedAt(selectedNote.updatedAt)}`}
                  </p>
                </div>
                <div className="editor-meta-actions">
                  <span className={`save-status is-${saveState}`}>
                    {saveState === "saving" && "Saving..."}
                    {saveState === "saved" && "Saved"}
                    {saveState === "error" && "Save failed"}
                    {saveState === "idle" && "Ready"}
                  </span>
                  <button
                    type="button"
                    className="ghost-button danger-button"
                    onClick={() => void handleDeleteNote()}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <label className="title-field">
                <span className="visually-hidden">Title</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Untitled"
                />
              </label>

              <div className="note-tags">
                {selectedNote.tags.length === 0 ? (
                  <span className="tag-pill is-muted">untagged</span>
                ) : (
                  selectedNote.tags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      {tag}
                    </span>
                  ))
                )}
              </div>

              <div className="editor-divider">
                <span>Body</span>
              </div>

              <div className="editor-body">
                <RichTextEditor
                  value={draft.contentMd}
                  onChange={(nextMarkdown) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      contentMd: nextMarkdown,
                    }))
                  }
                />
              </div>

              {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

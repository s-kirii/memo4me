import { useMemo, useRef, useState } from "react";
import "./App.css";

type SaveState = "idle" | "saving" | "saved" | "error";

type Note = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  tags: string[];
};

const initialNotes: Note[] = [
  {
    id: "1",
    title: "Project memo",
    excerpt: "Node.js と Tiptap を前提に、Notion ライクな体験を目指す。",
    updatedAt: "2026-03-21 11:00",
    tags: ["work", "memo"],
  },
  {
    id: "2",
    title: "Weekly review",
    excerpt: "今週やったこと、次にやること、詰まりそうな点を簡単に整理する。",
    updatedAt: "2026-03-20 18:30",
    tags: ["review"],
  },
  {
    id: "3",
    title: "",
    excerpt: "タイトル未入力時の見え方を確認するためのダミーメモ。",
    updatedAt: "2026-03-19 09:15",
    tags: ["draft"],
  },
];

function getDisplayTitle(title: string) {
  return title.trim() || "Untitled";
}

function App() {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    initialNotes[0]?.id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveTimerRef = useRef<number | null>(null);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const nextNotes = [...notes];

    if (sort === "updated_asc") {
      nextNotes.reverse();
    }

    if (sort === "title_asc") {
      nextNotes.sort((a, b) =>
        getDisplayTitle(a.title).localeCompare(getDisplayTitle(b.title)),
      );
    }

    if (!normalizedQuery) {
      return nextNotes;
    }

    return nextNotes.filter((note) => {
      const haystacks = [
        note.title,
        note.excerpt,
        note.tags.join(" "),
      ].map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(normalizedQuery));
    });
  }, [notes, searchQuery, sort]);

  const selectedNote =
    notes.find((note) => note.id === selectedNoteId) ?? null;

  const handleCreateNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "",
      excerpt: "新しいメモを書き始めてください。",
      updatedAt: "just now",
      tags: ["inbox"],
    };

    setNotes((currentNotes) => [newNote, ...currentNotes]);
    setSelectedNoteId(newNote.id);
    setSaveState("idle");
  };

  const handleTitleChange = (value: string) => {
    if (!selectedNote) {
      return;
    }

    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === selectedNote.id ? { ...note, title: value } : note,
      ),
    );
    setSaveState("saving");

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saved");
    }, 500);
  };

  const showEmptyState = notes.length === 0 || !selectedNote;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">memo4me</p>
          <h1>Local-first note workspace</h1>
        </div>
        <div className="header-actions">
          <button className="primary-button" onClick={handleCreateNote}>
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
                  <button className="tag-chip" type="button">
                    work
                  </button>
                  <button className="tag-chip" type="button">
                    memo
                  </button>
                  <button className="tag-chip" type="button">
                    review
                  </button>
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
              {filteredNotes.length === 0 ? (
                <div className="list-empty">一致するメモはありません</div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={`note-list-item${
                      note.id === selectedNoteId ? " is-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedNoteId(note.id);
                      setSaveState("saved");
                    }}
                  >
                    <div className="note-list-item-title">
                      {getDisplayTitle(note.title)}
                    </div>
                    <div className="note-list-item-excerpt">{note.excerpt}</div>
                    <div className="note-list-item-meta">
                      <span>{note.updatedAt}</span>
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
              <p className="empty-state-label">No note selected</p>
              <h2>最初のメモを作成してください</h2>
              <p>
                左側の <strong>New Note</strong> から新しいメモを作ると、
                ここにタイトル入力欄と本文エリアが表示されます。
              </p>
            </div>
          ) : (
            <>
              <div className="editor-meta">
                <div>
                  <p className="eyebrow">Focused note</p>
                  <p className="updated-at">Updated {selectedNote.updatedAt}</p>
                </div>
                <span className={`save-status is-${saveState}`}>
                  {saveState === "saving" && "Saving..."}
                  {saveState === "saved" && "Saved"}
                  {saveState === "error" && "Save failed"}
                  {saveState === "idle" && "Ready"}
                </span>
              </div>

              <label className="title-field">
                <span className="visually-hidden">Title</span>
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  placeholder="Untitled"
                />
              </label>

              <div className="note-tags">
                {selectedNote.tags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="editor-surface">
                <p className="editor-placeholder-label">Editor Placeholder</p>
                <h2>{getDisplayTitle(selectedNote.title)}</h2>
                <p>{selectedNote.excerpt}</p>
                <div className="editor-placeholder-card">
                  <p>Phase 1 では右カラムの骨組みまでを実装しています。</p>
                  <p>
                    次の Phase で Tiptap を導入し、ここを Notion ライクな
                    リッチエディタに置き換えます。
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

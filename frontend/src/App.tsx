import {
  FocusEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AiAssistantModal } from "./components/AiAssistantModal";
import { AiSettingsModal } from "./components/AiSettingsModal";
import { TasksModal } from "./components/TasksModal";
import { RichTextEditor } from "./components/RichTextEditor";
import { request } from "./lib/api";
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
  tags: string[];
};

function getDisplayTitle(title: string) {
  return title.trim() || "Untitled";
}

function formatUpdatedAt(value: string) {
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

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function App() {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null);
  const [draft, setDraft] = useState<EditorDraft>({
    title: "",
    contentMd: "",
    tags: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [activeTagSuggestionIndex, setActiveTagSuggestionIndex] = useState(-1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [selectedEditorText, setSelectedEditorText] = useState("");
  const [pendingTaskDraftTitle, setPendingTaskDraftTitle] = useState("");
  const [pendingTaskSelectionText, setPendingTaskSelectionText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const listReloadTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const tagInputShellRef = useRef<HTMLDivElement | null>(null);
  const tagSuggestionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadNotes = async (options?: { preferredSelectedId?: string | null }) => {
    setIsListLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (sort) {
        params.set("sort", sort);
      }
      if (selectedTagFilter) {
        params.set("tag", selectedTagFilter);
      }

      const queryString = params.toString();
      const response = await request<{ items: NoteListItem[] }>(
        `/notes${queryString ? `?${queryString}` : ""}`,
      );

      setNotes(response.items);
      setErrorMessage(null);

      setSelectedNoteId((currentId) => {
        const preferredSelectedId = options?.preferredSelectedId ?? currentId;
        if (
          preferredSelectedId &&
          response.items.some((note) => note.id === preferredSelectedId)
        ) {
          return preferredSelectedId;
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
        tags: note.tags,
      });
      setTagInput("");
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
    void loadTags();
  }, []);

  useEffect(() => {
    if (listReloadTimerRef.current !== null) {
      window.clearTimeout(listReloadTimerRef.current);
    }

    listReloadTimerRef.current = window.setTimeout(() => {
      void loadNotes();
    }, 300);

    return () => {
      if (listReloadTimerRef.current !== null) {
        window.clearTimeout(listReloadTimerRef.current);
      }
    };
  }, [searchQuery, sort, selectedTagFilter]);

  useEffect(() => {
    if (!selectedNoteId) {
      setSelectedNote(null);
      setDraft({ title: "", contentMd: "", tags: [] });
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
      draft.title !== selectedNote.title ||
      draft.contentMd !== selectedNote.contentMd ||
      JSON.stringify(draft.tags) !== JSON.stringify(selectedNote.tags);

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
            tags: draft.tags,
          }),
        });

        setSelectedNote(updated);
        setDraft({
          title: updated.title,
          contentMd: updated.contentMd,
          tags: updated.tags,
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
        await loadTags();
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

      await loadNotes({ preferredSelectedId: created.id });
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

      await loadNotes({ preferredSelectedId: null });
      await loadTags();
      setSelectedNote(null);
      setDraft({ title: "", contentMd: "", tags: [] });
      setTagInput("");
      setSaveState("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "failed to delete note");
    }
  };

  const handleCreateNoteFromOutput = async (title: string, contentMd: string) => {
    const created = await request<NoteDetail>("/notes", {
      method: "POST",
      body: JSON.stringify({
        title,
        contentMd,
        tags: [],
      }),
    });

    await loadNotes({ preferredSelectedId: created.id });
    await loadTags();
  };

  const addTagByName = (rawTag: string) => {
    const nextTag = rawTag.trim();
    if (!nextTag) {
      return;
    }

    setDraft((currentDraft) => {
      const normalizedExistingTags = currentDraft.tags.map((tag) => normalizeTag(tag));
      if (normalizedExistingTags.includes(normalizeTag(nextTag))) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        tags: [...currentDraft.tags, nextTag],
      };
    });
    setTagInput("");
    setActiveTagSuggestionIndex(-1);
  };

  const availableTagSuggestions = useMemo(() => {
    const normalizedDraftTags = new Set(draft.tags.map((tag) => normalizeTag(tag)));
    const normalizedInput = normalizeTag(tagInput);

    if (!normalizedInput) {
      return [];
    }

    return tags
      .map((tag) => tag.name)
      .filter((tagName) => !normalizedDraftTags.has(normalizeTag(tagName)))
      .filter((tagName) => normalizeTag(tagName).includes(normalizedInput))
      .slice(0, 5);
  }, [draft.tags, tagInput, tags]);

  useEffect(() => {
    setActiveTagSuggestionIndex(-1);
  }, [tagInput]);

  const showTagSuggestions = isTagInputFocused && availableTagSuggestions.length > 0;

  const handleAddTag = () => {
    addTagByName(tagInput);
  };

  const handleSelectSuggestedTag = (tagName: string) => {
    addTagByName(tagName);
    setIsTagInputFocused(false);
  };

  const handleTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddTag();
      return;
    }

    if (event.key === "Tab" && availableTagSuggestions.length > 0) {
      event.preventDefault();
      const nextIndex = activeTagSuggestionIndex >= 0 ? activeTagSuggestionIndex : 0;
      setActiveTagSuggestionIndex(nextIndex);
      tagSuggestionButtonRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowDown" && availableTagSuggestions.length > 0) {
      event.preventDefault();
      setActiveTagSuggestionIndex((currentIndex) =>
        currentIndex < availableTagSuggestions.length - 1 ? currentIndex + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp" && availableTagSuggestions.length > 0) {
      event.preventDefault();
      setActiveTagSuggestionIndex((currentIndex) =>
        currentIndex <= 0 ? availableTagSuggestions.length - 1 : currentIndex - 1,
      );
      return;
    }

    if (event.key === "Escape") {
      setIsTagInputFocused(false);
      setActiveTagSuggestionIndex(-1);
    }
  };

  const handleTagInputShellBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocusedElement = event.relatedTarget as Node | null;
    if (tagInputShellRef.current?.contains(nextFocusedElement)) {
      return;
    }

    setIsTagInputFocused(false);
    setActiveTagSuggestionIndex(-1);
  };

  const handleTagSuggestionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    tagName: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectSuggestedTag(tagName);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = index < availableTagSuggestions.length - 1 ? index + 1 : 0;
      setActiveTagSuggestionIndex(nextIndex);
      tagSuggestionButtonRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = index <= 0 ? availableTagSuggestions.length - 1 : index - 1;
      setActiveTagSuggestionIndex(nextIndex);
      tagSuggestionButtonRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Tab" && availableTagSuggestions.length > 0) {
      if (event.shiftKey) {
        if (index === 0) {
          event.preventDefault();
          setActiveTagSuggestionIndex(-1);
          const input = tagInputShellRef.current?.querySelector("input");
          if (input instanceof HTMLInputElement) {
            input.focus();
          }
        }
        return;
      }

      if (index < availableTagSuggestions.length - 1) {
        event.preventDefault();
        const nextIndex = index + 1;
        setActiveTagSuggestionIndex(nextIndex);
        tagSuggestionButtonRefs.current[nextIndex]?.focus();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsTagInputFocused(false);
      setActiveTagSuggestionIndex(-1);
      const input = tagInputShellRef.current?.querySelector("input");
      if (input instanceof HTMLInputElement) {
        input.focus();
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tags: currentDraft.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const availableFilterTags = useMemo(() => {
    const tagNames = tags.map((tag) => tag.name);
    if (selectedTagFilter && !tagNames.includes(selectedTagFilter)) {
      return [selectedTagFilter, ...tagNames];
    }
    return tagNames;
  }, [selectedTagFilter, tags]);

  const showEmptyState = !selectedNoteId || !selectedNote;
  const hasTaskSelection = selectedEditorText.trim().length > 0;
  const emptyStateTitle =
    notes.length === 0 ? "最初のメモを作成してください" : "メモを選択してください";
  const emptyStateBody =
    notes.length === 0
      ? "左側の New Note から新しいメモを作ると、ここにタイトル入力欄と本文エリアが表示されます。"
      : "左側の一覧からメモを選択すると、ここに内容が表示されます。";

  const openTasksWithSelection = () => {
    const selectionText = selectedEditorText.trim();
    setPendingTaskSelectionText(selectionText);
    setPendingTaskDraftTitle(selectionText);
    setIsTasksOpen(true);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">memo4me</p>
          <h1>Local-first note workspace</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsTasksOpen(true)}
          >
            Tasks
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsAiSettingsOpen(true)}
          >
            AI Settings
          </button>
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
                  <button
                    className={`tag-chip${selectedTagFilter === null ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedTagFilter(null)}
                  >
                    All
                  </button>
                  {availableFilterTags.map((tag) => (
                    <button
                      key={tag}
                      className={`tag-chip${
                        selectedTagFilter === tag ? " is-active" : ""
                      }`}
                      type="button"
                      onClick={() =>
                        setSelectedTagFilter((currentTag) =>
                          currentTag === tag ? null : tag,
                        )
                      }
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="sidebar-section note-list-section">
            <div className="sidebar-section-header">
              <h2>Notes</h2>
              <span>{notes.length}</span>
            </div>

            <div className="note-list">
              {isListLoading ? (
                <div className="list-empty">Loading notes...</div>
              ) : notes.length === 0 ? (
                <div className="list-empty">一致するメモはありません</div>
              ) : (
                notes.map((note) => (
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
                  {hasTaskSelection ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={openTasksWithSelection}
                    >
                      Add Selection to Tasks
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setIsAiAssistantOpen(true)}
                  >
                    AI
                  </button>
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

              <div className="note-tags note-tags-editor">
                {draft.tags.length === 0 ? (
                  <span className="tag-pill is-muted">untagged</span>
                ) : (
                  draft.tags.map((tag) => (
                    <span key={tag} className="tag-pill tag-pill-editable">
                      <span>{tag}</span>
                      <button
                        type="button"
                        className="tag-remove-button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        x
                      </button>
                    </span>
                  ))
                )}

                <label className="tag-input">
                  <span className="visually-hidden">Add tag</span>
                  <div
                    ref={tagInputShellRef}
                    className="tag-input-shell"
                    onFocus={() => setIsTagInputFocused(true)}
                    onBlur={handleTagInputShellBlur}
                  >
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(event) => {
                        setTagInput(event.target.value);
                      }}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="Add tag"
                    />
                    {showTagSuggestions ? (
                      <div className="tag-suggestion-list" role="listbox">
                        {availableTagSuggestions.map((tagName, index) => (
                          <button
                            key={tagName}
                            ref={(element) => {
                              tagSuggestionButtonRefs.current[index] = element;
                            }}
                            type="button"
                            className={`tag-suggestion-item${
                              index === activeTagSuggestionIndex ? " is-active" : ""
                            }`}
                            onFocus={() => setActiveTagSuggestionIndex(index)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSelectSuggestedTag(tagName);
                            }}
                            onKeyDown={(event) =>
                              handleTagSuggestionKeyDown(event, index, tagName)
                            }
                          >
                            {tagName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
                <button
                  type="button"
                  className="ghost-button tag-add-button"
                  onClick={handleAddTag}
                >
                  Add Tag
                </button>
              </div>

              <div className="editor-divider">
                <span>Body</span>
              </div>

              <div className="editor-body">
                <RichTextEditor
                  value={draft.contentMd}
                  onSelectionChange={setSelectedEditorText}
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

      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        request={request}
      />
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        note={
          selectedNote
            ? {
                id: selectedNote.id,
                title: draft.title,
                contentMd: draft.contentMd,
              }
            : null
        }
        onApplyToNote={(contentMd) => {
          setDraft((currentDraft) => ({
            ...currentDraft,
            contentMd,
          }));
          setSaveState("saving");
          setIsAiAssistantOpen(false);
        }}
        onCreateNoteFromOutput={handleCreateNoteFromOutput}
        request={request}
      />
      <TasksModal
        isOpen={isTasksOpen}
        currentNoteId={selectedNote?.id ?? null}
        currentNoteTitle={draft.title}
        initialDraftTitle={pendingTaskDraftTitle}
        initialSelectionText={pendingTaskSelectionText}
        onClose={() => setIsTasksOpen(false)}
        onOpenNote={(noteId) => setSelectedNoteId(noteId)}
        request={request}
      />
    </div>
  );
}

export default App;

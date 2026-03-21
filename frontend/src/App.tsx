import {
  FocusEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AiAssistantModal } from "./components/AiAssistantModal";
import { AppearanceModal } from "./components/AppearanceModal";
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

type ThemeId = "soft-editorial" | "neo-workspace";

const THEME_STORAGE_KEY = "memo4me.theme";

function getDisplayTitle(title: string) {
  return title.trim() || "無題";
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
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "neo-workspace" ? "neo-workspace" : "soft-editorial";
  });
  const [selectedEditorText, setSelectedEditorText] = useState("");
  const [pendingTaskDraftTitle, setPendingTaskDraftTitle] = useState("");
  const [pendingTaskSelectionText, setPendingTaskSelectionText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exitMessage, setExitMessage] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);

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
      setErrorMessage(error instanceof Error ? error.message : "メモの読み込みに失敗しました");
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
      setErrorMessage(error instanceof Error ? error.message : "メモの読み込みに失敗しました");
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadTags();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
        setErrorMessage(error instanceof Error ? error.message : "メモの保存に失敗しました");
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
      setErrorMessage(error instanceof Error ? error.message : "メモの作成に失敗しました");
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
      setErrorMessage(error instanceof Error ? error.message : "メモの削除に失敗しました");
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

  const handleExitApp = async () => {
    setIsExiting(true);
    setErrorMessage(null);

    try {
      const response = await request<{ ok: true; message: string }>("/app/shutdown", {
        method: "POST",
      });

      setExitMessage(response.message);

      window.setTimeout(() => {
        window.close();
      }, 250);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "アプリの終了に失敗しました",
      );
      setIsExiting(false);
    }
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
      ? "左側の「新規メモ」から新しいメモを作ると、ここにタイトル入力欄と本文エリアが表示されます。"
      : "左側の一覧からメモを選択すると、ここに内容が表示されます。";

  const openTasksWithSelection = () => {
    const selectionText = selectedEditorText.trim();
    setPendingTaskSelectionText(selectionText);
    setPendingTaskDraftTitle(selectionText);
    setIsTasksOpen(true);
  };

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div>
          <p className="eyebrow">memo4me</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsAppearanceOpen(true)}
          >
            テーマ
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsTasksOpen(true)}
          >
            タスク
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsAiSettingsOpen(true)}
          >
            AI設定
          </button>
          <button className="primary-button" onClick={() => void handleCreateNote()}>
            新規メモ
          </button>
          <button
            type="button"
            className="ghost-button danger-button"
            onClick={() => void handleExitApp()}
            disabled={isExiting}
          >
            {isExiting ? "終了中..." : "終了"}
          </button>
        </div>
      </header>

      <main className="app-layout">
        <aside className="sidebar">
          <section className="sidebar-section">
            <div className="sidebar-section-header">
              <h2>絞り込み</h2>
            </div>
            <div className="filter-stack">
              <div className="field search-field">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="メモ・タグ・本文を検索"
                />
              </div>

              <label className="field">
                <span>並び順</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="updated_desc">更新日が新しい順</option>
                  <option value="updated_asc">更新日が古い順</option>
                  <option value="title_asc">タイトル順</option>
                </select>
              </label>

              <div className="field">
                <span>タグ</span>
                <div className="tag-list">
                  <button
                    className={`tag-chip${selectedTagFilter === null ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedTagFilter(null)}
                  >
                    すべて
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
              <h2>メモ</h2>
              <span>{notes.length}</span>
            </div>

            <div className="note-list">
              {isListLoading ? (
                <div className="list-empty">メモを読み込み中...</div>
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
                      {note.excerpt || "内容なし"}
                    </div>
                    <div className="note-list-item-meta">
                      <span>{formatUpdatedAt(note.updatedAt)}</span>
                      <span>{note.tags[0] ?? "タグなし"}</span>
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
                {notes.length === 0 ? "まだメモがありません" : "メモが選択されていません"}
              </p>
              <h2>{emptyStateTitle}</h2>
              <p>{emptyStateBody}</p>
            </div>
          ) : (
            <>
              <div className="editor-meta">
                <div>
                  <p className="eyebrow">選択中のメモ</p>
                  <p className="updated-at">
                    {isDetailLoading
                      ? "読み込み中..."
                      : `更新 ${formatUpdatedAt(selectedNote.updatedAt)}`}
                  </p>
                </div>
                <div className="editor-meta-actions">
                  {hasTaskSelection ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={openTasksWithSelection}
                    >
                      選択範囲をタスク化
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
                    {saveState === "saving" && "保存中..."}
                    {saveState === "saved" && "保存済み"}
                    {saveState === "error" && "保存失敗"}
                    {saveState === "idle" && "準備完了"}
                  </span>
                  <button
                    type="button"
                    className="ghost-button danger-button"
                    onClick={() => void handleDeleteNote()}
                  >
                    削除
                  </button>
                </div>
              </div>

              <label className="title-field">
                <span className="visually-hidden">タイトル</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      title: event.target.value,
                    }))
                  }
                  placeholder="無題"
                />
              </label>

              <div className="note-tags note-tags-editor">
                {draft.tags.length === 0 ? (
                  <span className="tag-pill is-muted">タグなし</span>
                ) : (
                  draft.tags.map((tag) => (
                    <span key={tag} className="tag-pill tag-pill-editable">
                      <span>{tag}</span>
                      <button
                        type="button"
                        className="tag-remove-button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`タグ「${tag}」を削除`}
                      >
                        x
                      </button>
                    </span>
                  ))
                )}

                <label className="tag-input">
                  <span className="visually-hidden">タグを追加</span>
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
                      placeholder="タグを追加"
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
                  タグを追加
                </button>
              </div>

              <div className="editor-divider">
                <span>本文</span>
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

      {exitMessage ? (
        <div className="exit-banner" role="status">
          <strong>アプリを終了しました。</strong> {exitMessage}
        </div>
      ) : null}

      <AppearanceModal
        isOpen={isAppearanceOpen}
        selectedTheme={theme}
        onSelectTheme={setTheme}
        onClose={() => setIsAppearanceOpen(false)}
      />
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
        currentNoteTags={draft.tags}
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

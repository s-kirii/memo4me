type ThemeId = "soft-editorial" | "neo-workspace" | "modern-oasis";

type AppearanceModalProps = {
  isOpen: boolean;
  selectedTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  onClose: () => void;
};

const THEME_OPTIONS: Array<{
  id: ThemeId;
  label: string;
  description: string;
}> = [
  {
    id: "soft-editorial",
    label: "Soft Editorial",
    description: "やわらかく落ち着いた、紙もののような雰囲気です。",
  },
  {
    id: "neo-workspace",
    label: "Neo Workspace",
    description: "シャープで軽やかな、現代的なワークスペース風です。",
  },
  {
    id: "modern-oasis",
    label: "Modern Oasis",
    description: "セージと砂色を基調にした、穏やかなボタニカル空間です。",
  },
];

export function AppearanceModal({
  isOpen,
  selectedTheme,
  onSelectTheme,
  onClose,
}: AppearanceModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card appearance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">表示</p>
            <h2 id="appearance-modal-title">テーマ設定</h2>
            <p className="modal-description">
              見た目の雰囲気を切り替えられます。機能やレイアウトはそのままです。
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="appearance-theme-grid">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`appearance-theme-card${
                selectedTheme === option.id ? " is-active" : ""
              }`}
              onClick={() => onSelectTheme(option.id)}
            >
              <div className={`appearance-theme-preview is-${option.id}`}>
                <span className="appearance-preview-chip" />
                <span className="appearance-preview-line" />
                <span className="appearance-preview-card" />
              </div>
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

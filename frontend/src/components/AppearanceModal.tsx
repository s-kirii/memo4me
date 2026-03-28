type ThemeId =
  | "calm-editorial"
  | "soft-editorial"
  | "focus-light"
  | "graphite-terminal"
  | "girly"
  | "starlight"
  | "ocean";

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
    id: "focus-light",
    label: "Focus Light",
    description: "クリーンな明るさとシャープな密度感を両立した仕事向けテーマです。",
  },
  {
    id: "graphite-terminal",
    label: "Graphite Terminal",
    description: "深いチャコールと白、緑のアクセントでまとめたダークテーマです。",
  },
  {
    id: "calm-editorial",
    label: "Calm Editorial",
    description: "静かな余白とやわらかなセージで整えた、標準のテーマです。",
  },
  {
    id: "soft-editorial",
    label: "Soft Editorial",
    description: "紙のような質感と誌面感を少し強めた、創造的なテーマです。",
  },
  {
    id: "girly",
    label: "Girly",
    description: "ローズベージュとミルクの余白でまとめた、やわらかい手帳風テーマです。",
  },
  {
    id: "starlight",
    label: "Starlight",
    description: "星明かりのようなネイビーと淡い光で整えた幻想的なダークテーマです。",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "青緑と海図のような曲線を重ねた、爽やかな明テーマです。",
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

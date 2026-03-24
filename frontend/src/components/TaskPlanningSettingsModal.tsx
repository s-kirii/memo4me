type SprintCalendarMode = "calendar_days" | "working_days";

type TaskPlanningSettingsModalProps = {
  isOpen: boolean;
  sprintCalendarMode: SprintCalendarMode;
  onSelectSprintCalendarMode: (mode: SprintCalendarMode) => void;
  onClose: () => void;
};

const SPRINT_CALENDAR_OPTIONS: Array<{
  id: SprintCalendarMode;
  label: string;
  description: string;
}> = [
  {
    id: "calendar_days",
    label: "全ての日で計算",
    description: "土日祝日も含めて、着手日から期日までを均等に割って進捗目標を計算します。",
  },
  {
    id: "working_days",
    label: "稼働日で計算",
    description: "日本の土日祝日を除いた営業日だけで進捗目標を計算します。",
  },
];

export function TaskPlanningSettingsModal({
  isOpen,
  sprintCalendarMode,
  onSelectSprintCalendarMode,
  onClose,
}: TaskPlanningSettingsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card task-planning-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-planning-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">タスク</p>
            <h2 id="task-planning-settings-title">進捗計算設定</h2>
            <p className="modal-description">
              `今日のスプリント達成率` で使う日数の数え方を切り替えます。
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="task-planning-settings-list">
          {SPRINT_CALENDAR_OPTIONS.map((option) => (
            <label key={option.id} className="task-planning-settings-option">
              <input
                type="radio"
                name="task-planning-calendar-mode"
                value={option.id}
                checked={sprintCalendarMode === option.id}
                onChange={() => onSelectSprintCalendarMode(option.id)}
              />
              <div>
                <strong>{option.label}</strong>
                <p>{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

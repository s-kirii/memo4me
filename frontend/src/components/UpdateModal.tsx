import { useEffect, useState } from "react";

type UpdateModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function formatUpdateTimestamp(value: string | null) {
  if (!value) {
    return "未確認";
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

export function UpdateModal({ isOpen, onClose }: UpdateModalProps) {
  const [state, setState] = useState<Memo4meUpdateState | null>(() => {
    const bridge = window.memo4meDesktop;
    if (!bridge?.isElectron) {
      return {
        supported: false,
        enabled: false,
        status: "unsupported",
        currentVersion: "不明",
        targetVersion: null,
        progressPercent: null,
        message: "更新機能はデスクトップ版で利用できます。",
        lastCheckedAt: null,
      };
    }

    const supported = bridge.platform === "win32" && bridge.arch === "x64";
    return {
      supported,
      enabled: supported,
      status: supported ? "idle" : "unsupported",
      currentVersion: "確認中",
      targetVersion: null,
      progressPercent: null,
      message: supported
        ? "更新を確認できます。"
        : "自動更新は現在 Windows x64 のデスクトップ版でのみ利用できます。",
      lastCheckedAt: null,
    };
  });
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !window.memo4meDesktop) {
      return;
    }

    let cancelled = false;
    const bridge = window.memo4meDesktop;

    void bridge.getUpdateState().then((nextState) => {
      if (!cancelled) {
        setState(nextState);
      }
    }).catch((error) => {
      if (!cancelled) {
        setState((currentState) => ({
          supported: currentState?.supported ?? false,
          enabled: false,
          status: "error",
          currentVersion: currentState?.currentVersion ?? "不明",
          targetVersion: null,
          progressPercent: null,
          message:
            error instanceof Error
              ? `更新状態の取得に失敗しました: ${error.message}`
              : "更新状態の取得に失敗しました。",
          lastCheckedAt: new Date().toISOString(),
        }));
        setIsBusy(false);
      }
    });

    const unsubscribe = bridge.onUpdateStateChanged((nextState) => {
      if (!cancelled) {
        setState(nextState);
        if (nextState.status !== "checking" && nextState.status !== "downloading") {
          setIsBusy(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isElectron = Boolean(window.memo4meDesktop?.isElectron);
  const updateState = state;
  const canCheck =
    isElectron &&
    updateState?.supported &&
    updateState?.status !== "checking" &&
    updateState?.status !== "downloading";
  const canDownload = updateState?.status === "available";
  const canInstall = updateState?.status === "downloaded";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card update-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">デスクトップ版</p>
            <h2 id="update-modal-title">更新</h2>
            <p className="modal-description">
              GitHub Releases を確認して、新しい版があればダウンロードできます。
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <section className="modal-section update-status-card">
          <div className="update-status-row">
            <span className="update-status-label">現在のバージョン</span>
            <strong>{updateState?.currentVersion ?? "不明"}</strong>
          </div>
          <div className="update-status-row">
            <span className="update-status-label">確認結果</span>
            <strong>{updateState?.message ?? "更新状態を読み込んでいます…"}</strong>
          </div>
          <div className="update-status-row">
            <span className="update-status-label">最新候補</span>
            <strong>{updateState?.targetVersion ?? "なし"}</strong>
          </div>
          <div className="update-status-row">
            <span className="update-status-label">最終確認</span>
            <span>{formatUpdateTimestamp(updateState?.lastCheckedAt ?? null)}</span>
          </div>
          {typeof updateState?.progressPercent === "number" ? (
            <div className="update-progress-block" aria-live="polite">
              <div className="update-progress-bar">
                <span
                  className="update-progress-fill"
                  style={{ width: `${Math.max(0, Math.min(100, updateState.progressPercent))}%` }}
                />
              </div>
              <span className="update-progress-label">
                {Math.round(updateState.progressPercent)}%
              </span>
            </div>
          ) : null}
        </section>

        <div className="modal-footer update-modal-actions">
          <button
            type="button"
            className="ghost-button"
            disabled={!canCheck || isBusy}
            onClick={() => {
              if (!window.memo4meDesktop) {
                return;
              }

              setIsBusy(true);
              void window.memo4meDesktop.checkForUpdates().catch(() => {
                setIsBusy(false);
              });
            }}
          >
            更新を確認
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canDownload || isBusy}
            onClick={() => {
              if (!window.memo4meDesktop) {
                return;
              }

              setIsBusy(true);
              void window.memo4meDesktop.downloadUpdate().catch(() => {
                setIsBusy(false);
              });
            }}
          >
            ダウンロード
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canInstall || isBusy}
            onClick={() => {
              if (!window.memo4meDesktop) {
                return;
              }

              setIsBusy(true);
              void window.memo4meDesktop.quitAndInstallUpdate();
            }}
          >
            再起動して更新
          </button>
        </div>

        {!isElectron ? (
          <p className="inline-note update-inline-note">
            更新機能はデスクトップ版で利用できます。browser-mode では使えません。
          </p>
        ) : null}
      </div>
    </div>
  );
}

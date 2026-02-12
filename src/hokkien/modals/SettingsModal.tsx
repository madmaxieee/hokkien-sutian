import { X } from "lucide-react";

export type ThemeMode = "system" | "light" | "dark";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const IOStoggle = ({ label, checked, onChange }: ToggleProps) => (
  <label className="flex items-center justify-between cursor-pointer py-3">
    <span className="text-foreground">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? "bg-blue-600 dark:bg-blue-500" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </label>
);

export const SettingsModal = ({
  isOpen,
  onClose,
  forceSingleColumn,
  onForceSingleColumnChange,
  alwaysShowButtons,
  onAlwaysShowButtonsChange,
  fallbackAutoSwitchQueryMode,
  onFallbackAutoSwitchQueryModeChange,
  themeMode,
  onThemeModeChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  forceSingleColumn: boolean;
  onForceSingleColumnChange: (value: boolean) => void;
  alwaysShowButtons: boolean;
  onAlwaysShowButtonsChange: (value: boolean) => void;
  fallbackAutoSwitchQueryMode: boolean;
  onFallbackAutoSwitchQueryModeChange: (value: boolean) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (value: ThemeMode) => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-md m-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold">設定</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4">
          <div className="divide-y divide-border">
            <IOStoggle
              label="總是顯示操作按鈕 (Always Show Copy/Link)"
              checked={alwaysShowButtons}
              onChange={onAlwaysShowButtonsChange}
            />
            <IOStoggle
              label="強制單欄顯示 (Always 1 Col)"
              checked={forceSingleColumn}
              onChange={onForceSingleColumnChange}
            />
            <IOStoggle
              label="查無結果時自動切換查詢模式"
              checked={fallbackAutoSwitchQueryMode}
              onChange={onFallbackAutoSwitchQueryModeChange}
            />

            <div className="py-3">
              <div className="text-sm font-semibold text-muted-foreground mb-2">
                主題 (Theme)
              </div>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="themeMode"
                    value="system"
                    checked={themeMode === "system"}
                    onChange={() => onThemeModeChange("system")}
                  />
                  <span className="w-5 h-5 rounded-full border-2 border-border bg-background peer-checked:border-blue-600 dark:peer-checked:border-blue-400 flex items-center justify-center transition">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 scale-0 peer-checked:scale-100 transition-transform duration-150" />
                  </span>
                  <span className="text-foreground">跟隨系統 (System)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="themeMode"
                    value="light"
                    checked={themeMode === "light"}
                    onChange={() => onThemeModeChange("light")}
                  />
                  <span className="w-5 h-5 rounded-full border-2 border-border bg-background peer-checked:border-blue-600 dark:peer-checked:border-blue-400 flex items-center justify-center transition">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 scale-0 peer-checked:scale-100 transition-transform duration-150" />
                  </span>
                  <span className="text-foreground">淺色 (Light)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="themeMode"
                    value="dark"
                    checked={themeMode === "dark"}
                    onChange={() => onThemeModeChange("dark")}
                  />
                  <span className="w-5 h-5 rounded-full border-2 border-border bg-background peer-checked:border-blue-600 dark:peer-checked:border-blue-400 flex items-center justify-center transition">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 scale-0 peer-checked:scale-100 transition-transform duration-150" />
                  </span>
                  <span className="text-foreground">深色 (Dark)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { X } from "lucide-react";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const IOStoggle = ({ label, checked, onChange }: ToggleProps) => (
  <label className="flex items-center justify-between cursor-pointer py-3">
    <span className="text-gray-700">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
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
}: {
  isOpen: boolean;
  onClose: () => void;
  forceSingleColumn: boolean;
  onForceSingleColumnChange: (value: boolean) => void;
  alwaysShowButtons: boolean;
  onAlwaysShowButtonsChange: (value: boolean) => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4">
          <div className="divide-y divide-gray-200">
            <IOStoggle
              label="總是顯示操作按鈕 (Copy/Link)"
              checked={alwaysShowButtons}
              onChange={onAlwaysShowButtonsChange}
            />
            <IOStoggle
              label="強制單欄顯示 (Always 1 Col)"
              checked={forceSingleColumn}
              onChange={onForceSingleColumnChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

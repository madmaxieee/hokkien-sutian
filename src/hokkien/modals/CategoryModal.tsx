import { X } from "lucide-react";

export const CategoryModal = ({
  isOpen,
  onClose,
  categories,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSelect: (category: string) => void;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full m-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">依分類瀏覽</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className="text-left p-2 rounded hover:bg-blue-100 text-blue-700"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

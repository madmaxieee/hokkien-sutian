import type { ToneGroup } from "../types";
import { TONE_LABELS } from "../phonetics";

export const ToneGroupDisplay = ({
  groups,
  onEntryClick,
}: {
  groups: ToneGroup[];
  onEntryClick: (id: number) => void;
}) => {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div
          key={group.tone}
          className="border border-border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden"
        >
          <div className="bg-accent px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-blue-600 font-mono">
                {group.syllable}
              </span>
              <span className="text-sm text-muted-foreground">
                {TONE_LABELS[group.tone]} ({group.entries.length}字)
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {group.entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onEntryClick(entry.id)}
                  className="text-2xl hover:bg-accent hover:text-blue-700 px-2 py-1 rounded transition-colors"
                  title={`${entry.hanzi} (${entry.romanization})`}
                >
                  {entry.hanzi.replace(/【.*?】/g, "").trim()}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

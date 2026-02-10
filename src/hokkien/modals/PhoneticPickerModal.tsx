import React, { useEffect, useState } from "react";
import type { Database } from "sql.js";
import { X } from "lucide-react";

import type { PhoneticQuery } from "../types";
import {
  FINALS,
  INITIALS,
  TONES,
  TONE_LABELS,
  parseSyllable,
} from "../phonetics";

export const PhoneticPickerModal = ({
  isOpen,
  onClose,
  onSearch,
  db,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: PhoneticQuery, resultCount: number) => void;
  db: Database | null;
}) => {
  const [selectedInitial, setSelectedInitial] = useState<string | null>(null);
  const [selectedFinal, setSelectedFinal] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<number | null>(null);
  const [singleSyllableOnly, setSingleSyllableOnly] = useState<boolean>(true);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [syllableIndex, setSyllableIndex] = useState<Map<string, Set<number>>>(
    new Map(),
  );
  const [multiSyllableIndex, setMultiSyllableIndex] = useState<
    Map<string, Set<number>>
  >(new Map());
  const [availableInitials, setAvailableInitials] = useState<Set<string>>(
    new Set(),
  );
  const [availableFinals, setAvailableFinals] = useState<Set<string>>(
    new Set(),
  );
  const [availableTones, setAvailableTones] = useState<Set<number>>(new Set());

  // Build syllable index on mount
  useEffect(() => {
    if (!db || !isOpen) return;

    const singleIndex = new Map<string, Set<number>>();
    const multiIndex = new Map<string, Set<number>>();
    const allInitials = new Set<string>();
    const allFinals = new Set<string>();
    const allTones = new Set<number>();

    try {
      const result = db.exec("SELECT id, romanization FROM entries");
      if (result.length > 0) {
        for (const row of result[0].values) {
          const id = row[0] as number;
          const romanization = row[1] as string;
          if (!romanization) continue;

          // Handle alternative pronunciations separated by "/"
          const pronunciationVariants = romanization.split("/");

          for (const variant of pronunciationVariants) {
            const syllables = variant.split(/[-\s]+/).filter((s) => s.trim());
            const isSingleSyllable = syllables.length === 1;

            for (const syl of syllables) {
              const { initial, final, tone } = parseSyllable(syl);
              if (!final) continue; // Skip if no valid final

              const key = `${initial || "ling"}|${final}|${tone}`;

              if (isSingleSyllable) {
                if (!singleIndex.has(key)) singleIndex.set(key, new Set());
                singleIndex.get(key)!.add(id);
              } else {
                if (!multiIndex.has(key)) multiIndex.set(key, new Set());
                multiIndex.get(key)!.add(id);
              }

              allInitials.add(initial || "ling");
              allFinals.add(final);
              allTones.add(tone);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error building syllable index:", err);
    }

    setSyllableIndex(singleIndex);
    setMultiSyllableIndex(multiIndex);
    setAvailableInitials(allInitials);
    setAvailableFinals(allFinals);
    setAvailableTones(allTones);
  }, [db, isOpen]);

  // Update match count and available options when selection changes
  useEffect(() => {
    if (syllableIndex.size === 0 && multiSyllableIndex.size === 0) return;

    const matchingIds = new Set<number>();
    const validInitials = new Set<string>();
    const validFinals = new Set<string>();
    const validTones = new Set<number>();

    // Choose which indices to use based on singleSyllableOnly
    const indicesToUse = singleSyllableOnly
      ? [syllableIndex]
      : [syllableIndex, multiSyllableIndex];

    for (const index of indicesToUse) {
      for (const [key, ids] of index) {
        const [init, fin, t] = key.split("|");
        const tone = parseInt(t);

        const matchesInitial =
          selectedInitial === null || init === selectedInitial;
        const matchesFinal = selectedFinal === null || fin === selectedFinal;
        const matchesTone = selectedTone === null || tone === selectedTone;

        if (matchesInitial && matchesFinal && matchesTone) {
          ids.forEach((id) => matchingIds.add(id));
        }

        // Track what's available given current selection
        if (matchesFinal && matchesTone) validInitials.add(init);
        if (matchesInitial && matchesTone) validFinals.add(fin);
        if (matchesInitial && matchesFinal) validTones.add(tone);
      }
    }

    setMatchCount(matchingIds.size);
    setAvailableInitials(validInitials);
    setAvailableFinals(validFinals);
    setAvailableTones(validTones);
  }, [
    selectedInitial,
    selectedFinal,
    selectedTone,
    syllableIndex,
    multiSyllableIndex,
    singleSyllableOnly,
  ]);

  const handleSearch = () => {
    onSearch(
      {
        initial: selectedInitial,
        final: selectedFinal,
        tone: selectedTone,
        singleSyllableOnly,
      },
      matchCount,
    );
    onClose();
  };

  const handleReset = () => {
    setSelectedInitial(null);
    setSelectedFinal(null);
    setSelectedTone(null);
    setSingleSyllableOnly(true);
  };

  if (!isOpen) return null;

  const ButtonPill = ({
    selected,
    available,
    onClick,
    children,
  }: {
    selected: boolean;
    available: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={!available && !selected}
      className={`px-2 py-1 rounded text-sm font-mono transition-colors ${
        selected
          ? "bg-blue-600 dark:bg-blue-500 text-white"
          : available
            ? "bg-muted hover:bg-accent text-foreground"
            : "bg-muted/40 text-muted-foreground/60 cursor-not-allowed"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] m-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-xl font-bold">聲韻調查詢</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Initial Consonants */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              聲母 (Initial)
              {selectedInitial && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  : {selectedInitial === "ling" ? "零聲母" : selectedInitial}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-1">
              <ButtonPill
                selected={selectedInitial === "ling"}
                available={availableInitials.has("ling")}
                onClick={() =>
                  setSelectedInitial(selectedInitial === "ling" ? null : "ling")
                }
              >
                零
              </ButtonPill>
              {INITIALS.map((init) => (
                <ButtonPill
                  key={init}
                  selected={selectedInitial === init}
                  available={availableInitials.has(init)}
                  onClick={() =>
                    setSelectedInitial(selectedInitial === init ? null : init)
                  }
                >
                  {init}
                </ButtonPill>
              ))}
            </div>
          </div>

          {/* Finals */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              韻母 (Final)
              {selectedFinal && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">: {selectedFinal}</span>
              )}
            </h3>
            <div className="flex flex-wrap gap-1">
              {FINALS.map((fin) => (
                <ButtonPill
                  key={fin}
                  selected={selectedFinal === fin}
                  available={availableFinals.has(fin)}
                  onClick={() =>
                    setSelectedFinal(selectedFinal === fin ? null : fin)
                  }
                >
                  {fin}
                </ButtonPill>
              ))}
            </div>
          </div>

          {/* Tones */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              聲調 (Tone)
              {selectedTone && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  : {TONE_LABELS[selectedTone]}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <ButtonPill
                  key={tone}
                  selected={selectedTone === tone}
                  available={availableTones.has(tone)}
                  onClick={() =>
                    setSelectedTone(selectedTone === tone ? null : tone)
                  }
                >
                  {TONE_LABELS[tone]}
                </ButtonPill>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={singleSyllableOnly}
                onChange={(e) => setSingleSyllableOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-border focus:ring-blue-500"
              />
              <span className="text-sm text-foreground">
                僅顯示單音節詞（單字）
              </span>
            </label>
          </div>

          {/* Preview */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">符合條件: </span>
                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                  {matchCount.toLocaleString()}
                </span>
                <span className="text-muted-foreground"> 筆</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  重設
                </button>
                <button
                  onClick={handleSearch}
                  disabled={matchCount === 0}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                >
                  查詢
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

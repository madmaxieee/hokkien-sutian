import { memo } from "react";
import { Virtuoso } from "react-virtuoso";
import type { Result } from "../types";
import { ResultCard } from "./ResultCard";

interface ResultsListProps {
  results: Result[];
  onPermalinkClick: (id: number) => void;
  onCategoryClick: (category: string) => void;
  alwaysShowButtons: boolean;
  isSingleEntryView: boolean;
  forceSingleColumn: boolean;
}

export const ResultsList = memo(({
  results,
  onPermalinkClick,
  onCategoryClick,
  alwaysShowButtons,
  isSingleEntryView,
  forceSingleColumn,
}: ResultsListProps) => {
  const isSingleColumn = isSingleEntryView || forceSingleColumn || results.length <= 1;
  // Only virtualize when single-column is already the layout —
  // Virtuoso cannot work with CSS columns-2 (it requires flat vertical flow).
  const shouldVirtualize = results.length > 100 && isSingleColumn;

  if (shouldVirtualize) {
    return (
      <div className="max-w-4xl mx-auto" data-testid="results-container">
        <Virtuoso
          useWindowScroll
          data={results}
          itemContent={(_index, result) => (
            <ResultCard
              key={`${result.id}-${result.hanzi}`}
              result={result}
              onPermalinkClick={onPermalinkClick}
              onCategoryClick={onCategoryClick}
              alwaysShowButtons={alwaysShowButtons}
            />
          )}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="results-container"
      className={`transition-all duration-500 ${
        isSingleColumn ? "max-w-4xl mx-auto" : "lg:columns-2 lg:gap-x-8"
      }`}
    >
      {results.map((result) => (
        <ResultCard
          key={`${result.id}-${result.hanzi}`}
          result={result}
          onPermalinkClick={onPermalinkClick}
          onCategoryClick={onCategoryClick}
          alwaysShowButtons={alwaysShowButtons}
        />
      ))}
    </div>
  );
});

ResultsList.displayName = "ResultsList";

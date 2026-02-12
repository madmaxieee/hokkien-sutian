import { memo } from "react";
import { Link as LinkIcon } from "lucide-react";

import type { Result } from "../types";
import { AudioControls } from "./AudioControls";
import { getMoeEntryUrl } from "../urls";
import {
  CopyButton,
  CopyableText,
  DetailSection,
  SuiSiannLink,
} from "./common";
import { PhoneticDifferencesTable } from "./PhoneticDifferencesTable";

export const ResultCard = memo(
  ({
    result,
    onPermalinkClick,
    onCategoryClick,
    alwaysShowButtons = true,
  }: {
    result: Result;
    onPermalinkClick: (id: number) => void;
    onCategoryClick: (category: string) => void;
    alwaysShowButtons?: boolean;
  }) => {
    const hasMeanings = (result.meanings?.length ?? 0) > 0;

    return (
      <div className="border border-border rounded-lg p-6 mb-8 shadow-sm bg-card text-card-foreground break-inside-avoid-column">
        <div
          className={`inline-flex items-center gap-2 ${alwaysShowButtons ? "" : "group"}`}
        >
          <a
            href={getMoeEntryUrl(result.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            <h2 className="text-4xl font-bold mb-1 inline-block">
              {result.hanzi}
            </h2>
          </a>
          <div
            className={`flex items-center gap-2 ${alwaysShowButtons ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}
          >
            <CopyButton textToCopy={result.hanzi} />
            <SuiSiannLink text={result.hanzi} />
            <button
              onClick={() => onPermalinkClick(result.id)}
              title="Link to this entry"
              className="text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <LinkIcon size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center text-xl text-blue-600 dark:text-blue-400 font-mono mb-4">
          <CopyableText
            text={result.romanization}
            alwaysShowButtons={alwaysShowButtons}
          />
          <AudioControls entryId={result.audio_file ? result.id : null} />
        </div>

        {hasMeanings && (
          <div className="space-y-5">
            {result.meanings?.map((meaning) => (
              <div
                key={meaning.id}
                className="border-t border-border pt-4 first:border-t-0"
              >
                <div className="flex items-start">
                  <span className="text-muted-foreground mr-2">
                    {meaning.display_id}.
                  </span>
                  <div className="flex-grow">
                    <p className="text-lg">
                      {meaning.part_of_speech && (
                        <strong className="font-semibold">
                          {meaning.part_of_speech}
                        </strong>
                      )}
                      {` ${meaning.explanation.replace(/^:/, "").trim()}`}
                    </p>
                    {result.meaning_synonyms?.has(meaning.id) && (
                      <div className="mt-3 pl-4">
                        <span className="text-muted-foreground text-sm">
                          近義：
                        </span>
                        {result.meaning_synonyms
                          .get(meaning.id)
                          ?.map((syn, i, arr) => (
                            <span key={syn.meaningId}>
                              <button
                                onClick={() => onPermalinkClick(syn.entryId)}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {syn.hanzi}
                              </button>
                              {i < arr.length - 1 && (
                                <span className="text-muted-foreground/70">
                                  、
                                </span>
                              )}
                            </span>
                          ))}
                      </div>
                    )}
                    {meaning.examples?.length > 0 && (
                      <div className="mt-2 pl-4 border-l-2 border-border">
                        <h4 className="font-semibold text-muted-foreground">
                          用例:
                        </h4>
                        <ul className="list-none space-y-3 mt-1">
                          {meaning.examples.map((ex, index) => (
                            <li key={index} className="flex flex-col">
                              <CopyableText
                                text={ex.hanzi}
                                alwaysShowButtons={alwaysShowButtons}
                              />
                              <CopyableText
                                text={ex.romanization}
                                className="text-blue-500 dark:text-blue-400 font-mono text-sm"
                                alwaysShowButtons={alwaysShowButtons}
                              />
                              <p className="text-muted-foreground text-sm">
                                ({ex.mandarin_translation})
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className={`${hasMeanings ? "mt-6 border-t border-border pt-4" : "mt-4"} text-sm text-muted-foreground space-y-1`}
        >
          <DetailSection title="又唸作">
            {result.alternative_pronunciations?.map((alt, i) => (
              <span key={i} className="text-blue-600 dark:text-blue-400">
                <CopyableText
                  text={alt.romanization}
                  alwaysShowButtons={alwaysShowButtons}
                />
              </span>
            ))}
          </DetailSection>
          <DetailSection title="異用字">
            {result.variant_characters?.map((v, i) => (
              <span key={i}>{v}</span>
            ))}
          </DetailSection>
          <DetailSection title="近義詞">
            {result.entry_synonyms?.map((syn) => (
              <button
                key={syn.id}
                onClick={() => onPermalinkClick(syn.id)}
                className="text-blue-600 dark:text-blue-400 hover:underline mr-2"
              >
                {syn.hanzi}
              </button>
            ))}
          </DetailSection>
          <DetailSection title="分類">
            {(result.category ?? "")
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
              .map((cat, i, arr) => (
                <span key={cat}>
                  <button
                    onClick={() => onCategoryClick(cat)}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {cat}
                  </button>
                  {i < arr.length - 1 && (
                    <span className="text-muted-foreground/70">、</span>
                  )}
                </span>
              ))}
          </DetailSection>
        </div>

        <PhoneticDifferencesTable
          data={result.phonetic_differences}
          alwaysShowButtons={alwaysShowButtons}
        />
      </div>
    );
  },
);

ResultCard.displayName = "ResultCard";

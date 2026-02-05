import { Link as LinkIcon } from "lucide-react";

import type { Result } from "../types";
import { AudioControls } from "./AudioControls";
import { CopyButton, CopyableText, DetailSection } from "./common";
import { PhoneticDifferencesTable } from "./PhoneticDifferencesTable";

export const ResultCard = ({
  result,
  onPermalinkClick,
}: {
  result: Result;
  onPermalinkClick: (id: number) => void;
}) => {
  const audioId = result.audio_file?.match(/\d+/)?.[0] ?? null;

  return (
    <div className="border border-gray-200 rounded-lg p-6 mb-8 shadow-sm bg-white break-inside-avoid-column">
      <div className="group inline-flex items-center gap-2">
        <a
          href={`https://sutian.moe.edu.tw/zh-hant/su/${result.id}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-1 inline-block">
            {result.hanzi}
          </h2>
        </a>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <CopyButton textToCopy={result.hanzi} />
          <button
            onClick={() => onPermalinkClick(result.id)}
            title="Link to this entry"
            className="text-gray-400 hover:text-blue-600"
          >
            <LinkIcon size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center text-xl text-blue-600 font-mono mb-4">
        <CopyableText text={result.romanization} />
        <AudioControls audioId={audioId} />
      </div>

      <div className="space-y-5">
        {result.meanings?.map((meaning) => (
          <div key={meaning.id} className="border-t pt-4 first:border-t-0">
            <div className="flex items-start">
              <span className="text-gray-500 mr-2">{meaning.display_id}.</span>
              <div className="flex-grow">
                <p className="text-lg text-gray-800">
                  {meaning.part_of_speech && (
                    <strong className="font-semibold">
                      {meaning.part_of_speech}
                    </strong>
                  )}
                  {` ${meaning.explanation.replace(/^:/, "").trim()}`}
                </p>
                {meaning.examples?.length > 0 && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-100">
                    <h4 className="font-semibold text-gray-600">用例:</h4>
                    <ul className="list-none space-y-3 mt-1">
                      {meaning.examples.map((ex, index) => (
                        <li key={index}>
                          <CopyableText
                            text={ex.hanzi}
                            className="text-gray-800"
                          />
                          <CopyableText
                            text={ex.romanization}
                            className="text-blue-500 font-mono text-sm"
                          />
                          <p className="text-gray-500 text-sm">
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

      <div className="mt-6 border-t pt-4 text-sm text-gray-500 space-y-1">
        <DetailSection title="又見音">
          {result.alternative_pronunciations?.map((alt, i) => (
            <a
              href={`https://sutian.moe.edu.tw/zh-hant/su/${alt.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              key={i}
              className="text-blue-600 hover:underline"
            >
              <CopyableText text={`${alt.hanzi} ${alt.romanization}`} />
            </a>
          ))}
        </DetailSection>
        <DetailSection title="異用字">
          {result.variant_characters?.map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </DetailSection>
        <DetailSection title="分類">
          <span>{result.category?.replace(/,/g, " ")}</span>
        </DetailSection>
      </div>

      <PhoneticDifferencesTable data={result.phonetic_differences} />
    </div>
  );
};

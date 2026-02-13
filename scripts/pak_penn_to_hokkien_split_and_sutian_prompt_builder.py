#!/usr/bin/env uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "jieba",
#     "loguru",
#     "opencc",
# ]
# ///
import argparse
import json
import pathlib
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import jieba
import jieba.posseg as pseg
from loguru import logger
import opencc

# --- Configuration ---
logger.remove()
logger.add(
    sys.stderr,
    level="INFO",
    format="<level>{level: <8}</level> | <level>{message}</level>",
)

DEFAULT_LLM_PROMPT = """\n---
### LLM INSTRUCTION

Based on the original text and the provided dictionary lookups for each word, please translate the "Original Input" from 北平方言 to hokkien （需要漢字和音標）. Use the dictionary examples to ensure the translation is natural and accurate.
"""

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
QUERY_SCRIPT_PATH = SCRIPT_DIR / "query.ts"
TO_ZH_TW_CONVERTER = opencc.OpenCC("s2twp.json")
DEFAULT_QUERY_MODE = "mf"
DEFAULT_MAX_RESULTS_PER_WORD = 3
DEFAULT_MAX_MEANINGS_PER_ENTRY = 12
DEFAULT_MAX_EXAMPLES_PER_MEANING = 1

# --- Core Functions ---


def invoke_cli(
    term: str,
    mode: str = DEFAULT_QUERY_MODE,
    db_path: str | None = None,
    no_fallback: bool = False,
) -> dict[str, Any]:
    """
    Invokes the hokkien-sutian-query CLI and returns parsed JSON.

    Args:
        term: The search term.
        mode: The search mode (default: mf / mandarin_fulltext).
        db_path: Optional database path.
        no_fallback: Disable CLI fallback auto-switch.

    Returns:
        Parsed JSON dict with keys: mode, requestedMode, term, results.
    """
    query_term = TO_ZH_TW_CONVERTER.convert(term)
    cmd = ["bun", "run", str(QUERY_SCRIPT_PATH), mode, query_term, "--no-pretty"]
    if db_path:
        cmd.extend(["--db", db_path])
    if no_fallback:
        cmd.append("--no-fallback-auto-switch-query-mode")

    logger.debug(f"Invoking CLI: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8",
        )
        return json.loads(result.stdout)
    except FileNotFoundError:
        logger.error("FATAL: 'bun' command not found. Please install Bun.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        logger.error(f"CLI command failed with exit code {e.returncode}")
        logger.error(f"Stderr: {e.stderr}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse CLI JSON output: {e}")
        sys.exit(1)


def normalize_hanzi(hanzi: str) -> str:
    """
    Normalizes hanzi by stripping annotations like 【白】, 【文】, 【替】.

    Args:
        hanzi: The hanzi string to normalize.

    Returns:
        Normalized hanzi string.
    """
    return re.sub(r"【[^】]+】", "", hanzi)


def group_results_by_hanzi(
    results: list[dict[str, Any]],
) -> list[tuple[str, list[dict[str, Any]]]]:
    """
    Groups results by normalized hanzi.

    Args:
        results: List of Result dicts from CLI.

    Returns:
        List of (normalized_hanzi, [result_dicts]) tuples.
    """
    groups: dict[str, list[dict[str, Any]]] = {}
    for result in results:
        normalized = normalize_hanzi(result["hanzi"])
        if normalized not in groups:
            groups[normalized] = []
        groups[normalized].append(result)
    return list(groups.items())


def format_entry_markdown(entry: dict[str, Any], header_level: str = "####") -> str:
    """
    Formats a single Result dict as Markdown.

    Args:
        entry: A Result dict.
        header_level: Markdown header level (default: ####).

    Returns:
        Formatted Markdown string.
    """
    lines = []

    # Header: hanzi romanization (#id)
    lines.append(
        f"{header_level} {entry['hanzi']} {entry['romanization']} (#{entry['id']})"
    )
    lines.append("")

    # Category
    if entry.get("category"):
        lines.append(f"**分類：** {entry['category']}")
        lines.append("")

    # Meanings
    meanings = entry.get("meanings", [])
    for meaning in meanings[:DEFAULT_MAX_MEANINGS_PER_ENTRY]:
        pos = meaning.get("part_of_speech", "")
        explanation = meaning.get("explanation", "")
        examples = meaning.get("examples", [])
        display_id = meaning.get("display_id", 0)

        # Numbered meaning with POS and explanation
        lines.append(f"{display_id}. ({pos}) {explanation}")

        # Examples
        for example in examples[:DEFAULT_MAX_EXAMPLES_PER_MEANING]:
            hanzi_ex = example.get("hanzi", "")
            romanization_ex = example.get("romanization", "")
            mandarin_ex = example.get("mandarin_translation", "")
            lines.append(f"   - {hanzi_ex} ({romanization_ex})")
            if mandarin_ex:
                lines.append(f"     {mandarin_ex}")

        if len(examples) > DEFAULT_MAX_EXAMPLES_PER_MEANING:
            lines.append(
                f"   - …（省略 {len(examples) - DEFAULT_MAX_EXAMPLES_PER_MEANING} 例）"
            )

        lines.append("")

    if len(meanings) > DEFAULT_MAX_MEANINGS_PER_ENTRY:
        lines.append(
            f"*（省略 {len(meanings) - DEFAULT_MAX_MEANINGS_PER_ENTRY} 條義項）*"
        )
        lines.append("")

    # Entry synonyms
    entry_synonyms = entry.get("entry_synonyms", [])
    if entry_synonyms:
        synonym_strs = [f"{syn['hanzi']} (#{syn['id']})" for syn in entry_synonyms]
        lines.append(f"**近義詞：** {', '.join(synonym_strs)}")
        lines.append("")

    # Meaning synonyms (serialized as object, not Map)
    meaning_synonyms = entry.get("meaning_synonyms", {})
    if meaning_synonyms:
        lines.append("**義近詞：**")
        for meaning_id, synonyms in meaning_synonyms.items():
            for syn in synonyms:
                syn_hanzi = syn.get("hanzi", "")
                syn_explanation = syn.get("explanation", "")
                lines.append(f"   - {syn_hanzi}: {syn_explanation}")
        lines.append("")

    # Variant characters
    variants = entry.get("variant_characters", [])
    if variants:
        lines.append(f"**異體字：** {', '.join(variants)}")
        lines.append("")

    # Alternative pronunciations
    alt_pronunciations = entry.get("alternative_pronunciations", [])
    if alt_pronunciations:
        lines.append("**又音：**")
        for alt in alt_pronunciations:
            lines.append(f"   - {alt['hanzi']} {alt['romanization']}")
        lines.append("")

    return "\n".join(lines).rstrip()


def format_query_section(
    query_word: str,
    entries: list[dict[str, Any]],
    is_char_fallback: bool = False,
) -> str:
    """
    Formats a section for a query word with its entries.

    Args:
        query_word: The original query word.
        entries: List of Result dicts.
        is_char_fallback: Whether this is a character fallback section.

    Returns:
        Formatted Markdown section.
    """
    header_level = "#### └─" if is_char_fallback else "###"
    query_type = "字元查詢" if is_char_fallback else "詞語查詢"

    lines = [f"{header_level} {query_type}：「{query_word}」", ""]

    if not entries:
        lines.append("*（無查詢結果）*")
    else:
        entry_header = "##### " if is_char_fallback else "####"
        for entry in entries:
            lines.append(format_entry_markdown(entry, entry_header))
            lines.append("")

    lines.append("---")
    return "\n".join(lines)


def assemble_document(
    input_text: str,
    sections: list[str],
    prompt: str,
) -> str:
    """
    Assembles the final Markdown document.

    Args:
        input_text: The original input text.
        sections: List of formatted section strings.
        prompt: The LLM instruction prompt.

    Returns:
        Complete Markdown document.
    """
    parts = [
        "# Translation Pre-processing Document\n",
        "## Original Input\n",
        f"> {input_text}\n",
        "---\n",
        "## Dictionary Lookup Results\n",
    ]
    parts.extend(sections)
    if prompt:
        parts.append(prompt.strip())
    return "\n".join(parts)


def segment_with_jieba(text: str) -> list[str]:
    """
    Segments text with jieba using TW->CN conversion, segmentation, and CN->TW back.
    Filters interjections and deduplicates.

    Args:
        text: Input Traditional Chinese text.

    Returns:
        List of unique segmented words.
    """
    logger.info("Initializing jieba...")
    jieba.initialize()

    logger.info("Initializing OpenCC converters...")
    tw_to_cn = opencc.OpenCC("tw2s.json")
    cn_to_tw = opencc.OpenCC("s2twp.json")

    logger.info("Converting to Simplified Chinese for segmentation...")
    simplified_text = tw_to_cn.convert(text)

    logger.info("Segmenting with jieba...")
    pos_to_drop = {"e", "y"}  # interjections, modal particles
    words_to_query = []
    dropped_words = []

    for word_cn, flag in pseg.cut(simplified_text):
        word_cn = word_cn.strip()
        if not word_cn:
            continue
        word_tw = cn_to_tw.convert(word_cn)
        if flag in pos_to_drop:
            dropped_words.append(f"{word_tw} ({flag})")
        else:
            words_to_query.append(word_tw)

    # Deduplicate while preserving order
    seen = set()
    unique_words = [x for x in words_to_query if not (x in seen or seen.add(x))]

    logger.info(
        f"Segmented into {len(unique_words)} unique words: {', '.join(unique_words)}"
    )
    if dropped_words:
        logger.info(
            f"Dropped {len(dropped_words)} interjections/particles: {', '.join(dropped_words)}"
        )

    return unique_words


def query_all_jieba(
    words: list[str],
    mode: str,
    db_path: str | None,
    no_fallback: bool,
    max_workers: int,
) -> dict[str, dict[str, Any]]:
    """
    Queries all words in parallel using ThreadPoolExecutor.

    Args:
        words: List of words to query.
        mode: CLI search mode.
        db_path: Optional database path.
        no_fallback: Disable fallback auto-switch.
        max_workers: Max parallel workers.

    Returns:
        Dict mapping word -> CLI response dict.
    """
    logger.info(
        f"Querying {len(words)} words in parallel (max_workers={max_workers})..."
    )
    results = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_word = {
            executor.submit(invoke_cli, word, mode, db_path, no_fallback): word
            for word in words
        }

        for future in as_completed(future_to_word):
            word = future_to_word[future]
            try:
                results[word] = future.result()
            except Exception as e:
                logger.error(f"Failed to query word '{word}': {e}")
                results[word] = {"results": []}

    return results


def strip_cjk_punctuation(text: str) -> str:
    """
    Strips CJK punctuation from text.

    Args:
        text: Input text.

    Returns:
        Text with CJK punctuation removed.
    """
    # CJK punctuation ranges
    return re.sub(r"[\u3000-\u303F\uFF00-\uFFEF]", "", text)


def is_queryable_word(word: str) -> bool:
    """Returns whether a segmented token should be queried."""
    cleaned = strip_cjk_punctuation(word).strip()
    if not cleaned:
        return False
    # Keep only tokens with Hanzi/Latin/digits, drop emoji/symbol-only tokens.
    if not re.search(r"[\u4E00-\u9FFFa-zA-Z0-9]", cleaned):
        return False
    return True


def is_single_cjk_char(word: str) -> bool:
    """Returns True if token is exactly one CJK ideograph."""
    return len(word) == 1 and bool(re.fullmatch(r"[\u4E00-\u9FFF]", word))


def trim_and_dedupe_results(
    term: str,
    results: list[dict[str, Any]],
    max_results_per_word: int,
    mode: str,
) -> list[dict[str, Any]]:
    """Dedupes by entry id and limits result count, with lightweight relevance ranking."""

    def score_entry(entry: dict[str, Any]) -> tuple[int, int]:
        score = 0
        if entry.get("hanzi") == term:
            score += 80

        for meaning in entry.get("meanings", []):
            explanation = str(meaning.get("explanation", ""))
            if term and term == explanation:
                score += 60
            elif term and term in explanation:
                score += 30

            for example in meaning.get("examples", []):
                mandarin_text = str(example.get("mandarin_translation", ""))
                if term and term == mandarin_text:
                    score += 70
                elif term and term in mandarin_text:
                    score += 40

        # Prefer older/lower ids when relevance ties.
        entry_id = entry.get("id") if isinstance(entry.get("id"), int) else 10**9
        return (score, -entry_id)

    effective_limit = max_results_per_word
    if mode == "mf":
        # Extra strict for mandarin_fulltext to prevent huge prompt payloads.
        if is_single_cjk_char(term):
            effective_limit = min(effective_limit, 1)
        elif len(term) == 2:
            effective_limit = min(effective_limit, 2)
    deduped: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for entry in results:
        entry_id = entry.get("id")
        if isinstance(entry_id, int) and entry_id in seen_ids:
            continue
        if isinstance(entry_id, int):
            seen_ids.add(entry_id)
        deduped.append(entry)

    deduped.sort(key=score_entry, reverse=True)

    if effective_limit > 0 and len(deduped) > effective_limit:
        return deduped[:effective_limit]
    return deduped


def run_default_path(
    input_text: str,
    mode: str,
    db_path: str | None,
    no_fallback: bool,
) -> list[str]:
    """
    Runs the default path: single CLI call on entire sentence.

    Args:
        input_text: The original input text.
        mode: CLI search mode.
        db_path: Optional database path.
        no_fallback: Disable fallback auto-switch.

    Returns:
        List of formatted section strings.
    """
    # Strip CJK punctuation before querying, but keep original for display
    query_text = strip_cjk_punctuation(input_text)

    logger.info(f"Querying entire sentence: {query_text}")
    response = invoke_cli(query_text, mode, db_path, no_fallback)

    results = response.get("results", [])
    logger.info(f"Found {len(results)} total results")

    if not results:
        return [format_query_section(input_text, [], is_char_fallback=False)]

    # Group by normalized hanzi
    groups = group_results_by_hanzi(results)

    sections = []
    for normalized_hanzi, group_results in groups:
        sections.append(
            format_query_section(
                normalized_hanzi, group_results, is_char_fallback=False
            )
        )

    return sections


def run_jieba_path(
    input_text: str,
    mode: str,
    db_path: str | None,
    no_fallback: bool,
    max_workers: int,
    max_results_per_word: int,
) -> list[str]:
    """
    Runs the jieba path: segment, parallel query, character fallback.

    Args:
        input_text: The original input text.
        mode: CLI search mode.
        db_path: Optional database path.
        no_fallback: Disable fallback auto-switch.
        max_workers: Max parallel workers.
        max_results_per_word: Maximum entries kept per queried token.

    Returns:
        List of formatted section strings.
    """
    # Segment with jieba
    segmented_words = segment_with_jieba(input_text)
    words = [word for word in segmented_words if is_queryable_word(word)]

    # Deduplicate while preserving order after filtering
    seen_filtered = set()
    words = [x for x in words if not (x in seen_filtered or seen_filtered.add(x))]

    removed_count = len(segmented_words) - len(words)
    if removed_count > 0:
        logger.info(f"Filtered out {removed_count} non-query tokens.")

    if not words:
        logger.warning("No words to query after segmentation.")
        return []

    # Query all words in parallel
    word_results = query_all_jieba(words, mode, db_path, no_fallback, max_workers)

    sections = []
    failed_words = []

    for word in words:
        response = word_results.get(word, {"results": []})
        raw_results = response.get("results", [])
        results = trim_and_dedupe_results(
            word,
            raw_results,
            max_results_per_word,
            mode,
        )
        if len(raw_results) > len(results):
            logger.info(
                f"Trimmed results for '{word}': {len(raw_results)} -> {len(results)}"
            )

        if results:
            # Word found: format normally
            sections.append(format_query_section(word, results, is_char_fallback=False))
        else:
            # Word not found: mark for character fallback
            failed_words.append(word)
            sections.append(format_query_section(word, [], is_char_fallback=False))

    # Character fallback for failed multi-character words
    if failed_words:
        logger.info(
            f"Words without results: {', '.join(failed_words)}. Falling back to character-level lookup."
        )

        # Collect unique characters from failed words
        chars_to_lookup = []
        seen_chars = set()
        for word in failed_words:
            if len(word) > 1:
                for char in word:
                    if char not in seen_chars:
                        chars_to_lookup.append(char)
                        seen_chars.add(char)

        if chars_to_lookup:
            logger.info(
                f"Looking up {len(chars_to_lookup)} characters: {', '.join(chars_to_lookup)}"
            )
            char_results = query_all_jieba(
                chars_to_lookup, mode, db_path, no_fallback, max_workers
            )

            # Build a map of character -> results for easy lookup
            char_to_entries = {}
            for char, response in char_results.items():
                raw_char_results = response.get("results", [])
                char_to_entries[char] = trim_and_dedupe_results(
                    char,
                    raw_char_results,
                    max_results_per_word,
                    mode,
                )

            # Append character sections under each failed word
            for word in failed_words:
                if len(word) > 1:
                    for char in word:
                        if char in char_to_entries:
                            sections.append(
                                format_query_section(
                                    char,
                                    char_to_entries[char],
                                    is_char_fallback=True,
                                )
                            )

    return sections


def read_input(args: argparse.Namespace) -> str:
    """
    Reads input from positional arg, --file, or stdin.

    Args:
        args: Parsed command-line arguments.

    Returns:
        Input text string.
    """
    if args.input_text:
        logger.info("Reading text from command-line argument...")
        return args.input_text.strip()
    elif args.file:
        logger.info(f"Reading text from file: {args.file}...")
        try:
            return args.file.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            logger.error(f"Input file not found: {args.file}")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Error reading from file {args.file}: {e}")
            sys.exit(1)
    elif not sys.stdin.isatty():
        logger.info("Reading text from standard input...")
        return sys.stdin.read().strip()
    else:
        logger.error(
            "No input text provided. Please provide text via argument, --file, or stdin."
        )
        sys.exit(1)


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="Pre-processor for 北平方言 to Hokkien translation. Queries local dictionary DB via hokkien-sutian-query CLI and generates a Markdown document for LLM translation.",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        "input_text",
        nargs="?",
        default=None,
        help="The input text to process. If omitted, reads from --file or stdin.",
    )
    input_group.add_argument(
        "-f",
        "--file",
        type=pathlib.Path,
        help="Path to a file containing the input text to process.",
    )

    # CLI pass-through options
    parser.add_argument(
        "--db",
        type=str,
        help="Database path (passed to query.ts -d).",
    )
    parser.add_argument(
        "--mode",
        type=str,
        default=DEFAULT_QUERY_MODE,
        help="CLI search mode (default: mf, i.e. mandarin_fulltext).",
    )
    parser.add_argument(
        "--no-fallback",
        action="store_true",
        help="Disable CLI fallback auto-switch.",
    )

    # Parallel execution (mandatory jieba segmentation mode)
    parser.add_argument(
        "--max-workers",
        type=int,
        default=8,
        help="ThreadPoolExecutor max workers for jieba mode (default: 8).",
    )
    parser.add_argument(
        "--max-results-per-word",
        type=int,
        default=DEFAULT_MAX_RESULTS_PER_WORD,
        help=(
            "Maximum number of dictionary entries kept per segmented word "
            f"(default: {DEFAULT_MAX_RESULTS_PER_WORD})."
        ),
    )
    # Output options
    parser.add_argument(
        "-p",
        "--prompt",
        type=str,
        default=DEFAULT_LLM_PROMPT,
        help="Custom LLM instruction prompt to append.",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=pathlib.Path,
        help="Output file path. If not specified, outputs to stdout.",
    )
    parser.add_argument(
        "--no-use-opencc-zh_TW-version-of-original-input-in-markdown-ouptut",
        action="store_true",
        help="Do not convert the markdown 'Original Input' section to zh_TW via OpenCC.",
    )

    args = parser.parse_args()

    # Read input
    input_text = read_input(args)
    if not input_text:
        logger.error("Input text is empty. Exiting.")
        sys.exit(1)

    # Run mandatory jieba path
    logger.info("Running mandatory jieba segmentation mode...")
    sections = run_jieba_path(
        input_text,
        args.mode,
        args.db,
        args.no_fallback,
        args.max_workers,
        args.max_results_per_word,
    )

    # Assemble final document
    markdown_input_text = (
        input_text
        if args.no_use_opencc_zh_TW_version_of_original_input_in_markdown_ouptut
        else TO_ZH_TW_CONVERTER.convert(input_text)
    )
    final_markdown = assemble_document(markdown_input_text, sections, args.prompt)

    # Output
    if args.out:
        logger.info(f"Writing output to file: {args.out}")
        try:
            args.out.write_text(final_markdown, encoding="utf-8")
            logger.info(f"Successfully wrote the final Markdown document to {args.out}")
        except Exception as e:
            logger.error(f"Error writing to output file {args.out}: {e}")
            sys.exit(1)
    else:
        print(final_markdown)
        logger.info("Successfully generated and outputted the final Markdown document.")


if __name__ == "__main__":
    main()

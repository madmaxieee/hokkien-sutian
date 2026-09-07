#!/usr/bin/env python3
# https://aistudio.google.com/app/prompts/1OiKffqtbQ3MYrfcNUC4bwQYXH810DfiA

import sqlite3
import re
import os
import argparse
from xml.sax.saxutils import escape


def strip_annotations(text):
    if not text:
        return ""
    return re.sub(r"【.*?】", "", text).strip()


def setup_directories(output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)


def generate(db_path, output_dir, dict_kit_dir):
    setup_directories(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print(f"Loading database from {db_path}...")

    # Load Examples
    examples_by_meaning = {}
    for row in cursor.execute("SELECT * FROM examples ORDER BY sequence"):
        m_id = row["meaning_id"]
        if m_id not in examples_by_meaning:
            examples_by_meaning[m_id] = []
        examples_by_meaning[m_id].append(row)

    # Load Meanings
    meanings_by_entry = {}
    for row in cursor.execute("SELECT * FROM meanings"):
        e_id = row["entry_id"]
        if e_id not in meanings_by_entry:
            meanings_by_entry[e_id] = []
        meanings_by_entry[e_id].append(row)

    # Load alternative pronunciations and variants
    alts_by_entry = {}
    for row in cursor.execute("SELECT * FROM alternative_pronunciations"):
        e_id = row["entry_id"]
        if e_id not in alts_by_entry:
            alts_by_entry[e_id] = []
        alts_by_entry[e_id].append(row)

    print("Generating Dictionary.xml...")

    xml_path = os.path.join(output_dir, "Dictionary.xml")
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write(
            '<d:dictionary xmlns="http://www.w3.org/1999/xhtml" xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng">\n'
        )

        cursor.execute("SELECT * FROM entries")
        for entry in cursor.fetchall():
            e_id = entry["id"]
            hanzi = entry["hanzi"] or ""
            romanization = entry["romanization"] or ""
            category = entry["category"] or ""

            clean_hanzi = strip_annotations(hanzi)

            # Start entry
            f.write(f'  <d:entry id="entry_{e_id}" d:title="{escape(clean_hanzi)}">\n')

            # Search Indexes
            indexes = set([hanzi, clean_hanzi, romanization])

            # Add alt pronunciations to indexes
            if e_id in alts_by_entry:
                for alt in alts_by_entry[e_id]:
                    indexes.add(alt["hanzi"])
                    indexes.add(strip_annotations(alt["hanzi"]))
                    indexes.add(alt["romanization"])

            for idx in filter(None, indexes):
                f.write(f'    <d:index d:value="{escape(idx)}"/>\n')

            # Display HTML
            f.write(f"    <h1>{escape(hanzi)}</h1>\n")
            if romanization:
                f.write(
                    f'    <span class="romanization">台羅: <span d:pr="1">{escape(romanization)}</span></span>\n'
                )
            if category:
                f.write(f'    <div class="category">分類: {escape(category)}</div>\n')

            # Meanings
            if e_id in meanings_by_entry:
                f.write("    <ol>\n")
                for meaning in meanings_by_entry[e_id]:
                    pos = (
                        f'<span class="pos">{escape(meaning["part_of_speech"])}</span> '
                        if meaning["part_of_speech"]
                        else ""
                    )
                    explanation = escape(meaning["explanation"] or "")
                    f.write(f"      <li>\n        {pos}{explanation}\n")

                    # Examples
                    m_id = meaning["id"]
                    if m_id in examples_by_meaning:
                        f.write('        <ul class="examples">\n')
                        for ex in examples_by_meaning[m_id]:
                            ex_hz = escape(ex["hanzi"] or "")
                            ex_rm = escape(ex["romanization"] or "")
                            ex_md = escape(ex["mandarin_translation"] or "")
                            f.write(
                                f"          <li><strong>{ex_hz}</strong> <em>{ex_rm}</em><br/>{ex_md}</li>\n"
                            )
                        f.write("        </ul>\n")
                    f.write("      </li>\n")
                f.write("    </ol>\n")

            f.write("  </d:entry>\n")

        f.write("</d:dictionary>\n")

    print("Generating MyInfo.plist...")
    plist_path = os.path.join(output_dir, "MyInfo.plist")
    with open(plist_path, "w", encoding="utf-8") as f:
        f.write("""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>zh-Hant</string>
	<key>CFBundleIdentifier</key>
	<string>me.teddysc.dictionary.hokkien</string>
	<key>CFBundleName</key>
	<string>HokkienDict</string>
	<key>CFBundleDisplayName</key>
	<string>閩南語辭典</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>DCSDictionaryCopyright</key>
	<string>Data © 教育部《臺灣閩南語常用詞辭典》</string>
	<key>DCSDictionaryManufacturerName</key>
	<string>Hokkien Sutian</string>
</dict>
</plist>""")

    print("Generating Dictionary.css...")
    css_path = os.path.join(output_dir, "Dictionary.css")
    with open(css_path, "w", encoding="utf-8") as f:
        f.write("""
@charset "UTF-8";
body { font-family: -apple-system, "PingFang TC", sans-serif; }
h1 { font-size: 1.5em; color: #1a1a1a; margin-bottom: 0.2em; }
.romanization { color: #0056b3; font-family: monospace; font-size: 1.1em; display: block; margin-bottom: 0.5em;}
.category { font-size: 0.9em; color: #666; margin-bottom: 0.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.5em; }
.pos { color: #fff; background-color: #555; padding: 1px 4px; border-radius: 4px; font-size: 0.8em; margin-right: 4px; }
ol { padding-left: 1.5em; margin-top: 0.5em; }
li { margin-bottom: 0.5em; }
.examples { margin-top: 0.3em; padding-left: 1.2em; color: #444; list-style-type: circle; }
.examples li { margin-bottom: 0.3em; font-size: 0.95em; }
.examples strong { color: #222; }
.examples em { color: #0056b3; font-style: normal; font-family: monospace; }
""")

    print("Generating Makefile...")
    makefile_path = os.path.join(output_dir, "Makefile")
    with open(makefile_path, "w", encoding="utf-8") as f:
        f.write(f"""
# Apple Dictionary Development Kit Makefile
DICT_NAME		= "閩南語辭典"
DICT_SRC_PATH	= Dictionary.xml
CSS_PATH		= Dictionary.css
PLIST_PATH		= MyInfo.plist

# Customizable path generated from Python script
DICT_BUILD_TOOL_DIR	= "{dict_kit_dir}"

build:
	"$(DICT_BUILD_TOOL_DIR)/bin/build_dict.sh" $(DICT_NAME) $(DICT_SRC_PATH) $(CSS_PATH) $(PLIST_PATH)
	echo "Done."

install:
	echo "Installing into ~/Library/Dictionaries"
	mkdir -p ~/Library/Dictionaries
	cp -r objects/$(DICT_NAME).dictionary ~/Library/Dictionaries/
	touch ~/Library/Dictionaries
	echo "Done."

clean:
	$(RM) -rf objects
""")

    print(f"All files generated successfully in the '{output_dir}' directory.")


def main():
    parser = argparse.ArgumentParser(
        description="Generate Apple Dictionary bundle files from Hokkien Sutian SQLite database."
    )

    parser.add_argument(
        "--db",
        default="public/assets/data/kautian.db",
        help="Path to the SQLite database (default: public/assets/data/kautian.db)",
    )
    parser.add_argument(
        "--out",
        default="apple_dict_build",
        help="Output directory for the generated files (default: apple_dict_build)",
    )
    parser.add_argument(
        "--dict-kit",
        default="/Developer/Extras/Dictionary Development Kit",
        help='Path to the Apple Dictionary Development Kit (default: "/Developer/Extras/Dictionary Development Kit")',
    )

    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Error: Database not found at '{args.db}'")
        return

    generate(args.db, args.out, args.dict_kit)


if __name__ == "__main__":
    main()

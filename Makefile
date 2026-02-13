ARTIFACT_COMPONENT_FILE = ./src/artifact-component.tsx
BUILT_FILE = dist/index.html
BUILT_DIR = dist
SERVE_BIN_BUN = $(HOME)/.bun/bin/serve
CF_PAGES_PROJECT_NAME := hokkien-sutian


cf-build:
	# faster than cf's default, npm
	bun install
	bun run build

list-deployments:
# 	wrangler pages deployment list --project-name $(CF_PAGES_PROJECT_NAME) | head -n 30
# 	wrangler pages deployment list --project-name $(CF_PAGES_PROJECT_NAME) --json | rich_tables.py --head 20
	wrangler pages deployment list --project-name $(CF_PAGES_PROJECT_NAME) --json | rich_tables.py --head 18

open-dashboard:
	open https://dash.cloudflare.com/?to=/:account/pages/view/$(CF_PAGES_PROJECT_NAME)


open-pages-dev:
	open https://sutian.teddysc.me




build-single-file:
	bun install
	bunx -b vite build
	echo 'Built file: $(BUILT_FILE)'

publish-to-gist:
	'gh' 'gist' 'create' $(BUILT_FILE) | sed 's/gist.github.com/g.teddysc.me/' | sed 's:/tddschn::' | tee /dev/tty | tr -d '\n' | pbcopy

dev:
	bun run dev



format:
	prettier --write src/*.tsx


# stats:
# 	@echo 'token count for $(ARTIFACT_COMPONENT_FILE):'
# 	ttok < $(ARTIFACT_COMPONENT_FILE)
# 	@echo 'wc:	'
# 	wc -l $(ARTIFACT_COMPONENT_FILE)
tokei:
# 	tokei -e data
	tokei
	fd -e ts -e tsx -X cat | PYTHONWARNINGS="ignore" ttok

# --------------------
# gitingest
# --------------------
gitingest:
# 	gitingest . -o hokkien-sutian.txt && rpp_ hokkien-sutian.txt
	gitingest . -o hokkien-sutian.txt && copy_paths_as_files_objc.py hokkien-sutian.txt
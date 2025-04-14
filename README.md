# phind-cli

**`phind` (PHilosophical find): A modern, intuitive, cross-platform command-line tool for finding files and directories recursively, designed with developers in mind.**

---

**Why `phind` and not `find`? Because `phind` offers a consistent, intuitive, cross-platform experience with sensible defaults specifically tailored for developers, unlike the fragmented and often complex native `find` commands.**

---

## The Problem: Why Another `find` Tool?

The standard `find` command, while powerful, presents several challenges, especially for developers working across different environments:

1.  **Cross-Platform Inconsistency:**
    *   The syntax and available options for `find` can differ significantly between operating systems (e.g., GNU `find` on Linux vs. BSD `find` on macOS). This forces users to remember different flags or consult documentation frequently.
    *   **Windows lacks a direct, built-in equivalent.** Developers on Windows often resort to using `dir /s /b`, installing Git Bash (which includes GNU find), using WSL, or employing PowerShell commands, none of which provide the same seamless experience or syntax as Unix-like `find`.

2.  **Verbose and Often Unintuitive Syntax:**
    *   Standard `find` syntax can be complex, requiring explicit actions like `-print` and involving less intuitive operators for combining conditions (e.g., `-o` for OR, escaped parentheses for grouping).
    *   Excluding directories effectively (pruning) often involves cumbersome patterns like `-path './node_modules' -prune -o -print`.

3.  **Lack of Sensible Defaults for Developers:**
    *   **This is a major pain point.** When searching in a typical software project, you almost *never* want to see results from `node_modules`, `.git`, `.gradle`, `build` directories, etc. Standard `find` requires you to *explicitly* exclude these *every single time*. This adds significant boilerplate to common search commands.
4.  **No User-Level Configuration:**
    *   Beyond project-specific ignores (like `.gitignore`, which `find` doesn't natively understand anyway), there's no standard way to tell `find` to *always* ignore certain patterns across *all* projects. Think about system files (`.DS_Store`, `Thumbs.db`), editor configuration (`.vscode/`, `.idea/`), temporary files (`*.bak`, `*.swp`), or compiled artifacts (`*.pyc`, `*.o`). With standard `find`, you must *manually add exclusion flags for these user-specific or system-specific nuisances every single time you run a command*, or resort to complex shell aliases or wrapper scripts.

## The Solution: `phind`

`phind` aims to solve these problems by providing:

*   **True Cross-Platform Compatibility:** Runs consistently on Linux, macOS, and Windows with the same command and options.
*   **Sensible Developer Defaults:** **Crucially, `phind` automatically excludes common directories like `node_modules`, `.git`, and `.gradle` by default.** This drastically simplifies finding relevant project files without manual exclusion flags in most cases.
*   **Intuitive Glob Patterns:** Uses familiar glob patterns (like those in `.gitignore`) for both including (`--name`) and excluding (`--exclude`) files and directories, powered by `micromatch`.
*   **Simplified Options:** Offers clear, easy-to-understand flags for common tasks like filtering by type (`-t f`/`-t d`), limiting depth (`-d`), case-insensitive search (`-i`), and relative path output (`-r`).
*   **Global Ignore File:** Supports a global ignore file (`~/.config/phind/ignore` or platform equivalent) for persistent, user-defined excludes across all projects.
*   **Performance:** Leverages modern Node.js features like async I/O and `fs.Dirent` for efficient traversal.

In essence, `phind` is designed to be the `find` command you *wish* you had – consistent, simple for common tasks, and intelligently configured for software development workflows out of the box.

## Key Features

*   ✅ **Cross-Platform:** Works identically on Windows, macOS, and Linux.
*   🧠 **Smart Defaults:** Automatically ignores `node_modules`, `.git`, and `.gradle`.
*   ✨ **Intuitive Syntax:** Uses simple flags and familiar glob patterns.
*   🔍 **Flexible Filtering:** Filter by name/path (`--name`), type (`--type`), and depth (`--maxdepth`).
*   🚫 **Powerful Exclusions:** Exclude patterns via CLI (`--exclude`) or a global ignore file.
*   ⚙️ **Configurable:** Skip global ignores (`--skip-global-ignore`), control case sensitivity (`--ignore-case`).
*   📄 **Output Control:** Print relative (default) or absolute paths (`--relative=false`).
*   🚀 **Modern & Performant:** Built with TypeScript and modern Node.js APIs. (Defaults to relative paths!)

## Installation

```bash
npm install -g phind-cli
```

Alternatively, you can use it directly without installation via `npx`:

```bash
npx phind-cli [path] [options]
```

## Usage

The basic command structure is:

```bash
phind [path] [options]
```

*   `[path]`: (Optional) The directory to start searching from. Defaults to the current directory (`.`).
*   `[options]`: (Optional) Flags to control filtering, exclusion, output format, etc.

## Options

Here is a detailed breakdown of every available command-line option:

---

### `path` (Positional Argument)

*   **Description:** The directory to search within. This is the starting point for the recursive traversal.
*   **Type:** `string`
*   **Default:** `.` (the current working directory)
*   **Details:** If provided, it must be the first argument that isn't part of an option flag. `phind . --name "*.js"` and `phind --name "*.js"` are effectively the same if run from the same directory. It must be a valid directory.

---

### `--name` / `-n`

*   **Description:** Glob pattern(s) for filenames or paths to include. You can specify this option multiple times.
*   **Type:** `string` (array)
*   **Default:** `['*']` (matches all files and directories unless excluded)
*   **Default Description:** `"*"` (all files/dirs)
*   **Details:** Uses `micromatch` for globbing. Patterns are matched against the item's base name (e.g., `file.txt`), its full absolute path, and its relative path (if `--relative` is used). Hidden files/directories (starting with `.`) are matched by default because `micromatch`'s `dot: true` option is enabled internally.
    *   Example: `--name "*.ts"` finds all files ending in `.ts`.
    *   Example: `--name "src/**/*.ts"` finds TypeScript files within the `src` directory and its subdirectories.
    *   Example: `--name package.json --name "*.lock"` finds `package.json` files and all lock files.

---

### `--exclude` / `-e`

*   **Description:** Glob pattern(s) to exclude files or directories. Also reads patterns from the global ignore file unless `--skip-global-ignore` is used. You can specify this option multiple times.
*   **Type:** `string` (array)
*   **Default:** `[]` (CLI arguments default to none, but hardcoded defaults and global ignores are applied)
*   **Default Description:** `"`node_modules`", "`".git`", "`".gradle`"` (These are the hardcoded defaults that are always added unless overridden by specific includes).
*   **Details:** Patterns are matched similarly to `--name` (base name, absolute path, relative path). If a directory matches an exclude pattern, it is *pruned* – `phind` will not descend into it. This is highly efficient for skipping large directories like `node_modules`. Exclude patterns take priority over include patterns. The final list of excludes combines hardcoded defaults (`node_modules`, `.git`), patterns from the global ignore file, and patterns provided via the CLI `--exclude` flag.

---

### `--skip-global-ignore`

*   **Description:** Do not load patterns from the global ignore file.
*   **Type:** `boolean`
*   **Default:** `false`
*   **Details:** Use this flag if you want to temporarily ignore your global configuration (see [Global Ignore File](#global-ignore-file) section below) and rely only on the hardcoded defaults (`node_modules`, `.git`, `.gradle`) and any patterns provided via `--exclude`.

---

### `--type` / `-t`

*   **Description:** Match only items of a specific type.
*   **Type:** `string`
*   **Choices:** `f` (file), `d` (directory)
*   **Default:** `null` (matches both files and directories)
*   **Details:**
    *   `-t f`: Only outputs files.
    *   `-t d`: Only outputs directories.

---

### `--maxdepth` / `-d`

*   **Description:** Maximum directory levels to descend. `0` means only the starting path itself.
*   **Type:** `number`
*   **Default:** `Infinity` (represented internally as `Number.MAX_SAFE_INTEGER`)
*   **Details:** Controls the recursion depth.
    *   `--maxdepth 0`: Only considers the `[path]` argument itself.
    *   `--maxdepth 1`: Considers the `[path]` argument and items directly within it.
    *   `--maxdepth 2`: Considers items up to two levels deep from the `[path]`.

---

### `--ignore-case` / `-i`

*   **Description:** Perform case-insensitive matching for `--name` and `--exclude` patterns.
*   **Type:** `boolean`
*   **Default:** `false`
*   **Details:** Affects how glob patterns are matched against file and directory names/paths. For example, with `-i`, `--name "*.jpg"` would match `image.jpg`, `image.JPG`, and `image.JpG`.

---

### `--relative` / `-r`

*   **Description:** Print paths relative to the starting directory (default). Use `--relative=false` for absolute paths.
*   **Type:** `boolean`
*   **Default:** `true`
*   **Default Description:** true (relative paths)
*   **Details:**
    *   **Default (`true`):** Prints paths relative to the `[path]` argument (e.g., `./src/file.ts`). The starting directory itself is represented as `.`. Paths are prefixed with `./` unless they start with `../`.
    *   `--relative=false`: Use this explicitly to print absolute paths (e.g., `/home/user/project/src/file.ts`).

---

### `--help` / `-h`

*   **Description:** Show the help message listing all options and exit.
*   **Type:** `boolean`
*   **Details:** Displays usage information, descriptions of all options, and their defaults.

---

## Global Ignore File

`phind` supports a global ignore file to specify patterns that should *always* be excluded, regardless of the project you're currently in. This is useful for editor configuration files, OS-specific files, temporary files, etc.

**Location:**

The location of the global ignore file follows platform conventions:

1.  **Environment Variable:** If `PHIND_TEST_GLOBAL_IGNORE_PATH` is set (primarily for testing), that path is used.
2.  **Windows:** `%APPDATA%\phind\ignore` (e.g., `C:\Users\YourUser\AppData\Roaming\phind\ignore`)
3.  **Linux/macOS (XDG):** `$XDG_CONFIG_HOME/phind/ignore` (if `$XDG_CONFIG_HOME` is set)
4.  **Linux/macOS (Fallback):** `~/.config/phind/ignore` (e.g., `/home/youruser/.config/phind/ignore`)

**Format:**

*   Plain text file.
*   One glob pattern per line.
*   Lines starting with `#` are treated as comments and ignored.
*   Blank lines are ignored.
*   Leading/trailing whitespace on a line is trimmed *after* removing comments.

**Example `ignore` file:**

```gitignore
# OS-specific files
.DS_Store
Thumbs.db

# Editor/IDE config
.vscode/
.idea/
*.sublime-project
*.sublime-workspace

# Temporary files
*.tmp
*.bak
*.swp

# Build output common across projects
dist/
build/
out/
```

**Disabling:**

Use the `--skip-global-ignore` flag to prevent loading this file for a specific command execution.

## Examples

Let's assume the following directory structure for the examples:

```
my_project/
├── src/
│   ├── main.ts
│   ├── utils/
│   │   └── helper.ts
│   └── components/
│       └── Button.tsx
├── dist/               # Typically excluded by global ignore
│   └── bundle.js
├── node_modules/       # Excluded by default
│   └── some_lib/
│       └── index.js
├── test/
│   ├── main.test.ts
│   └── utils.test.js
├── public/
│   ├── index.html
│   └── styles.css
├── .git/               # Excluded by default
│   └── config
├── package.json
├── README.md
├── .env
└── config.yaml
```

---

### 1. Basic Finding

**a. Find all items in the current directory (defaults applied)**

```bash
cd my_project
phind
```

*Output (Relative Paths - Default, node_modules & .git excluded):*

```
.
./.env
./README.md
./config.yaml
./dist
./dist/bundle.js
./package.json
./public
./public/index.html
./public/styles.css
./src
./src/components
./src/components/Button.tsx
./src/main.ts
./src/utils
./src/utils/helper.ts
./test
./test/main.test.ts
./test/utils.test.js
```

**b. Find all items using absolute paths**
```bash
cd my_project
phind --relative=false
```
*Output (Absolute Paths):*
```
/path/to/my_project
/path/to/my_project/.env
/path/to/my_project/README.md
/path/to/my_project/config.yaml
/path/to/my_project/dist
/path/to/my_project/dist/bundle.js
/path/to/my_project/package.json
/path/to/my_project/public
/path/to/my_project/public/index.html
/path/to/my_project/public/styles.css
/path/to/my_project/src
/path/to/my_project/src/components
/path/to/my_project/src/components/Button.tsx
/path/to/my_project/src/main.ts
/path/to/my_project/src/utils
/path/to/my_project/src/utils/helper.ts
/path/to/my_project/test
/path/to/my_project/test/main.test.ts
/path/to/my_project/test/utils.test.js
```

**c. Find all items starting in a specific subdirectory (`src`)**

```bash
cd my_project
phind src
```

*Output (Relative Paths - Default):*

```
./src
./src/components
./src/components/Button.tsx
./src/main.ts
./src/utils
./src/utils/helper.ts
```

**d. Find items in `src` using absolute paths**
```bash
cd my_project
phind src --relative=false
```
*Output (Absolute Paths):*
```
/path/to/my_project/src
/path/to/my_project/src/components
/path/to/my_project/src/components/Button.tsx
/path/to/my_project/src/main.ts
/path/to/my_project/src/utils
/path/to/my_project/src/utils/helper.ts
```

---

### 2. Filtering by Name (`--name` / `-n`)

**a. Find all TypeScript files (`*.ts`)**

```bash
cd my_project
phind --name "*.ts" # Relative is default
```

*Output:*

```
./src/main.ts
./src/utils/helper.ts
./test/main.test.ts
```

**b. Find all TypeScript and TSX files**

```bash
cd my_project
phind --name "*.ts" --name "*.tsx" # Relative is default
```

*Output:*

```
./src/components/Button.tsx
./src/main.ts
./src/utils/helper.ts
./test/main.test.ts
```

**c. Find specific configuration files**

```bash
cd my_project
phind --name package.json --name config.yaml # Relative is default
```

*Output:*

```
./config.yaml
./package.json
```

**d. Find all items within the `src/utils` directory**
```bash
cd my_project
phind --name "src/utils/**" # Relative is default
```
*Output:*
```
./src/utils/helper.ts
```
*(Note: `src/utils/**` matches items *inside* `utils`, not the directory itself)*

**e. Find the `src/utils` directory itself and its contents**
```bash
cd my_project
phind --name "src/utils" --name "src/utils/**" # Relative is default
```
*Output:*
```
./src/utils
./src/utils/helper.ts
```

---

### 3. Filtering by Type (`--type` / `-t`)

**a. Find only files**

```bash
cd my_project
phind -t f # Relative is default
```

*Output (Relative paths, All files, excluding default ignores):*
```
./.env
./README.md
./config.yaml
./dist/bundle.js
./package.json
./public/index.html
./public/styles.css
./src/components/Button.tsx
./src/main.ts
./src/utils/helper.ts
./test/main.test.ts
./test/utils.test.js
```

**b. Find only directories**
```bash
cd my_project
phind -t d # Relative is default
```
*Output (Relative paths, All directories, excluding default ignores):*
```
.
./dist
./public
./src
./src/components
./src/utils
./test
```

**c. Find only JavaScript files (`*.js`)**
```bash
cd my_project
phind -t f --name "*.js" # Relative is default
```
*Output:*
```
./dist/bundle.js
./test/utils.test.js
```

---

### 4. Filtering by Depth (`--maxdepth` / `-d`)

**a. Find only items in the immediate directory (depth 0)**
```bash
cd my_project
phind --maxdepth 0 # Relative is default
```
*Output:*
```
.
```

**b. Find items at depth 0 and 1**
```bash
cd my_project
phind --maxdepth 1 # Relative is default
```
*Output (Top-level files/dirs, excluding default ignores):*
```
.
./.env
./README.md
./config.yaml
./dist
./package.json
./public
./src
./test
```

**c. Find only directories at depth 0 and 1**
```bash
cd my_project
phind -t d --maxdepth 1 # Relative is default
```
*Output:*
```
.
./dist
./public
./src
./test
```

---

### 5. Excluding Patterns (`--exclude` / `-e`)

**a. Exclude all test files (`*.test.*`)**
```bash
cd my_project
phind --exclude "*.test.*" # Relative is default
```
*(Output will include everything except `./test/main.test.ts` and `./test/utils.test.js`)*

**b. Exclude the `public` directory (pruning)**
```bash
cd my_project
phind --exclude public # Relative is default
```
*(Output will include everything except `./public` directory and its contents: `./public/index.html`, `./public/styles.css`)*

**c. Exclude CSS files and the `dist` directory**
```bash
cd my_project
phind --exclude "*.css" --exclude dist # Relative is default
```
*(Output will not include `./public/styles.css`, the `./dist` directory, or `./dist/bundle.js`)*

**d. Find all JS files, but exclude those in the `test` directory**
```bash
cd my_project
phind --name "*.js" --exclude "test/**" -t f # Relative is default
```
*Output:*
```
./dist/bundle.js
```
*(Note: `./test/utils.test.js` is excluded because it's inside the `test` directory)*

---

### 6. Case Insensitivity (`--ignore-case` / `-i`)

**a. Find `readme.md` case-insensitively**
```bash
cd my_project
# Assuming file is README.md
phind --name readme.md -i # Relative is default
```
*Output:*
```
./README.md
```

**b. Find all TS/TSX files, excluding `button.tsx` case-insensitively**
```bash
cd my_project
phind --name "*.[tT][sS]x?" -i --exclude "button.tsx" # Relative is default
```
*Output:*
```
./src/main.ts
./src/utils/helper.ts
./test/main.test.ts
```
*(Note: `./src/components/Button.tsx` is excluded)*

---

### 7. Global Ignore File Interaction

**a. Run normally (assuming global file excludes `dist/` and `.env`)**
```bash
cd my_project
# Assumes global ignore contains 'dist/' and '.env'
phind # Relative is default
```
*(Output will exclude `node_modules`, `.git` (default), AND `dist/`, `.env` (global), paths will be relative)*

**b. Skip the global ignore file**
```bash
cd my_project
# Assumes global ignore contains 'dist/' and '.env'
phind --skip-global-ignore # Relative is default
```
*(Output will exclude `node_modules`, `.git` (default) but will **include** `./dist/` and `./.env` because the global file was skipped, paths will be relative)*

**c. Combine global, default, and CLI excludes**
```bash
cd my_project
# Assumes global ignore contains 'dist/' and '.env'
phind --exclude "*.yaml" --skip-global-ignore=false # Relative is default
```
*(Output excludes `node_modules`, `.git` (default), `dist/`, `.env` (global), AND `./config.yaml` (CLI), paths will be relative)*

---

### 8. Overriding Default Excludes

**a. Find items *inside* `node_modules`**
*By default, `node_modules` is pruned. To find something inside, you need an explicit `--name` pattern that targets the content.*
```bash
cd my_project
# Find the specific library index file
phind --name "node_modules/some_lib/index.js" # Relative is default
```
*Output:*
```
./node_modules/some_lib/index.js
```
*(The default exclusion of `node_modules` directory printing/pruning is overridden because a specific include pattern targets content inside it)*

**b. List the `node_modules` directory itself and its contents**
```bash
cd my_project
phind --name node_modules --name "node_modules/**" # Relative is default
```
*Output:*
```
./node_modules
./node_modules/some_lib
./node_modules/some_lib/index.js
```
*(Here, `--name node_modules` explicitly includes the directory, overriding the default exclusion for listing it, and `--name "node_modules/**"` includes the contents)*

---

## Why `phind`? (Comparison Summary)

| Feature             | `phind` (`phind-cli`)                            | Standard `find` (Unix-like)                    | Standard `dir` (Windows)        |
| :------------------ | :----------------------------------------------- | :--------------------------------------------- | :------------------------------ |
| **Platform**        | ✅ Windows, macOS, Linux                         | ✅ Linux, macOS (Syntax varies)                | ✅ Windows Only                 |
| **Consistency**     | ✅ Identical behavior everywhere                 | ❌ Syntax/options differ (GNU vs BSD)          | N/A                             |
| **Default Excludes**| ✅ `node_modules`, `.git`                        | ❌ None (Requires manual `-prune` / `-path`) | ❌ None                         |
| **Exclusion Syntax**| ✅ Simple globs (`--exclude`) + Global Ignore | ⚠️ Complex (`-path ... -prune -o ...`)          | ⚠️ Limited (`/A:-D`)           |
| **Inclusion Syntax**| ✅ Simple globs (`--name`)                       | ✅ Powerful but complex patterns (`-name`, `-regex`) | ✅ Simple wildcards (`*`, `?`) |
| **Type Filter**     | ✅ Simple (`-t f`, `-t d`)                       | ✅ `-type f`, `-type d`                          | ⚠️ Requires attribute check (`/A:D`, `/A:-D`) |
| **Depth Limit**     | ✅ Simple (`-d N`)                               | ✅ `-maxdepth N`                               | ❌ No direct equivalent         |
| **Case Ignore**     | ✅ Simple (`-i`)                                 | ✅ `-iname`, `-iregex`                         | ✅ `/S` searches, but no case flag |
| **Path Style**      | ✅ Relative Default (`./file`), `--relative=false` for absolute | ⚠️ Relative Default (`./file`), complex absolute | ✅ Relative Default (`file`) |
| **Ease of Use**     | ⭐⭐⭐⭐⭐ (High, Developer-focused)             | ⭐⭐ (Medium-High, Steeper curve)              | ⭐⭐⭐ (Medium, Simpler but limited) |

## Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/nodesman/phind-cli.git
    cd phind-cli
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build:** Compile TypeScript to JavaScript:
    ```bash
    npm run build
    ```
    (Outputs to the `bin` directory)
4.  **Watch:** Compile TypeScript in watch mode:
    ```bash
    npm run watch
    ```
5.  **Run Tests:** Execute Jest tests:
    ```bash
    npm test
    ```
    Run tests in watch mode:
    ```bash
    npm run test:watch
    ```
    Generate coverage report:
    ```bash
    npm run test:coverage
    ```
6.  **Run Development Version:** Execute the CLI directly using `ts-node`:
    ```bash
    npm run dev -- [path] [options]
    # Example: npm run dev -- src -t f --name "*.ts"
    ```
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryTraverser = void 0;
// src/traverser.ts
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const micromatch_1 = __importDefault(require("micromatch"));
class DirectoryTraverser {
    constructor(options, basePath) {
        this.options = options;
        // Ensure basePath is absolute and normalized for consistent comparisons
        this.basePath = path_1.default.resolve(basePath);
        this.baseMicromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true // Crucial: Always enable dot matching for hidden files/dirs like .git
        };
        this.defaultExcludesSet = new Set(options.defaultExcludes);
        // Pre-calculate include patterns that are not the default '*' for override logic
        this.nonDefaultIncludePatterns = options.includePatterns.filter(p => p !== '*');
    }
    /**
     * Checks if an item matches any pattern in a list.
     * Tests against the item's name, its normalized absolute path, and
     * (if relativePaths option is true) its normalized relative path.
     */
    matchesAnyPattern(name, fullPath, relativePath, // Calculated relative path (e.g., '.', 'dir/file.txt')
    patterns) {
        if (!patterns || patterns.length === 0) {
            return false;
        }
        // Normalize paths for consistent matching, always using forward slashes
        const absPathNormalized = path_1.default.normalize(fullPath).replace(/\\/g, '/');
        const relPathNormalized = relativePath === '.' ? '.' : path_1.default.normalize(relativePath).replace(/\\/g, '/');
        const pathsToTest = [
            name, // Base name (e.g., 'file.txt', 'node_modules')
            absPathNormalized // Absolute path (e.g., '/User/project/src/file.txt')
        ];
        // Only add relative path to the test set if the option is enabled AND
        // the relative path is not empty (it will be '' for the base dir if relativePaths=false)
        // and not identical to the absolute path or name already included.
        if (this.options.relativePaths && relPathNormalized) {
            if (!pathsToTest.includes(relPathNormalized)) {
                pathsToTest.push(relPathNormalized); // Relative path (e.g., '.', 'src/file.txt')
            }
        }
        // Use micromatch.some for efficiency
        return micromatch_1.default.some(pathsToTest, patterns, this.baseMicromatchOptions);
    }
    /**
     * Calculates the relative path string based on options.
     * Returns '.' for the base path itself if relativePaths is true.
     * Returns an empty string if relativePaths is false (or for non-relative matching).
     */
    calculateRelativePath(fullPath) {
        if (!this.options.relativePaths) {
            return ''; // No relative path needed for matching/display if option is off
        }
        // Use normalize to handle potential trailing slashes, etc. before comparison
        if (path_1.default.normalize(fullPath) === path_1.default.normalize(this.basePath)) {
            return '.'; // Special case for the starting directory itself
        }
        // Calculate relative path, ensure forward slashes
        const relPath = path_1.default.relative(this.basePath, fullPath);
        // If relPath is somehow empty (e.g., path.relative('/a', '/a/')), use basename as fallback
        return (relPath || path_1.default.basename(fullPath)).replace(/\\/g, '/');
    }
    /**
     * Prepares a list of "explicit" include patterns used for overriding default excludes.
     * Handles patterns like 'dir/**' or 'dir/' matching the directory 'dir' itself.
     * Excludes broad patterns like '*' and '.*' which shouldn't override defaults.
     */
    getExplicitIncludePatternsForOverride() {
        // Filter out broad patterns that shouldn't override specific default excludes
        const specificNonDefaultIncludes = this.nonDefaultIncludePatterns.filter(p => p !== '*' && p !== '.*' && p !== '**');
        if (specificNonDefaultIncludes.length === 0) {
            return [];
        }
        const derivedPatterns = specificNonDefaultIncludes.map(p => {
            if (p.endsWith('/**'))
                return p.substring(0, p.length - 3);
            if (p.endsWith('/'))
                return p.substring(0, p.length - 1);
            // Also consider the pattern itself if it doesn't end with /** or /
            // E.g., 'node_modules' should match the directory 'node_modules'
            // This is already covered by including specificNonDefaultIncludes below
            return null;
        }).filter((p) => p !== null);
        // Combine specific original non-default patterns with derived patterns for directory name matching
        return [...new Set([...specificNonDefaultIncludes, ...derivedPatterns])];
    }
    /**
     * Checks if a directory should be pruned (i.e., not traversed into).
     * Prune if it matches an exclude pattern UNLESS an explicit include overrides it.
     * Override occurs if:
     * 1. The directory itself matches an explicit include pattern.
     * 2. A non-wildcard include pattern targets a potential descendant.
     */
    shouldPrune(name, fullPath, relativePath) {
        // 1. Check if excluded by any pattern
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return false; // Not excluded, definitely don't prune
        }
        // --- Item IS excluded. Check for overrides ---
        // Check 1: Does the directory ITSELF match an explicit pattern derived for directory matching?
        const explicitDirIncludes = this.getExplicitIncludePatternsForOverride();
        if (explicitDirIncludes.length > 0) {
            if (this.matchesAnyPattern(name, fullPath, relativePath, explicitDirIncludes)) {
                // console.log(`DEBUG: Not pruning "${name}" because it (directory) is explicitly included.`);
                return false; // Directory itself is explicitly included, DO NOT prune
            }
        }
        // Check 2: Does any NON-WILDCARD include pattern potentially target a descendant?
        // Avoid pruning if a specific file/path inside this directory is explicitly included.
        // Use the original nonDefaultIncludePatterns as they contain the specific targets.
        // Normalize the directory path ONCE for comparison. Ensure it ends with a slash.
        const normalizedDirPath = path_1.default.normalize(fullPath).replace(/\\/g, '/') + '/';
        const hasPotentialDescendantInclude = this.nonDefaultIncludePatterns.some(includePattern => {
            // Heuristic: Skip simple globs ('*.js') or base names ('file.txt') as they
            // don't reliably indicate a path prefix relationship for descendant checking.
            // We are interested in patterns that look like relative/absolute paths.
            // This check might need refinement based on supported include pattern styles.
            if (includePattern.includes('*') || !includePattern.includes(path_1.default.sep) && !includePattern.includes('/')) {
                return false;
            }
            // Resolve the include pattern relative to the basePath to get its absolute path
            // for a consistent comparison.
            let absoluteIncludePattern = path_1.default.normalize(path_1.default.resolve(this.basePath, includePattern)).replace(/\\/g, '/');
            // Check if the resolved absolute include pattern starts with the directory's absolute path.
            // It must be strictly *longer* than the directory path to be a descendant.
            return absoluteIncludePattern.startsWith(normalizedDirPath) && absoluteIncludePattern.length > normalizedDirPath.length;
        });
        if (hasPotentialDescendantInclude) {
            // console.log(`DEBUG: Not pruning "${name}" because an explicit include pattern targets a descendant.`);
            return false; // Potential descendant included, DO NOT prune
        }
        // --- If we reach here, it's excluded and not explicitly included (itself or potentially descendants). PRUNE. ---
        // console.log(`DEBUG: Pruning "${name}" as it's excluded and not explicitly included.`);
        return true;
    }
    /**
     * Checks if an item (file or directory) should be printed based on all filters.
     */
    shouldPrintItem(name, fullPath, relativePath, isDirectory, isFile) {
        // 1. Type Check: If a type filter is specified, the item must match.
        const { matchType } = this.options;
        if (matchType) {
            if (matchType === 'f' && !isFile)
                return false;
            if (matchType === 'd' && !isDirectory)
                return false;
        }
        // 2. Include Check: Item must match at least one include pattern.
        const isIncluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.includePatterns);
        if (!isIncluded) {
            return false; // Not included, definitely don't print
        }
        // 3. Exclude Check: Check against the combined exclude patterns.
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return true; // Included and not excluded - PRINT
        }
        // --- Item IS included AND excluded. Check for explicit include override ---
        const explicitIncludes = this.getExplicitIncludePatternsForOverride();
        if (explicitIncludes.length > 0) {
            const isExplicitlyIncluded = this.matchesAnyPattern(name, fullPath, relativePath, explicitIncludes);
            if (isExplicitlyIncluded) {
                // console.log(`DEBUG: Printing "${name}" because it is explicitly included (overriding exclusion).`);
                return true; // Explicitly included, override the exclusion - PRINT
            }
        }
        // --- If we reach here: Item matched an include, matched an exclude, but did NOT match an *explicit* include.
        // console.log(`DEBUG: Not printing "${name}" (included, but excluded, and not explicitly included to override).`);
        return false; // Excluded and not overridden - DO NOT PRINT
    }
    traverse(startPath_1) {
        return __awaiter(this, arguments, void 0, function* (startPath, currentDepth = 0) {
            const resolvedStartPath = path_1.default.resolve(startPath); // Ensure start path is absolute
            // --- 1. Handle Starting Item (File or Directory) at Depth 0 ---
            let canReadEntries = false; // Flag to control if we read directory entries
            if (currentDepth === 0) {
                try {
                    // --- FIX START: Stat the starting path ---
                    const stats = yield promises_1.default.stat(resolvedStartPath);
                    const isDirectory = stats.isDirectory();
                    const isFile = stats.isFile();
                    // --- FIX END ---
                    // Check if the starting item itself should be printed
                    const dirName = path_1.default.basename(resolvedStartPath);
                    const relativePathForStart = this.calculateRelativePath(resolvedStartPath);
                    // --- FIX: Use resolved path if not relative ---
                    const displayPath = this.options.relativePaths ? relativePathForStart : resolvedStartPath;
                    if (this.shouldPrintItem(dirName, resolvedStartPath, relativePathForStart, isDirectory, isFile)) {
                        console.log(displayPath);
                    }
                    // --- FIX: Only attempt to read entries if it's a directory ---
                    if (isDirectory) {
                        canReadEntries = true;
                    }
                    // --- FIX END ---
                }
                catch (err) {
                    // Handle errors like ENOENT or EACCES for the *starting* path specifically
                    console.error(`Error accessing start path ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                    return; // Cannot proceed if the starting path is inaccessible
                }
            }
            else {
                // If not depth 0, we assume we are already inside a valid directory
                canReadEntries = true;
            }
            // --- 2. Depth Check for Recursion ---
            if (currentDepth >= this.options.maxDepth) {
                return; // Stop recursing if max depth reached
            }
            // --- FIX: Check if we determined we can read entries ---
            if (!canReadEntries) {
                return; // Stop if the starting item wasn't a directory or was inaccessible
            }
            // --- FIX END ---
            // --- 3. Read Directory Entries ---
            let entries;
            try {
                entries = yield promises_1.default.readdir(resolvedStartPath, { withFileTypes: true });
            }
            catch (err) {
                // Report read errors for subdirectories but continue if possible
                if (err.code === 'EACCES' || err.code === 'EPERM') {
                    console.error(`Permission error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                }
                else {
                    console.error(`Error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                }
                return; // Stop processing this directory on error
            }
            // --- 4. Process Each Entry ---
            for (const dirent of entries) {
                const entryName = dirent.name;
                const entryFullPath = path_1.default.join(resolvedStartPath, entryName);
                const entryRelativePath = this.calculateRelativePath(entryFullPath);
                const displayPath = this.options.relativePaths ? entryRelativePath : entryFullPath;
                const isDirectory = dirent.isDirectory();
                const isFile = dirent.isFile();
                if (isDirectory && this.shouldPrune(entryName, entryFullPath, entryRelativePath)) {
                    // console.log(`DEBUG: Pruning directory: ${displayPath}`);
                    continue;
                }
                if (this.shouldPrintItem(entryName, entryFullPath, entryRelativePath, isDirectory, isFile)) {
                    console.log(displayPath);
                }
                if (isDirectory) {
                    // Depth check for next level happens at the *start* of the recursive call
                    yield this.traverse(entryFullPath, currentDepth + 1);
                }
            }
        });
    } // End traverse
} // End class
exports.DirectoryTraverser = DirectoryTraverser;
//# sourceMappingURL=traverser.js.map
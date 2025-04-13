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
        // --- FIX: Filter out broad patterns ---
        const specificNonDefaultIncludes = this.nonDefaultIncludePatterns.filter(p => p !== '*' && p !== '.*' && p !== '**');
        if (specificNonDefaultIncludes.length === 0) {
            return [];
        }
        // --- FIX END ---
        const derivedPatterns = specificNonDefaultIncludes.map(p => {
            // ... (rest of derived pattern logic remains the same)
            if (p.endsWith('/**'))
                return p.substring(0, p.length - 3);
            if (p.endsWith('/'))
                return p.substring(0, p.length - 1);
            return null;
        }).filter((p) => p !== null); // Filter out nulls and ensure type string
        // Combine specific original non-default patterns with derived patterns
        return [...new Set([...specificNonDefaultIncludes, ...derivedPatterns])];
    }
    /**
     * Checks if a directory should be pruned (i.e., not traversed into).
     * Prune if it matches an exclude pattern UNLESS it specifically matches
     * an explicit (non-'*', non-'.*') include pattern OR an explicit include
     * pattern looks like it targets descendants.
     */
    shouldPrune(name, fullPath, relativePath) {
        // 1. Check if excluded by any pattern (default, global, cli)
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return false; // Not excluded, definitely don't prune
        }
        // 2. If excluded, check if an *explicit* include pattern overrides the exclusion.
        const explicitIncludes = this.getExplicitIncludePatternsForOverride(); // Gets specific includes
        if (explicitIncludes.length > 0) {
            // --- FIX START: Refined check for explicit include override ---
            // Check if the directory ITSELF is explicitly included
            const isDirExplicitlyIncluded = this.matchesAnyPattern(name, fullPath, relativePath, explicitIncludes);
            if (isDirExplicitlyIncluded) {
                // console.log(`DEBUG: Not pruning "${name}" because it is explicitly included.`);
                return false; // Directory itself matches an explicit include - DO NOT prune
            }
            // Heuristic: Check if any explicit include pattern *might* target descendants
            // If a pattern contains separators or globstars, assume it could match deeper.
            const mightIncludeDescendants = explicitIncludes.some(p => p.includes('/') || p.includes('**'));
            if (mightIncludeDescendants) {
                // Check if the *reason* for exclusion was a default exclude. If so, and an
                // explicit include might match descendants, don't prune yet. Let shouldPrintItem handle filtering later.
                const isExcludedByDefaultOnly = this.matchesAnyPattern(name, fullPath, relativePath, Array.from(this.defaultExcludesSet)) &&
                    !this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns.filter(p => !this.defaultExcludesSet.has(p)));
                if (isExcludedByDefaultOnly) {
                    // console.log(`DEBUG: Not pruning "${name}" (default exclude) because explicit includes might match descendants.`);
                    return false; // Don't prune default excludes if descendant includes exist
                }
            }
            // --- FIX END ---
        }
        // 3. If excluded and not overridden by the logic above, then prune
        // console.log(`DEBUG: Pruning "${name}" as it's excluded and not explicitly included or overridden.`);
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
            // If the item itself isn't included, don't print it, even if it's a parent of an included item.
            // The pruning logic should have already prevented skipping this directory if a child was included.
            return false;
        }
        // 3. Exclude Check: Check against the combined exclude patterns.
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return true; // Included and not excluded - PRINT
        }
        // --- Item IS excluded. Now check for override ---
        // Is the exclusion *only* because of a default pattern?
        const isExcludedByDefaultOnly = this.matchesAnyPattern(name, fullPath, relativePath, Array.from(this.defaultExcludesSet)) &&
            !this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns.filter(p => !this.defaultExcludesSet.has(p)) // Excludes NOT in the default set
            );
        if (isExcludedByDefaultOnly) {
            // Get the specific (non-'*', non-'.*', non-'**') include patterns
            const explicitIncludes = this.getExplicitIncludePatternsForOverride();
            // *** --- START REVISED OVERRIDE LOGIC --- ***
            // If the exclusion was *only* due to a default pattern,
            // and there are *any* explicit includes provided by the user
            // (which might match this item or its descendants), then the
            // default exclusion is overridden for *this specific item*.
            // The `shouldPrune` logic already determined that traversal
            // should continue based on potential descendant matches.
            if (explicitIncludes.length > 0) {
                // console.log(`DEBUG: Printing "${name}" (excluded by default, but override applies because explicit includes exist)`);
                return true; // Override the default exclusion for printing this item.
            }
            // *** --- END REVISED OVERRIDE LOGIC --- ***
            // If no explicit includes were provided, the default exclusion remains in effect for this item.
        }
        // --- If we reach here: Item is excluded, and override conditions were not met.
        // console.log(`DEBUG: Not printing "${name}" (excluded: ${isExcluded}, byDefaultOnly: ${isExcludedByDefaultOnly}, override check failed)`);
        return false; // Excluded - DO NOT PRINT
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
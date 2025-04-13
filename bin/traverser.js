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
        this.basePath = path_1.default.resolve(basePath);
        this.baseMicromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true
        };
        // Pre-calculate include patterns that are not the default '*' for override logic
        this.nonDefaultIncludePatterns = options.includePatterns.filter(p => p !== '*');
    }
    /**
     * Checks if an item matches any pattern in a list.
     * [ ... matchesAnyPattern implementation remains unchanged ... ]
     */
    matchesAnyPattern(name, fullPath, relativePath, patterns) {
        if (!patterns || patterns.length === 0) {
            return false;
        }
        // Normalize paths for consistent matching, always using forward slashes
        const absPathNormalized = path_1.default.normalize(fullPath).replace(/\\/g, '/');
        // Ensure relative path is calculated correctly for the root case as well
        const relPathNormalized = this.options.relativePaths
            ? (path_1.default.normalize(fullPath) === path_1.default.normalize(this.basePath) ? '.' : path_1.default.normalize(relativePath).replace(/\\/g, '/'))
            : ''; // Only calculate if needed
        const basePathsToTest = [
            name, // Base name (e.g., 'file.txt', 'node_modules')
            absPathNormalized // Absolute path (e.g., '/User/project/src/file.txt')
        ];
        if (this.options.relativePaths && relPathNormalized && !basePathsToTest.includes(relPathNormalized)) {
            basePathsToTest.push(relPathNormalized); // Relative path (e.g., '.', 'src/file.txt')
        }
        // --- FIX START: Check each pattern individually for /** ---
        for (const pattern of patterns) {
            let currentPathsToTest = [...basePathsToTest]; // Copy base paths for this pattern
            // If pattern ends with /**, it should match contents, not the dir itself.
            // Remove the path representation that *is* the directory base from the list
            // of paths we test against *this specific pattern*.
            if (pattern.endsWith('/**')) {
                const patternBase = pattern.substring(0, pattern.length - 3); // e.g., 'dir1' or '/abs/path/dir1'
                // Filter out paths that are exactly the base of the globstar pattern
                currentPathsToTest = currentPathsToTest.filter(p => {
                    // Normalize the path being tested FOR THIS COMPARISON ONLY
                    const normalizedTestPath = path_1.default.normalize(p).replace(/\\/g, '/');
                    // Normalize the pattern base FOR THIS COMPARISON ONLY
                    const normalizedPatternBase = path_1.default.normalize(patternBase).replace(/\\/g, '/');
                    return normalizedTestPath !== normalizedPatternBase;
                });
                // If filtering removed all paths, this pattern cannot match
                if (currentPathsToTest.length === 0) {
                    continue; // Skip to the next pattern
                }
            }
            // Special handling for '.' and '.*' include patterns
            if (pattern === '.' && !this.options.relativePaths) {
                continue; // Skip "." if relative paths are disabled
            }
            if (pattern === '.*' && name !== '.' && !name.startsWith('.')) {
                continue; //If pattern is '.*' and name doesnt starts with '.'
            }
            // Now check if *any* of the potentially filtered paths match the current pattern
            if (micromatch_1.default.some(currentPathsToTest, [pattern], this.baseMicromatchOptions)) {
                return true; // Found a match with this pattern
            }
        }
        // --- FIX END ---
        return false; // No pattern matched after applying the /** filter logic
    }
    /** Calculates the relative path string based on options. */
    calculateRelativePath(fullPath) {
        if (!this.options.relativePaths) {
            return '';
        }
        if (path_1.default.normalize(fullPath) === path_1.default.normalize(this.basePath)) {
            return '.';
        }
        const relPath = path_1.default.relative(this.basePath, fullPath);
        return (relPath || path_1.default.basename(fullPath)).replace(/\\/g, '/');
    }
    /** Prepares a list of "explicit" include patterns used for overriding directory pruning. */
    getExplicitIncludePatternsForDirectoryOverride() {
        // Filter out broad patterns that shouldn't override specific default excludes
        const specificNonDefaultIncludes = this.nonDefaultIncludePatterns.filter(p => p !== '*' && p !== '.*' && p !== '**');
        if (specificNonDefaultIncludes.length === 0) {
            return [];
        }
        const derivedPatterns = specificNonDefaultIncludes.map(p => {
            // If pattern targets content (e.g., dir/file, dir/**), derive the dir name itself
            if (p.includes('/') || p.includes(path_1.default.sep)) {
                const base = p.split(/\/|\\/)[0];
                if (base && !base.includes('*'))
                    return base; // Return first path segment if non-glob
            }
            if (p.endsWith('/**'))
                return p.substring(0, p.length - 3);
            if (p.endsWith('/'))
                return p.substring(0, p.length - 1);
            return null;
        }).filter((p) => p !== null && !p.includes('*')); // Only non-glob derived patterns
        // Combine specific original non-default patterns with derived patterns for directory name matching
        return [...new Set([...specificNonDefaultIncludes, ...derivedPatterns])];
    }
    // ========================================================================
    // ==                     START shouldPrune CHANGES                      ==
    // ========================================================================
    /** Checks if a directory should be pruned. */
    shouldPrune(name, fullPath, relativePath) {
        // 1. Check if excluded by any pattern in the *effective* exclude list
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return false; // Not excluded, definitely don't prune
        }
        // --- Item IS excluded. Check for explicit include override ---
        // Override Check 1: Does the directory ITSELF match an explicit non-default include pattern?
        const explicitDirIncludes = this.getExplicitIncludePatternsForDirectoryOverride();
        if (explicitDirIncludes.length > 0) {
            if (this.matchesAnyPattern(name, fullPath, relativePath, explicitDirIncludes)) {
                // console.log(`DEBUG: [Prune Override 1] Not pruning "${name}" because it (directory) is explicitly included by name/path.`);
                return false; // Directory itself is explicitly included, DO NOT prune
            }
        }
        // --- REFINED Override Check 2: ---
        // If the directory is excluded ONLY by a DEFAULT pattern, AND there exists a non-default
        // include pattern that appears to target something *inside* this directory, DO NOT prune.
        const isExcludedByDefault = this.matchesAnyPattern(name, fullPath, relativePath, this.options.defaultExcludes);
        const cliAndGlobalExcludes = this.options.excludePatterns.filter(p => !this.options.defaultExcludes.includes(p));
        const isExcludedByCliOrGlobal = this.matchesAnyPattern(name, fullPath, relativePath, cliAndGlobalExcludes);
        if (isExcludedByDefault && !isExcludedByCliOrGlobal && this.nonDefaultIncludePatterns.length > 0) {
            const normFullPathPrefix = path_1.default.normalize(fullPath).replace(/\\/g, '/') + '/'; // Normalize and add trailing slash
            const normRelativePathPrefix = this.options.relativePaths ? path_1.default.normalize(relativePath).replace(/\\/g, '/') + '/' : '';
            // Check if any non-default include pattern starts with the path of the directory being considered
            const targetsContentInside = this.nonDefaultIncludePatterns.some(p => {
                const normPattern = path_1.default.normalize(p).replace(/\\/g, '/');
                // Check absolute path prefix, OR relative path prefix if applicable
                // Ensure pattern isn't just the directory path itself (already handled by Override 1)
                // Check if pattern length is greater than prefix length to ensure it's targeting *inside*
                return (normPattern.startsWith(normFullPathPrefix) && normPattern.length > normFullPathPrefix.length) ||
                    (this.options.relativePaths && normRelativePathPrefix && normPattern.startsWith(normRelativePathPrefix) && normPattern.length > normRelativePathPrefix.length);
            });
            if (targetsContentInside) {
                // console.log(`DEBUG: [Prune Override 2 - Refined] Not pruning "${name}" because a non-default include targets content inside.`);
                return false; // Found an include targeting content inside, DO NOT prune
            }
        }
        // --- END REFINED Override Check 2 ---
        // console.log(`DEBUG: Pruning "${name}" as it's excluded and not overridden.`);
        return true; // Excluded and not overridden. PRUNE.
    }
    // ========================================================================
    // ==                      END shouldPrune CHANGES                       ==
    // ========================================================================
    /** Checks if an item (file or directory) should be printed based on all filters. */
    shouldPrintItem(name, fullPath, relativePath, isDirectory, isFile) {
        // --- ADDED: Prevent printing '.' when relativePaths is true ---
        // The '.' represents the base for relative paths, not an item to list itself.
        if (name === '.' && this.options.relativePaths && path_1.default.normalize(fullPath) === path_1.default.normalize(this.basePath)) {
            // console.log(`DEBUG: Not printing "." for the starting directory in relative mode.`);
            return false;
        }
        // --- END ADD ---
        // 1. Type Check (remains the same)
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
            // console.log(`DEBUG: Not printing "${name}" (doesn't match includes)`);
            return false;
        }
        // 3. Exclude Check: Check against the combined exclude patterns.
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        // --- Decision Logic ---
        if (isExcluded) {
            // Item is excluded. Override ONLY IF it matches a *specific* non-default include
            // pattern that effectively targets this item, particularly for overriding default excludes.
            // Broad patterns like '*' or '.*' should NOT override specific default excludes like '.git'.
            // Check if it's excluded *specifically* by a default exclude pattern.
            const isExcludedByDefault = this.matchesAnyPattern(name, fullPath, relativePath, this.options.defaultExcludes);
            if (isExcludedByDefault && this.nonDefaultIncludePatterns.length > 0) {
                // Check if any non-default include *specifically* targets this item.
                // This requires a more refined check. We look for patterns that essentially
                // match the item's name or a path segment identical to a default exclude.
                // This prevents broad patterns like '*.js' or '.*' from overriding '.git'.
                const specificTargetingIncludes = this.nonDefaultIncludePatterns.filter(p => {
                    const normPattern = path_1.default.normalize(p).replace(/\\/g, '/');
                    // Does the pattern exactly match the name? (e.g., pattern '.git' matches name '.git')
                    if (normPattern === name)
                        return true;
                    // Does the pattern exactly match the relative path? (e.g., pattern 'node_modules' matches relative path 'node_modules')
                    if (this.options.relativePaths && normPattern === relativePath)
                        return true;
                    // Does the pattern exactly match the absolute path?
                    const normFullPath = path_1.default.normalize(fullPath).replace(/\\/g, '/');
                    if (normPattern === normFullPath)
                        return true;
                    // Allow 'node_modules/**' or '.git/**' to override the default exclude FOR CONTENTS
                    if (p.endsWith('/**')) {
                        const patternBase = p.substring(0, p.length - 3);
                        const normPatternBase = path_1.default.normalize(patternBase).replace(/\\/g, '/');
                        // Check if the item's path *starts with* the base of the /** pattern
                        // And ensure the item is *not* the base directory itself
                        if ((relativePath.startsWith(normPatternBase + '/') || normFullPath.startsWith(normPatternBase + '/')) &&
                            (relativePath !== normPatternBase && normFullPath !== normPatternBase)) {
                            return true;
                        }
                    }
                    // Add more sophisticated logic here if needed, e.g., pattern 'dist' overriding default exclude 'dist'
                    return false;
                });
                if (specificTargetingIncludes.length > 0) {
                    // Check if it's ALSO excluded by a CLI/Global pattern. If so, the CLI/Global exclude should still win.
                    const cliAndGlobalExcludes = this.options.excludePatterns.filter(p => !this.options.defaultExcludes.includes(p));
                    const isExcludedByCliOrGlobal = this.matchesAnyPattern(name, fullPath, relativePath, cliAndGlobalExcludes);
                    if (!isExcludedByCliOrGlobal) {
                        // console.log(`DEBUG: Printing "${name}" because it matches a SPECIFIC non-default include [${specificTargetingIncludes.join(', ')}] and is NOT excluded by CLI/Global (overriding default exclusion).`);
                        return true; // Explicitly targeted by specific non-default include, override default exclusion - PRINT
                    }
                    else {
                        // console.log(`DEBUG: Not printing "${name}" despite specific include, because it IS excluded by CLI/Global pattern.`);
                    }
                }
            }
            // If not excluded by default (meaning excluded by CLI/Global) OR
            // if excluded by default but not specifically overridden above, then DO NOT PRINT.
            // console.log(`DEBUG: Not printing "${name}" (excluded, and not specifically included to override).`);
            return false;
        }
        else {
            // Item is included and not excluded - PRINT
            // console.log(`DEBUG: Printing "${name}" (included and not excluded).`);
            return true;
        }
    } // End shouldPrintItem
    /** Main traversal method */
    traverse(startPath_1) {
        return __awaiter(this, arguments, void 0, function* (startPath, currentDepth = 0) {
            const resolvedStartPath = path_1.default.resolve(startPath);
            let canReadEntries = false;
            let isStartDir = false;
            if (currentDepth === 0) {
                // Handle the starting path itself
                try {
                    const stats = yield promises_1.default.stat(resolvedStartPath);
                    const isDirectory = stats.isDirectory();
                    const isFile = stats.isFile();
                    isStartDir = isDirectory;
                    const dirName = path_1.default.basename(resolvedStartPath);
                    const relativePathForStart = this.calculateRelativePath(resolvedStartPath);
                    // Use resolvedStartPath for absolute, relativePathForStart for relative display
                    const displayPath = this.options.relativePaths ? relativePathForStart : resolvedStartPath;
                    // --- Rely on shouldPrintItem to handle the '.' case ---
                    if (this.shouldPrintItem(dirName, resolvedStartPath, relativePathForStart, isDirectory, isFile)) {
                        console.log(displayPath);
                    }
                    if (isDirectory) {
                        canReadEntries = true;
                    }
                }
                catch (err) {
                    console.error(`Error accessing start path ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                    return;
                }
            }
            else {
                // We wouldn't be called at depth > 0 unless the parent was a directory
                canReadEntries = true;
            }
            // Stop recursion checks
            if (currentDepth >= this.options.maxDepth) {
                return;
            }
            if (!canReadEntries) {
                return;
            }
            // Read Directory Entries
            let entries;
            try {
                entries = yield promises_1.default.readdir(resolvedStartPath, { withFileTypes: true });
            }
            catch (err) {
                // Log errors appropriately (avoid duplicate logging for start path)
                if (currentDepth > 0 || !isStartDir) {
                    if (err.code === 'EACCES' || err.code === 'EPERM') {
                        console.error(`Permission error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                    }
                    else {
                        console.error(`Error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                    }
                }
                return; // Stop processing this directory on error
            }
            // Process Each Entry
            for (const dirent of entries) {
                const entryName = dirent.name;
                const entryFullPath = path_1.default.join(resolvedStartPath, entryName);
                const entryRelativePath = this.calculateRelativePath(entryFullPath);
                const displayPath = this.options.relativePaths ? entryRelativePath : entryFullPath;
                const isDirectory = dirent.isDirectory();
                const isFile = dirent.isFile();
                // --- Pruning Check ---
                if (isDirectory && this.shouldPrune(entryName, entryFullPath, entryRelativePath)) {
                    // console.log(`DEBUG: Pruning directory: ${displayPath}`);
                    continue;
                }
                // --- Print Check ---
                // Rely on shouldPrintItem to handle the '.' case correctly now
                if (this.shouldPrintItem(entryName, entryFullPath, entryRelativePath, isDirectory, isFile)) {
                    console.log(displayPath);
                }
                // --- Recurse ---
                if (isDirectory) {
                    // Depth check for *next* level happens at the start of the recursive call
                    yield this.traverse(entryFullPath, currentDepth + 1);
                }
            }
        });
    } // End traverse
} // End class
exports.DirectoryTraverser = DirectoryTraverser;
//# sourceMappingURL=traverser.js.map
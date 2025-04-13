// src/traverser.ts
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';
import type { Dirent } from 'fs';

// Options interface remains the same
export interface TraverseOptions {
    excludePatterns: string[]; // Combined effective list from config
    includePatterns: string[];
    matchType: 'f' | 'd' | null;
    maxDepth: number;
    ignoreCase: boolean;
    relativePaths: boolean;
    defaultExcludes: string[]; // The hardcoded defaults for override logic
}

interface InternalMicromatchOptions {
    nocase: boolean;
    dot: boolean;
}

export class DirectoryTraverser {
    private readonly options: TraverseOptions;
    private readonly basePath: string;
    private readonly baseMicromatchOptions: InternalMicromatchOptions;
    private readonly nonDefaultIncludePatterns: string[]; // Include patterns other than '*'

    constructor(options: TraverseOptions, basePath: string) {
        this.options = options;
        this.basePath = path.resolve(basePath);
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
    private matchesAnyPattern(
        name: string,
        fullPath: string,
        relativePath: string,
        patterns: string[]
    ): boolean {
        if (!patterns || patterns.length === 0) {
            return false;
        }
        // Normalize paths for consistent matching, always using forward slashes
        const absPathNormalized = path.normalize(fullPath).replace(/\\/g, '/');
        // Ensure relative path is calculated correctly for the root case as well
        const relPathNormalized = this.options.relativePaths
            ? (path.normalize(fullPath) === path.normalize(this.basePath) ? '.' : path.normalize(relativePath).replace(/\\/g, '/'))
            : ''; // Only calculate if needed

        const basePathsToTest: string[] = [
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
                    const normalizedTestPath = path.normalize(p).replace(/\\/g, '/');
                    // Normalize the pattern base FOR THIS COMPARISON ONLY
                    const normalizedPatternBase = path.normalize(patternBase).replace(/\\/g, '/');
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
            if (micromatch.some(currentPathsToTest, [pattern], this.baseMicromatchOptions)) {
                return true; // Found a match with this pattern
            }
        }
        // --- FIX END ---

        return false; // No pattern matched after applying the /** filter logic
    }


    /** Calculates the relative path string based on options. */
    private calculateRelativePath(fullPath: string): string {
        if (!this.options.relativePaths) {
            return '';
        }
        if (path.normalize(fullPath) === path.normalize(this.basePath)) {
            return '.';
        }
        const relPath = path.relative(this.basePath, fullPath);
        return (relPath || path.basename(fullPath)).replace(/\\/g, '/');
    }

    /** Prepares a list of "explicit" include patterns used for overriding directory pruning. */
    private getExplicitIncludePatternsForDirectoryOverride(): string[] {
        // Filter out broad patterns that shouldn't override specific default excludes
        const specificNonDefaultIncludes = this.nonDefaultIncludePatterns.filter(p =>
            p !== '*' && p !== '.*' && p !== '**'
        );
        if (specificNonDefaultIncludes.length === 0) {
            return [];
        }
        const derivedPatterns = specificNonDefaultIncludes.map(p => {
            // If pattern targets content (e.g., dir/file, dir/**), derive the dir name itself
            if (p.includes('/') || p.includes(path.sep)) {
                const base = p.split(/\/|\\/)[0];
                if (base && !base.includes('*')) return base; // Return first path segment if non-glob
            }
            if (p.endsWith('/**')) return p.substring(0, p.length - 3);
            if (p.endsWith('/')) return p.substring(0, p.length - 1);
            return null;
        }).filter((p): p is string => p !== null && !p.includes('*')); // Only non-glob derived patterns

        // Combine specific original non-default patterns with derived patterns for directory name matching
        return [...new Set([...specificNonDefaultIncludes, ...derivedPatterns])];
    }

    // ========================================================================
    // ==                     START shouldPrune CHANGES                      ==
    // ========================================================================

    /** Checks if a directory should be pruned. */
    private shouldPrune(
        name: string,
        fullPath: string,
        relativePath: string
    ): boolean {
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

        // --- ADD BACK Override Check 2 (modified): ---
        // If the directory is excluded ONLY by a DEFAULT pattern, AND the user provided
        // ANY non-default include patterns, DO NOT prune. This allows traversal to potentially
        // find explicitly included items inside default-excluded dirs.
        const isExcludedByDefault = this.matchesAnyPattern(name, fullPath, relativePath, this.options.defaultExcludes);
        const cliAndGlobalExcludes = this.options.excludePatterns.filter(p => !this.options.defaultExcludes.includes(p));
        const isExcludedByCliOrGlobal = this.matchesAnyPattern(name, fullPath, relativePath, cliAndGlobalExcludes);

        if (isExcludedByDefault && !isExcludedByCliOrGlobal && this.nonDefaultIncludePatterns.length > 0) {
             // console.log(`DEBUG: [Prune Override 2] Not pruning "${name}" because it's excluded only by default AND non-default includes exist.`);
             return false; // Don't prune, allow descent
        }
        // --- END ADD BACK ---

        // console.log(`DEBUG: Pruning "${name}" as it's excluded and not overridden.`);
        return true; // Excluded and not overridden. PRUNE.
    }


    // ========================================================================
    // ==                      END shouldPrune CHANGES                       ==
    // ========================================================================


    /** Checks if an item (file or directory) should be printed based on all filters. */
    private shouldPrintItem(
        name: string,
        fullPath: string,
        relativePath: string,
        isDirectory: boolean,
        isFile: boolean
    ): boolean {
        // --- ADDED: Prevent printing '.' when relativePaths is true ---
        // The '.' represents the base for relative paths, not an item to list itself.
        if (name === '.' && this.options.relativePaths && path.normalize(fullPath) === path.normalize(this.basePath)) {
             // console.log(`DEBUG: Not printing "." for the starting directory in relative mode.`);
             return false;
        }
        // --- END ADD ---

        // 1. Type Check (remains the same)
        const { matchType } = this.options;
        if (matchType) {
            if (matchType === 'f' && !isFile) return false;
            if (matchType === 'd' && !isDirectory) return false;
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
                     const normPattern = path.normalize(p).replace(/\\/g, '/');
                     // Does the pattern exactly match the name? (e.g., pattern '.git' matches name '.git')
                     if (normPattern === name) return true;
                     // Does the pattern exactly match the relative path? (e.g., pattern 'node_modules' matches relative path 'node_modules')
                     if (this.options.relativePaths && normPattern === relativePath) return true;
                     // Does the pattern exactly match the absolute path?
                     const normFullPath = path.normalize(fullPath).replace(/\\/g, '/');
                     if (normPattern === normFullPath) return true;
                     // Allow 'node_modules/**' or '.git/**' to override the default exclude FOR CONTENTS
                     if (p.endsWith('/**')) {
                        const patternBase = p.substring(0, p.length - 3);
                        const normPatternBase = path.normalize(patternBase).replace(/\\/g, '/');
                        // Check if the item's path *starts with* the base of the /** pattern
                        // And ensure the item is *not* the base directory itself
                        if ((relativePath.startsWith(normPatternBase + '/') || normFullPath.startsWith(normPatternBase + '/')) &&
                            (relativePath !== normPatternBase && normFullPath !== normPatternBase))
                         {
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
                       } else {
                          // console.log(`DEBUG: Not printing "${name}" despite specific include, because it IS excluded by CLI/Global pattern.`);
                       }
                 }
            }
            // If not excluded by default (meaning excluded by CLI/Global) OR
            // if excluded by default but not specifically overridden above, then DO NOT PRINT.
            // console.log(`DEBUG: Not printing "${name}" (excluded, and not specifically included to override).`);
            return false;
        } else {
            // Item is included and not excluded - PRINT
            // console.log(`DEBUG: Printing "${name}" (included and not excluded).`);
            return true;
        }
    } // End shouldPrintItem


    /** Main traversal method */
    public async traverse(startPath: string, currentDepth: number = 0): Promise<void> {
        const resolvedStartPath = path.resolve(startPath);

        let canReadEntries = false;
        let isStartDir = false;
        if (currentDepth === 0) {
            // Handle the starting path itself
            try {
                const stats = await fs.stat(resolvedStartPath);
                const isDirectory = stats.isDirectory();
                const isFile = stats.isFile();
                isStartDir = isDirectory;

                const dirName = path.basename(resolvedStartPath);
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
            } catch (err: any) {
                console.error(`Error accessing start path ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                return;
            }
        } else {
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
        let entries: Dirent[];
        try {
            entries = await fs.readdir(resolvedStartPath, { withFileTypes: true });
        } catch (err: any) {
            // Log errors appropriately (avoid duplicate logging for start path)
            if (currentDepth > 0 || !isStartDir) {
                 if (err.code === 'EACCES' || err.code === 'EPERM') {
                     console.error(`Permission error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                 } else {
                     console.error(`Error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
                 }
            }
            return; // Stop processing this directory on error
        }

        // Process Each Entry
        for (const dirent of entries) {
             const entryName = dirent.name;
             const entryFullPath = path.join(resolvedStartPath, entryName);
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
                 await this.traverse(entryFullPath, currentDepth + 1);
             }
        }
    } // End traverse

} // End class
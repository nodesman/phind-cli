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
    // No need for defaultExcludesSet if we directly use defaultExcludes array
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
     * Tests against the item's name, its normalized absolute path, and
     * (if relativePaths option is true) its normalized relative path.
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
        const relPathNormalized = relativePath === '.' ? '.' : path.normalize(relativePath).replace(/\\/g, '/');

        const pathsToTest: string[] = [
            name, // Base name (e.g., 'file.txt', 'node_modules')
            absPathNormalized // Absolute path (e.g., '/User/project/src/file.txt')
        ];
        if (this.options.relativePaths && relPathNormalized) {
             if (!pathsToTest.includes(relPathNormalized)) {
                 pathsToTest.push(relPathNormalized); // Relative path (e.g., '.', 'src/file.txt')
             }
        }
        return micromatch.some(pathsToTest, patterns, this.baseMicromatchOptions);
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

        // --- Item IS excluded. Check for overrides ---

        // Override Check 1: Does the directory ITSELF match an explicit non-default include pattern?
        // (Handles cases like include: ['node_modules'] when node_modules is excluded by default)
        const explicitDirIncludes = this.getExplicitIncludePatternsForDirectoryOverride();
        if (explicitDirIncludes.length > 0) {
            if (this.matchesAnyPattern(name, fullPath, relativePath, explicitDirIncludes)) {
                // console.log(`DEBUG: [Prune Override 1] Not pruning "${name}" because it (directory) is explicitly included by name/path.`);
                return false; // Directory itself is explicitly included, DO NOT prune
            }
        }

        // Override Check 2: Is this directory excluded *only* by a default pattern, AND
        // did the user provide *any* non-default include patterns?
        // (Handles cases like exclude: ['node_modules'] (default), include: ['*.js'] or include: ['node_modules/pkg/index.js'])
        // If yes, we don't prune, allowing traversal to potentially find explicitly included descendants.
        const isExcludedByDefault = this.matchesAnyPattern(name, fullPath, relativePath, this.options.defaultExcludes);
        if (isExcludedByDefault) {
            // Also check if it's *also* excluded by a CLI/global pattern. If so, don't override pruning.
            const cliAndGlobalExcludes = this.options.excludePatterns.filter(p => !this.options.defaultExcludes.includes(p));
            const isExcludedByCliOrGlobal = this.matchesAnyPattern(name, fullPath, relativePath, cliAndGlobalExcludes);

            if (!isExcludedByCliOrGlobal && this.nonDefaultIncludePatterns.length > 0) {
                // console.log(`DEBUG: [Prune Override 2] Not pruning "${name}" because it matches a default exclude but non-default includes exist (and no CLI/global exclude matches).`);
                return false; // Matches default exclude, but user specified includes, so DO NOT prune.
            }
        }


        // --- If we reach here, it's excluded and not overridden by the above checks. PRUNE. ---
        // console.log(`DEBUG: Pruning "${name}" as it's excluded and not overridden.`);
        return true;
    }

    /** Checks if an item (file or directory) should be printed based on all filters. */
    private shouldPrintItem(
        name: string,
        fullPath: string,
        relativePath: string,
        isDirectory: boolean,
        isFile: boolean
    ): boolean {
        // 1. Type Check
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
            // Item is excluded. Override if it matches ANY non-default include pattern.
            // This allows includes like '*.js' or 'node_modules/pkg/index.js' to override
            // the exclusion of 'node_modules'.
            if (this.nonDefaultIncludePatterns.length > 0) {
                const matchesNonDefaultInclude = this.matchesAnyPattern(name, fullPath, relativePath, this.nonDefaultIncludePatterns);
                if (matchesNonDefaultInclude) {
                    // console.log(`DEBUG: Printing "${name}" because it matches a non-default include (overriding exclusion).`);
                    return true; // Explicitly included via non-default pattern, override the exclusion - PRINT
                }
            }
            // console.log(`DEBUG: Not printing "${name}" (included, but excluded, and not explicitly included to override).`);
            return false; // Excluded and not overridden by a non-default include - DO NOT PRINT
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
            try {
                const stats = await fs.stat(resolvedStartPath);
                const isDirectory = stats.isDirectory();
                const isFile = stats.isFile();
                isStartDir = isDirectory; // Track if the starting point itself is a directory

                const dirName = path.basename(resolvedStartPath);
                const relativePathForStart = this.calculateRelativePath(resolvedStartPath);
                const displayPath = this.options.relativePaths ? relativePathForStart : resolvedStartPath;

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
        if (!canReadEntries) { // Also handles case where start path was a file
            return;
        }

        // Read Directory Entries
        let entries: Dirent[];
        try {
            entries = await fs.readdir(resolvedStartPath, { withFileTypes: true });
        } catch (err: any) {
            // Only log error if it wasn't the starting directory itself that failed (already logged above)
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
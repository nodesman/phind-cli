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
    // `matchBase: true` could be considered if patterns like 'node_modules'
    // should always match regardless of path separators, but explicit path
    // testing (name, relative, absolute) is generally more reliable.
}

export class DirectoryTraverser {
    private readonly options: TraverseOptions;
    private readonly basePath: string; // Absolute, resolved path to the starting directory
    private readonly baseMicromatchOptions: InternalMicromatchOptions;
    private readonly defaultExcludesSet: Set<string>; // Use a Set for efficient lookup
    private readonly nonDefaultIncludePatterns: string[]; // Include patterns other than '*'

    constructor(options: TraverseOptions, basePath: string) {
        this.options = options;
        // Ensure basePath is absolute and normalized for consistent comparisons
        this.basePath = path.resolve(basePath);
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
    private matchesAnyPattern(
        name: string,
        fullPath: string,
        relativePath: string, // Calculated relative path (e.g., '.', 'dir/file.txt')
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

        // Only add relative path to the test set if the option is enabled AND
        // the relative path is not empty (it will be '' for the base dir if relativePaths=false)
        // and not identical to the absolute path or name already included.
        if (this.options.relativePaths && relPathNormalized) {
             if (!pathsToTest.includes(relPathNormalized)) {
                 pathsToTest.push(relPathNormalized); // Relative path (e.g., '.', 'src/file.txt')
             }
        }

        // Use micromatch.some for efficiency
        return micromatch.some(pathsToTest, patterns, this.baseMicromatchOptions);
    }

    /**
     * Calculates the relative path string based on options.
     * Returns '.' for the base path itself if relativePaths is true.
     * Returns an empty string if relativePaths is false (or for non-relative matching).
     */
    private calculateRelativePath(fullPath: string): string {
        if (!this.options.relativePaths) {
            return ''; // No relative path needed for matching/display if option is off
        }
        // Use normalize to handle potential trailing slashes, etc. before comparison
        if (path.normalize(fullPath) === path.normalize(this.basePath)) {
            return '.'; // Special case for the starting directory itself
        }
        // Calculate relative path, ensure forward slashes
        const relPath = path.relative(this.basePath, fullPath);
        // If relPath is somehow empty (e.g., path.relative('/a', '/a/')), use basename as fallback
        return (relPath || path.basename(fullPath)).replace(/\\/g, '/');
    }

     /**
     * Prepares a list of "explicit" include patterns used for overriding default excludes.
     * Handles patterns like 'dir/**' or 'dir/' matching the directory 'dir' itself.
     */
    private getExplicitIncludePatternsForOverride(): string[] {
        if (this.nonDefaultIncludePatterns.length === 0) {
            return [];
        }
        const derivedPatterns = this.nonDefaultIncludePatterns.map(p => {
            if (p.endsWith('/**')) return p.substring(0, p.length - 3);
            if (p.endsWith('/')) return p.substring(0, p.length - 1);
            return null; // No derived pattern for this one
        }).filter((p): p is string => p !== null); // Filter out nulls and ensure type string

        // Combine original non-default patterns with derived patterns, ensuring uniqueness
        return [...new Set([...this.nonDefaultIncludePatterns, ...derivedPatterns])];
    }

    /**
     * Checks if a directory should be pruned (i.e., not traversed into).
     * Prune if it matches an exclude pattern UNLESS it specifically matches
     * an explicit (non-'*') include pattern.
     */
    private shouldPrune(
        name: string,
        fullPath: string,
        relativePath: string
    ): boolean {
        // 1. Check if excluded by any pattern (default, global, cli)
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return false; // Not excluded, definitely don't prune
        }

        // 2. If excluded, check if an *explicit* include pattern overrides the exclusion
        // This prevents pruning 'node_modules' if `--name node_modules/specific-package` was used.
        const explicitIncludes = this.getExplicitIncludePatternsForOverride();
        if (explicitIncludes.length > 0) {
             const isExplicitlyIncluded = this.matchesAnyPattern(name, fullPath, relativePath, explicitIncludes);
             if (isExplicitlyIncluded) {
                 return false; // Excluded, but explicitly included - DO NOT prune
             }
        }

        // 3. If excluded and not explicitly included, then prune
        return true;
    }

    /**
     * Checks if an item (file or directory) should be printed based on all filters.
     */
    private shouldPrintItem(
        name: string,
        fullPath: string,
        relativePath: string,
        isDirectory: boolean,
        isFile: boolean
    ): boolean {
        // 1. Type Check: If a type filter is specified, the item must match.
        const { matchType } = this.options;
        if (matchType) {
            if (matchType === 'f' && !isFile) return false;
            if (matchType === 'd' && !isDirectory) return false;
        }

        // 2. Include Check: Item must match at least one include pattern.
        const isIncluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.includePatterns);
        if (!isIncluded) {
            return false;
        }

        // 3. Exclude Check: Check against the combined exclude patterns.
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return true; // Included and not excluded - PRINT
        }

        // --- Item IS excluded. Now check if it's an override case ---
        // Override applies if:
        //   a) The exclusion comes *only* from a default pattern (e.g., 'node_modules').
        //   b) The item *also* matches an explicit (non-'*') include pattern.

        // Check if it matches ONLY default excludes
        const isExcludedByDefault = this.matchesAnyPattern(name, fullPath, relativePath, Array.from(this.defaultExcludesSet));

        if (isExcludedByDefault) {
            // Now check if it matches any explicit include patterns
            const explicitIncludes = this.getExplicitIncludePatternsForOverride();
            if (explicitIncludes.length > 0) {
                const isExplicitlyIncluded = this.matchesAnyPattern(name, fullPath, relativePath, explicitIncludes);
                if (isExplicitlyIncluded) {
                    // console.log(`DEBUG: Printing "${name}" (excluded by default, but explicitly included)`);
                    return true; // Override applies - PRINT
                }
            }
        }

        // --- If we reach here: Item is excluded, and it's either not a default exclude,
        // --- or it wasn't explicitly included to trigger the override.
        // console.log(`DEBUG: Not printing "${name}" (excluded)`);
        return false; // Excluded - DO NOT PRINT
    }

    public async traverse(startPath: string, currentDepth: number = 0): Promise<void> {
        const resolvedStartPath = path.resolve(startPath); // Ensure start path is absolute

        // --- 1. Handle Starting Directory (Depth 0) ---
        // The starting directory itself should be considered for printing if depth >= 0.
        if (currentDepth === 0) {
            const dirName = path.basename(resolvedStartPath);
            const isDirectory = true; // We assume validateStartPath ensures this
            const isFile = false;
            // Calculate relative path *before* calling shouldPrintItem
            const relativePathForStart = this.calculateRelativePath(resolvedStartPath); // Will be '.' or ''
            const displayPath = this.options.relativePaths ? '.' : resolvedStartPath; // Use '.' or absolute path

            if (this.shouldPrintItem(dirName, resolvedStartPath, relativePathForStart, isDirectory, isFile)) {
                console.log(displayPath);
            }
        }

        // --- 2. Depth Check for Recursion ---
        // Stop recursing if we have reached the maximum allowed depth.
        // Note: maxDepth 0 means only the starting dir (handled above).
        // maxDepth 1 means starting dir + direct children. We need to read entries if maxDepth > 0.
        if (currentDepth >= this.options.maxDepth) {
            return;
        }

        // --- 3. Read Directory Entries ---
        let entries: Dirent[];
        try {
            // Use withFileTypes for efficiency, getting type info without extra stats calls
            entries = await fs.readdir(resolvedStartPath, { withFileTypes: true });
        } catch (err: any) {
            // Report permission errors but continue if possible (fail gracefully)
            if (err.code === 'EACCES' || err.code === 'EPERM') {
                 // Use console.error for errors/warnings
                 console.error(`Permission error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
            } else {
                 console.error(`Error reading directory ${resolvedStartPath.replace(/\\/g, '/')}: ${err.message}`);
            }
            return; // Stop processing this directory on error
        }

        // --- 4. Process Each Entry ---
        for (const dirent of entries) {
            const entryName = dirent.name;
            const entryFullPath = path.join(resolvedStartPath, entryName);
            const entryRelativePath = this.calculateRelativePath(entryFullPath); // Calc relative path for matching/display
            const displayPath = this.options.relativePaths ? entryRelativePath : entryFullPath;

            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();

            // --- 4a. Pruning Check (for directories only) ---
            // If a directory should be pruned, skip printing it AND recursing into it.
            if (isDirectory && this.shouldPrune(entryName, entryFullPath, entryRelativePath)) {
                // console.log(`DEBUG: Pruning directory: ${displayPath}`);
                continue; // Skip this entry entirely
            }

            // --- 4b. Filtering & Printing ---
            // Check if the *item itself* should be printed (passes all filters)
            // No need for extra depth check here, pruning/recursion depth handles limits.
            if (this.shouldPrintItem(entryName, entryFullPath, entryRelativePath, isDirectory, isFile)) {
                 console.log(displayPath);
            }

            // --- 4c. Recurse into Subdirectories ---
            // Only recurse if it's a directory AND we haven't finished exploring maxDepth levels.
            // The depth check for recursion is handled at the START of the next call.
            if (isDirectory) {
                 await this.traverse(entryFullPath, currentDepth + 1);
            }
        }
    } // End traverse
} // End class
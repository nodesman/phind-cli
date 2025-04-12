// src/traverser.ts
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';
import type { Dirent } from 'fs';

// Define an interface for the options for better type safety
// Note: ExcludePatterns are now handled by PhindConfig usually
export interface TraverseOptions {
    excludePatterns: string[]; // Keep for direct passing if needed, but usually comes from config
    includePatterns: string[];
    matchType: 'f' | 'd' | null;
    maxDepth: number;
    ignoreCase: boolean;
    relativePaths: boolean;
    // basePath is now a class member, no longer passed directly in options here
}

interface MicromatchOptions {
    nocase: boolean;
    dot: boolean;
}

export class DirectoryTraverser {
    private options: TraverseOptions;
    private basePath: string;
    private micromatchOptions: MicromatchOptions;

    constructor(options: TraverseOptions, basePath: string) {
        this.options = options;
        this.basePath = basePath;
        this.micromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true // Always match dotfiles unless explicitly excluded
        };
    }

    public async traverse(dirPath: string, currentDepth: number = 0): Promise<void> {
        const {
            excludePatterns,
            includePatterns,
            matchType,
            maxDepth,
            relativePaths
            // basePath is now this.basePath
        } = this.options;

        // *** START: New check for starting directory (depth 0) ***
        if (currentDepth === 0) {
            // Check if the starting directory itself should be listed based on options
            const isDirTypeMatch = !matchType || matchType === 'd'; // Starting point is always a directory

            // Use appropriate paths for matching
            const dirName = path.basename(dirPath); // For name-only patterns
            const displayPath = relativePaths ? '.' : dirPath; // Path to display if matched

            // Check include/exclude against the starting directory itself
            // Pass '.' as relativePath when checking the start dir with relativePaths=true
            const isIncluded = this.isMatch(dirName, dirPath, '.', includePatterns);
            const isExcluded = this.isMatch(dirName, dirPath, '.', excludePatterns);

            // Print if it meets all criteria (and depth is >= 0, which is always true here)
            if (isDirTypeMatch && isIncluded && !isExcluded) {
                 console.log(displayPath);
            }

            // Optimization: If maxDepth is 0, we are done after checking the start dir.
            // If we continue, the next check (currentDepth >= maxDepth) handles it.
        }
        // *** END: New check ***

        // Stop further recursion if max depth is reached or exceeded
        // Use >= because depth 0 is handled above, we stop *before* reading entries for depth > maxDepth
        if (currentDepth >= maxDepth) {
             return;
         }


        let entries: Dirent[];
        try {
             // Proceed to read directory contents if depth allows
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch (err: any) {
            if (err.code === 'EACCES' || err.code === 'EPERM') {
                console.error(`Permission error reading directory ${dirPath}: ${err.message}`);
            } else {
                 console.error(`Error reading directory ${dirPath}: ${err.message}`);
            }
             return; // Stop processing this path on error
        }

         // --- Loop through entries (existing logic) ---
        for (const dirent of entries) {
            const entryPath = path.join(dirPath, dirent.name);
            // Calculate display path for the *entry* relative to the original basePath
            const displayPathForEntry = relativePaths ? path.relative(this.basePath, entryPath) || '.' : entryPath;

            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();

            // --- Pruning Check (incorporating Fix 1) ---
            let shouldPrune = false;
            if (isDirectory) {
                // Check if the directory itself matches an exclude pattern
                const isPotentiallyExcluded = this.isMatch(dirent.name, entryPath, displayPathForEntry, excludePatterns);

                if (isPotentiallyExcluded) {
                    // Now, check if it ALSO matches an include pattern.
                    // If it's included, we should NOT prune it, even if it matches an exclude.
                    // The final include/exclude check later will handle the precedence correctly.
                    const isAlsoExplicitlyIncluded = this.isMatch(dirent.name, entryPath, displayPathForEntry, includePatterns);

                    if (!isAlsoExplicitlyIncluded) {
                        // Only prune if it's excluded AND NOT explicitly included.
                        shouldPrune = true;
                    }
                    // If isPotentiallyExcluded is true BUT isAlsoExplicitlyIncluded is true,
                    // we let it proceed. The standard filtering logic below will apply.
                }
            }

            if (shouldPrune) {
                continue; // Skip this directory entirely
            }
            // --- END Pruning Check ---


             // --- Type Check ---
             let typeMatches = true;
             if (matchType) {
                 if (matchType === 'f' && !isFile) typeMatches = false;
                 if (matchType === 'd' && !isDirectory) typeMatches = false;
             }

             // --- Include/Exclude Pattern Check ---
             // These checks run for files and non-pruned directories
             // Use displayPathForEntry for the relative check here
             const isIncluded = this.isMatch(dirent.name, entryPath, displayPathForEntry, includePatterns);
             const isExcluded = this.isMatch(dirent.name, entryPath, displayPathForEntry, excludePatterns);

             // --- Print ---
             // Check against maxDepth BEFORE printing the item at currentDepth + 1 effectively
             // The item's *own* depth is `currentDepth + 1` relative to the *initial* start
             // Ensure we don't print beyond the requested maxDepth.
             if (currentDepth + 1 <= maxDepth && typeMatches && isIncluded && !isExcluded) {
                 console.log(displayPathForEntry);
             }

             // --- Recurse ---
             // Recurse into subdirectories if they are directories and within maxDepth limit for the *next* level
             // Note: the check `currentDepth >= maxDepth` at the start of the loop handles the overall boundary.
             if (isDirectory) {
                 // Recursion happens for the *next* level (currentDepth + 1)
                 await this.traverse(entryPath, currentDepth + 1);
             }
        }
    } // End of traverse method


    // Helper to check match against name, full path, and relative path
    private isMatch(
        name: string,
        fullPath: string,
        relativePath: string, // Can be '.' for the starting directory check
        patterns: string[]
    ): boolean {
        // Avoid matching empty patterns array
        if (!patterns || patterns.length === 0) {
            return false;
        }
        return micromatch.isMatch(name, patterns, this.micromatchOptions) ||
               micromatch.isMatch(fullPath, patterns, this.micromatchOptions) ||
               // Only check relative path if the option is enabled AND the relative path is valid
               (this.options.relativePaths && relativePath && micromatch.isMatch(relativePath, patterns, this.micromatchOptions));
    }
} // End of class
// src/traverser.ts
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';
import type { Dirent } from 'fs';

// Define an interface for the options for better type safety
export interface TraverseOptions {
    excludePatterns: string[];
    includePatterns: string[];
    matchType: 'f' | 'd' | null;
    maxDepth: number;
    ignoreCase: boolean;
    relativePaths: boolean;
    // basePath removed from options, passed to constructor
}

interface MicromatchOptions {
    nocase: boolean;
    dot: boolean; // Ensure dotfiles are matched by patterns unless explicitly excluded
}

export class DirectoryTraverser {
    private options: TraverseOptions;
    private basePath: string; // Store the base path for relative calculations
    private micromatchOptions: MicromatchOptions;

    constructor(options: TraverseOptions, basePath: string) {
        this.options = options;
        // Ensure basePath is absolute and normalized for consistent results
        this.basePath = path.resolve(basePath);
        this.micromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true // Crucial for matching hidden files/dirs like .git with patterns like .* or .git/**
        };
         // console.log("Traverser Initialized With:", { options: this.options, basePath: this.basePath }); // Debug log
    }

    // Helper to check match against name, full path, and relative path
    private isMatch(
        name: string, // Just the file/directory name (e.g., 'index.js', 'node_modules')
        fullPath: string, // Absolute path (e.g., '/path/to/project/node_modules')
        relativePath: string, // Path relative to basePath (e.g., 'node_modules', '.')
        patterns: string[]
    ): boolean {
        // Avoid matching empty patterns array
        if (!patterns || patterns.length === 0) {
            return false;
        }

        // Ensure relativePath is handled correctly if it's '.'
        const effectiveRelativePath = relativePath === '.' ? '.' : relativePath;

        // console.log(`isMatch Check: Name=${name}, Full=${fullPath}, Rel=${effectiveRelativePath}, Patterns=${JSON.stringify(patterns)}`); // Debug Log

        // Check name first (common case for simple excludes like 'node_modules')
        if (micromatch.isMatch(name, patterns, this.micromatchOptions)) {
             // console.log(`  Match on Name: ${name}`);
            return true;
        }
        // Check full path (for absolute patterns or more complex globs)
        if (micromatch.isMatch(fullPath, patterns, this.micromatchOptions)) {
            // console.log(`  Match on Full Path: ${fullPath}`);
            return true;
        }
        // Check relative path ONLY if relativePaths option is true AND relative path is meaningful
        if (this.options.relativePaths && effectiveRelativePath && micromatch.isMatch(effectiveRelativePath, patterns, this.micromatchOptions)) {
            // console.log(`  Match on Relative Path: ${effectiveRelativePath}`);
            return true;
        }

        return false;
    }


    public async traverse(dirPath: string, currentDepth: number = 0): Promise<void> {
        const {
            excludePatterns,
            includePatterns,
            matchType,
            maxDepth,
            relativePaths
        } = this.options;

        // --- 1. Handle Starting Directory (Depth 0) ---
        if (currentDepth === 0) {
            const isDirTypeMatch = !matchType || matchType === 'd'; // Starting point is always treated as a directory for type matching
            const dirName = path.basename(dirPath);
            // Pass '.' as relative path for matching logic if relativePaths is true
            const relativePathForMatch = relativePaths ? '.' : '';
            const displayPath = relativePaths ? '.' : dirPath;

            // console.log(`Start Dir Check: Name=${dirName}, Full=${dirPath}, RelMatch=${relativePathForMatch}, Display=${displayPath}`); // Debug

            const isIncluded = this.isMatch(dirName, dirPath, relativePathForMatch, includePatterns);
            const isExcluded = this.isMatch(dirName, dirPath, relativePathForMatch, excludePatterns);

            // console.log(`  Start Dir Included=${isIncluded}, Excluded=${isExcluded}, TypeMatch=${isDirTypeMatch}`); // Debug

            if (isDirTypeMatch && isIncluded && !isExcluded) {
                 // console.log(`  Printing Start Dir: ${displayPath}`); // Debug
                 console.log(displayPath);
            }
            // If maxDepth is 0, we stop after checking the starting directory.
            // The check below handles this.
        }

        // --- 2. Depth Check ---
        // Stop recursing further if we have reached the maximum depth.
        // >= is used because currentDepth 0 is handled above. We stop *before* reading entries
        // if the *current* directory is already at the maxDepth limit.
        if (currentDepth >= maxDepth) {
             // console.log(`Max depth ${maxDepth} reached at depth ${currentDepth}. Stopping recursion for ${dirPath}`); // Debug
             return;
         }

        // --- 3. Read Directory Entries ---
        let entries: Dirent[];
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch (err: any) {
            // Log errors but continue if possible (e.g., skip unreadable directories)
            if (err.code === 'EACCES' || err.code === 'EPERM') {
                console.error(`Permission error reading directory ${dirPath}: ${err.message}`);
            } else {
                 console.error(`Error reading directory ${dirPath}: ${err.message}`);
            }
             return; // Stop processing this specific path on error
        }

        // --- 4. Process Entries ---
        for (const dirent of entries) {
            const entryPath = path.join(dirPath, dirent.name);
            // Use the stored absolute this.basePath for consistent relative calculation
            const displayPathForEntry = relativePaths ? path.relative(this.basePath, entryPath).replace(/\\/g, '/') : entryPath; // Use forward slash for consistency
            // Ensure '.' is used if path.relative returns empty string (shouldn't happen for entries unless entryPath === basePath)
            const relativePathForMatch = relativePaths ? displayPathForEntry || '.' : '';

            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();

            // console.log(`\nProcessing Entry: Name=${dirent.name}, Full=${entryPath}, RelMatch=${relativePathForMatch}, Display=${displayPathForEntry}, Depth=${currentDepth + 1}, isDir=${isDirectory}`); // Debug

            // --- 4a. Pruning Check (Enhanced) ---
            let shouldPrune = false;
            if (isDirectory) {
                // Check if the directory itself matches an exclude pattern
                const isPotentiallyExcluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, excludePatterns);

                if (isPotentiallyExcluded) {
                    // Now, check if it ALSO matches an include pattern.
                    // If it's explicitly included, we DO NOT prune it here.
                    // The final include/exclude filter below will determine if it's *printed*.
                    const isAlsoExplicitlyIncluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, includePatterns);

                    if (!isAlsoExplicitlyIncluded) {
                        // Only prune if it's excluded AND NOT explicitly included.
                         // console.log(`  Pruning directory: ${displayPathForEntry} (Excluded and not explicitly included)`); // Debug
                        shouldPrune = true;
                    } else {
                         // console.log(`  Directory not pruned: ${displayPathForEntry} (Excluded but also explicitly included)`); // Debug
                    }
                }
            }

            if (shouldPrune) {
                continue; // Skip this directory entirely (don't print, don't recurse)
            }

            // --- 4b. Filtering Logic (for non-pruned items) ---
            // Type Check
            let typeMatches = true;
            if (matchType) {
                if (matchType === 'f' && !isFile) typeMatches = false;
                if (matchType === 'd' && !isDirectory) typeMatches = false;
            }

            // Include/Exclude Check (run again even for non-pruned dirs to see if the dir *itself* should be printed)
            const isIncluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, includePatterns);
            const isExcluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, excludePatterns);

            // console.log(`  Filter Check: Included=${isIncluded}, Excluded=${isExcluded}, TypeMatch=${typeMatches}`); // Debug

            // --- 4c. Print ---
            // Check item's effective depth (currentDepth + 1) against maxDepth
            if (currentDepth + 1 <= maxDepth && typeMatches && isIncluded && !isExcluded) {
                 // console.log(`  Printing Entry: ${displayPathForEntry}`); // Debug
                 console.log(displayPathForEntry);
            }

            // --- 4d. Recurse ---
            // Recurse into subdirectories if it's a directory.
            // The depth check at the *start* of the *next* traverse call handles the maxDepth boundary.
            if (isDirectory) {
                await this.traverse(entryPath, currentDepth + 1);
            }
        }
    } // End of traverse method

} // End of class
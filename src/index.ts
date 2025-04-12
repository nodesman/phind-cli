// src/index.ts
import fs from 'fs/promises'; // Use promise-based fs
import path from 'path';
import micromatch from 'micromatch';
import type { Dirent } from 'fs'; // Import Dirent type

// Define an interface for the options for better type safety
interface TraverseOptions {
    excludePatterns: string[];
    includePatterns: string[];
    matchType: 'f' | 'd' | null; // Specific allowed types
    maxDepth: number;
    ignoreCase: boolean;
    relativePaths: boolean;
    basePath: string; // Keep track of the original starting path
}

interface MicromatchOptions {
    nocase: boolean;
    dot: boolean;
}

export async function traverseDirectory(
    dirPath: string,
    options: TraverseOptions,
    currentDepth: number = 0
): Promise<void> {
    const {
        excludePatterns,
        includePatterns,
        matchType,
        maxDepth,
        ignoreCase,
        relativePaths,
        basePath
    } = options;

    // Stop if we've exceeded max depth (check before reading directory)
    if (currentDepth > maxDepth) {
        return;
    }

    let entries: Dirent[];
    try {
        // Use withFileTypes for efficiency
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err: any) { // Catch potential errors
        // Log permission errors etc. to stderr, but continue if possible
        // Avoid crashing on inaccessible directories
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            console.error(`Permission error reading directory ${dirPath}: ${err.message}`);
        } else {
             console.error(`Error reading directory ${dirPath}: ${err.message}`);
        }
        return; // Stop processing this directory on error
    }

    const micromatchOptions: MicromatchOptions = { nocase: ignoreCase, dot: true };

    for (const dirent of entries) {
        const entryPath = path.join(dirPath, dirent.name);
        // Calculate relative path *before* potential pruning/filtering
        const displayPath = relativePaths ? path.relative(basePath, entryPath) || '.' : entryPath;

        const isDirectory = dirent.isDirectory();
        const isFile = dirent.isFile();

        // --- Pruning Check (for directories only) ---
        let isExcludedByPrune = false;
        if (isDirectory) {
            // Match against dir name or full path for exclusion pruning
            const isExcludedDir = micromatch.isMatch(dirent.name, excludePatterns, micromatchOptions) ||
                                  micromatch.isMatch(entryPath, excludePatterns, micromatchOptions) ||
                                  (relativePaths && micromatch.isMatch(displayPath, excludePatterns, micromatchOptions));

            if (isExcludedDir) {
                isExcludedByPrune = true;
                // console.log(`Pruning excluded directory: ${entryPath}`); // Debug log
            }
        }

        // If pruned, skip printing this entry AND recursion
        if (isExcludedByPrune) {
            continue;
        }

        // --- Type Check ---
        let typeMatches = true;
        if (matchType) {
            if (matchType === 'f' && !isFile) typeMatches = false;
            if (matchType === 'd' && !isDirectory) typeMatches = false;
        }

        // --- Include/Exclude Pattern Check (for items not pruned) ---
        const isIncluded = micromatch.isMatch(dirent.name, includePatterns, micromatchOptions) ||
                           micromatch.isMatch(entryPath, includePatterns, micromatchOptions) ||
                           (relativePaths && micromatch.isMatch(displayPath, includePatterns, micromatchOptions));

        const isExcluded = micromatch.isMatch(dirent.name, excludePatterns, micromatchOptions) ||
                           micromatch.isMatch(entryPath, excludePatterns, micromatchOptions) ||
                           (relativePaths && micromatch.isMatch(displayPath, excludePatterns, micromatchOptions));


        // --- Print if matches all criteria ---
        // Check depth condition *before* printing
        if (currentDepth <= maxDepth && typeMatches && isIncluded && !isExcluded) {
             console.log(displayPath);
        }

        // --- Recurse ---
        // Only recurse if it's a directory and we haven't hit max depth yet
        if (isDirectory && currentDepth < maxDepth) {
            await traverseDirectory(entryPath, options, currentDepth + 1);
        }
    }
}
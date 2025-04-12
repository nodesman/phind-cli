// src/traverser.ts
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';
import type { Dirent } from 'fs';

// Options interface remains the same from Attempt 5
export interface TraverseOptions {
    excludePatterns: string[]; // Combined effective list
    includePatterns: string[];
    matchType: 'f' | 'd' | null;
    maxDepth: number;
    ignoreCase: boolean;
    relativePaths: boolean;
    defaultExcludes: string[]; // The hardcoded defaults
}

interface InternalMicromatchOptions {
    nocase: boolean;
    dot: boolean;
    // `matchBase` might be useful for patterns without slashes like 'node_modules'
    // but let's rely on testing name, relative, and absolute paths explicitly.
}

export class DirectoryTraverser {
    private options: TraverseOptions;
    private basePath: string;
    private baseMicromatchOptions: InternalMicromatchOptions;
    private defaultExcludes: Set<string>; // Use a Set for quick lookup
    private nonDefaultIncludePatterns: string[]; // Includes other than '*'

    constructor(options: TraverseOptions, basePath: string) {
        this.options = options;
        this.basePath = path.resolve(basePath);
        this.baseMicromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true // Essential for matching '.git' etc.
        };
        this.defaultExcludes = new Set(options.defaultExcludes);

        // Pre-calculate include patterns that are not the default '*'
        this.nonDefaultIncludePatterns = options.includePatterns.filter(p => p !== '*');
    }

    /**
     * Simple check if an item matches any pattern in a list.
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
        const absPathNormalized = path.normalize(fullPath).replace(/\\/g, '/');
        const relPathNormalized = relativePath === '.' ? '.' : path.normalize(relativePath).replace(/\\/g, '/');
        const testPaths = [name, absPathNormalized];
        if (this.options.relativePaths && relPathNormalized) {
            testPaths.push(relPathNormalized);
        }
        return micromatch.some(testPaths, patterns, this.baseMicromatchOptions);
    }

    /**
     * Checks if a directory should be pruned.
     * Prune if excluded UNLESS explicitly included by a non-'*' pattern.
     */
    private shouldPrune(
        name: string,
        fullPath: string,
        relativePath: string
    ): boolean {
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return false; // Not excluded, don't prune
        }

        // It's excluded, check if an *explicit* include pattern saves it
        // We use `nonDefaultIncludePatterns` to avoid '*' preventing pruning.
        // We also need to check patterns like dir/** or dir/ matching dir
        const explicitIncludePatterns = this.nonDefaultIncludePatterns.map(p => {
            if (p.endsWith('/**')) return p.substring(0, p.length - 3);
            if (p.endsWith('/')) return p.substring(0, p.length - 1);
            return p; // Keep the original explicit pattern too
        });
        // Add the original non-default patterns back in case they were simple names like '.git'
        explicitIncludePatterns.push(...this.nonDefaultIncludePatterns);
        const uniqueExplicitIncludes = [...new Set(explicitIncludePatterns)];


        const isExplicitlyIncluded = this.matchesAnyPattern(name, fullPath, relativePath, uniqueExplicitIncludes);

        // Prune if excluded AND NOT explicitly included by a non-'*' pattern
        return isExcluded && !isExplicitlyIncluded;
    }

    /**
     * Checks if an item should be printed based on all filters.
     */
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

        // 2. Include Check
        const isIncluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.includePatterns);
        if (!isIncluded) {
            return false; // Must be included
        }

        // 3. Exclude Check (with override logic)
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return true; // Included and not excluded - PRINT
        }

        // --- It IS excluded, check if it's ONLY by default AND was included explicitly ---
        const isExcludedByDefault = this.matchesAnyPattern(name, fullPath, relativePath, Array.from(this.defaultExcludes));

        if (isExcludedByDefault) {
            // Check if an explicit (non-'*') include pattern matches
            const explicitIncludePatterns = this.nonDefaultIncludePatterns.map(p => {
                if (p.endsWith('/**')) return p.substring(0, p.length - 3);
                if (p.endsWith('/')) return p.substring(0, p.length - 1);
                return p;
            });
            explicitIncludePatterns.push(...this.nonDefaultIncludePatterns);
            const uniqueExplicitIncludes = [...new Set(explicitIncludePatterns)];

            const isExplicitlyIncluded = this.matchesAnyPattern(name, fullPath, relativePath, uniqueExplicitIncludes);

            if (isExplicitlyIncluded) {
                 // console.log(`Printing ${name} despite default exclude due to explicit include override.`);
                 return true; // Excluded only by default, but explicitly included - PRINT (Override works)
            }
        }

        // --- If we reach here: It's excluded, and either not by default, or not explicitly included to override ---
        return false; // Excluded - DO NOT PRINT
    }

    public async traverse(dirPath: string, currentDepth: number = 0): Promise<void> {
        const { maxDepth, relativePaths } = this.options;

        // --- 1. Handle Starting Directory (Depth 0) ---
        if (currentDepth === 0) {
            const dirName = path.basename(dirPath);
            const relativePathForMatch = relativePaths ? '.' : '';
            const displayPath = relativePaths ? '.' : dirPath;
            if (this.shouldPrintItem(dirName, dirPath, relativePathForMatch, true, false)) {
                 console.log(displayPath);
            }
        }

        // --- 2. Depth Check ---
        if (currentDepth >= maxDepth) return;

        // --- 3. Read Directory Entries ---
        let entries: Dirent[];
        try { entries = await fs.readdir(dirPath, { withFileTypes: true }); }
        catch (err: any) { return; } // Fail silently

        // --- 4. Process Entries ---
        for (const dirent of entries) {
            const entryName = dirent.name;
            const entryFullPath = path.join(dirPath, entryName);
            const entryRelativePath = relativePaths ? path.relative(this.basePath, entryFullPath).replace(/\\/g, '/') || entryName : '';
            const displayPath = relativePaths ? entryRelativePath : entryFullPath;
            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();

            // --- 4a. Pruning Check ---
            if (isDirectory && this.shouldPrune(entryName, entryFullPath, entryRelativePath)) {
                 // console.log(`Pruning: ${displayPath}`);
                 continue;
            }

            // --- 4b. Filtering & Printing ---
            // Check depth of the *item* itself
            if (currentDepth + 1 <= maxDepth) {
                if (this.shouldPrintItem(entryName, entryFullPath, entryRelativePath, isDirectory, isFile)) {
                    console.log(displayPath);
                }
            }

            // --- 4c. Recurse ---
            if (isDirectory) {
                await this.traverse(entryFullPath, currentDepth + 1);
            }
        }
    } // End traverse
} // End class
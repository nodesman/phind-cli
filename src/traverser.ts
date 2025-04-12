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
            relativePaths,
            // basePath
        } = this.options;

        if (currentDepth > maxDepth) {
            return;
        }

        let entries: Dirent[];
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch (err: any) {
            if (err.code === 'EACCES' || err.code === 'EPERM') {
                console.error(`Permission error reading directory ${dirPath}: ${err.message}`);
            } else {
                 console.error(`Error reading directory ${dirPath}: ${err.message}`);
            }
            return;
        }

        for (const dirent of entries) {
            const entryPath = path.join(dirPath, dirent.name);
            const displayPath = relativePaths ? path.relative(this.basePath, entryPath) || '.' : entryPath;

            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();

            // --- Pruning Check ---
            let isExcludedByPrune = false;
            if (isDirectory && this.isMatch(dirent.name, entryPath, displayPath, excludePatterns)) {
                 isExcludedByPrune = true;
            }

            if (isExcludedByPrune) {
                continue;
            }

            // --- Type Check ---
            let typeMatches = true;
            if (matchType) {
                if (matchType === 'f' && !isFile) typeMatches = false;
                if (matchType === 'd' && !isDirectory) typeMatches = false;
            }

            // --- Include/Exclude Pattern Check ---
            const isIncluded = this.isMatch(dirent.name, entryPath, displayPath, includePatterns);
            // Check exclusion again for files or non-pruned directories
            const isExcluded = this.isMatch(dirent.name, entryPath, displayPath, excludePatterns);


            // --- Print ---
            if (currentDepth <= maxDepth && typeMatches && isIncluded && !isExcluded) {
                 console.log(displayPath);
            }

            // --- Recurse ---
            if (isDirectory && currentDepth < maxDepth) {
                // Crucially, pass the same options object down
                await this.traverse(entryPath, currentDepth + 1);
            }
        }
    }

    // Helper to check match against name, full path, and relative path
    private isMatch(
        name: string,
        fullPath: string,
        relativePath: string,
        patterns: string[]
    ): boolean {
        // Avoid matching empty patterns array
        if (!patterns || patterns.length === 0) {
            return false;
        }
        return micromatch.isMatch(name, patterns, this.micromatchOptions) ||
               micromatch.isMatch(fullPath, patterns, this.micromatchOptions) ||
               (this.options.relativePaths && micromatch.isMatch(relativePath, patterns, this.micromatchOptions));
    }
}
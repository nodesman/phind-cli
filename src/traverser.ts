// src/traverser.ts
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';
import type { Dirent } from 'fs';

// Define an interface for the options for better type safety
export interface TraverseOptions {
    excludePatterns: string[]; // This should be the *effective* list (default+global+cli)
    includePatterns: string[];
    matchType: 'f' | 'd' | null;
    maxDepth: number;
    ignoreCase: boolean;
    relativePaths: boolean;
    // Add default excludes separately for override logic
    defaultExcludes: string[]; // Pass the hardcoded defaults here
}

interface InternalMicromatchOptions {
    nocase: boolean;
    dot: boolean;
}

export class DirectoryTraverser {
    private options: TraverseOptions;
    private basePath: string;
    private baseMicromatchOptions: InternalMicromatchOptions;
    // Store default excludes separately
    private defaultExcludes: string[];

    constructor(options: TraverseOptions, basePath: string) {
        this.options = options;
        this.basePath = path.resolve(basePath);
        this.baseMicromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true
        };
        // Store the defaults passed via options
        this.defaultExcludes = options.defaultExcludes;
        // console.log("Traverser Initialized With:", { options: JSON.stringify(this.options), basePath: this.basePath });
    }

     /**
      * Checks if a given item matches patterns.
      * For directory includes, also checks patterns like 'dir/**'.
      */
     private isMatch(
         name: string,
         fullPath: string,
         relativePath: string,
         patterns: string[],
         isDirContext: boolean, // Is this check for a directory?
         isIncludeCheck: boolean // Is this checking includePatterns?
     ): boolean {
         if (!patterns || patterns.length === 0) {
             return false; // No patterns, no match
         }

         const absPathNormalized = path.normalize(fullPath).replace(/\\/g, '/');
         const relPathNormalized = relativePath === '.' ? '.' : path.normalize(relativePath).replace(/\\/g, '/');

         const testPaths = [
             name, // Match base name 'node_modules'
             absPathNormalized, // Match full path '/path/to/node_modules'
             // Only test relative path if option enabled AND path exists
             (this.options.relativePaths && relPathNormalized) ? relPathNormalized : undefined
         ].filter(p => typeof p === 'string') as string[];

         // Create options instance for this specific check (nocase might differ)
         const currentMicromatchOptions: InternalMicromatchOptions = {
             nocase: this.options.ignoreCase,
             dot: true
         };

         // console.log(`isMatch Internal: Testing ${JSON.stringify(testPaths)} against ${JSON.stringify(patterns)}`);

         if (micromatch.some(testPaths, patterns, currentMicromatchOptions)) {
             // console.log(`  -> Standard match SUCCESS`);
             return true;
         }

         // Special check for directory includes like 'node_modules/**' matching 'node_modules'
         // If checking includes for a directory, see if patterns like 'dir/**' or 'dir/' match 'dir'
         if (isDirContext && isIncludeCheck) {
             const dirMatchPatterns = patterns
                 .map(p => {
                     // Convert 'dir/**' to 'dir' for matching the directory itself
                     if (p.endsWith('/**')) return p.substring(0, p.length - 3);
                     // Convert 'dir/' to 'dir'
                     if (p.endsWith('/')) return p.substring(0, p.length - 1);
                     return null; // Don't derive other patterns
                 })
                 .filter(p => p !== null) as string[]; // Filter out non-derived patterns

             if (dirMatchPatterns.length > 0 && micromatch.some(testPaths, dirMatchPatterns, currentMicromatchOptions)) {
                 // console.log(`  -> Directory include match SUCCESS on derived patterns: ${dirMatchPatterns.join(',')}`);
                 return true;
             }
         }

         return false;
     }


    public async traverse(dirPath: string, currentDepth: number = 0): Promise<void> {
        const {
            excludePatterns, // Effective excludes (default+global+cli)
            includePatterns,
            matchType,
            maxDepth,
            relativePaths
        } = this.options;

        // --- 1. Handle Starting Directory (Depth 0) ---
        if (currentDepth === 0) {
            const isDirTypeMatch = !matchType || matchType === 'd';
            const dirName = path.basename(dirPath);
            const relativePathForMatch = relativePaths ? '.' : '';
            const displayPath = relativePaths ? '.' : dirPath;

            const isIncluded = this.isMatch(dirName, dirPath, relativePathForMatch, includePatterns, true, true);
            // Check against effective excludes first
            const isExcluded = this.isMatch(dirName, dirPath, relativePathForMatch, excludePatterns, true, false);
             // Separately check if excluded by a default pattern
            const isExcludedByDefault = this.isMatch(dirName, dirPath, relativePathForMatch, this.defaultExcludes, true, false);

            // Print if (Included AND NOT Excluded) OR (Included AND Excluded *only* by Default)
            const shouldPrint = isIncluded && (!isExcluded || (isExcluded && isExcludedByDefault));

             // console.log(`Start Dir: Display=${displayPath} Included=${isIncluded}, Excluded=${isExcluded}, ExcludedByDefault=${isExcludedByDefault}, TypeMatch=${isDirTypeMatch} -> ShouldPrint=${shouldPrint}`);

            if (isDirTypeMatch && shouldPrint) {
                 // console.log(`  Printing Start Dir: ${displayPath}`);
                 console.log(displayPath);
            }
        }

        // --- 2. Depth Check ---
        if (currentDepth >= maxDepth) return;

        // --- 3. Read Directory Entries ---
        let entries: Dirent[];
        try { entries = await fs.readdir(dirPath, { withFileTypes: true }); }
        catch (err: any) { return; } // Fail silently on errors

        // --- 4. Process Entries ---
        for (const dirent of entries) {
            const entryName = dirent.name;
            const entryFullPath = path.join(dirPath, entryName);
            const entryRelativePath = relativePaths ? path.relative(this.basePath, entryFullPath).replace(/\\/g, '/') || entryName : '';
            const displayPath = relativePaths ? entryRelativePath : entryFullPath;
            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();

            // --- 4a. Pruning Check (Includes override Excludes for Pruning) ---
            if (isDirectory) {
                // Check if it matches an exclude pattern
                const isPotentiallyExcluded = this.isMatch(entryName, entryFullPath, entryRelativePath, excludePatterns, true, false);

                if (isPotentiallyExcluded) {
                    // If excluded, check if it's ALSO explicitly included
                     const isExplicitlyIncluded = this.isMatch(entryName, entryFullPath, entryRelativePath, includePatterns, true, true);
                     if (!isExplicitlyIncluded) {
                        // console.log(`  Pruning directory: ${displayPath} (Excluded and not explicitly included)`);
                        continue; // PRUNE: It's excluded and NOT explicitly included
                     } else {
                         // console.log(`  Directory not pruned: ${displayPath} (Excluded but also explicitly included)`);
                     }
                }
            }
            // --- End Pruning Check ---


            // --- 4b. Filtering Logic (for items NOT pruned) ---
            let typeMatches = true; // Type Check
            if (matchType) {
                if (matchType === 'f' && !isFile) typeMatches = false;
                if (matchType === 'd' && !isDirectory) typeMatches = false;
            }

            // Check inclusion
            const isIncluded = this.isMatch(entryName, entryFullPath, entryRelativePath, includePatterns, isDirectory, true);

            // Check exclusion (against all effective excludes)
            const isExcluded = this.isMatch(entryName, entryFullPath, entryRelativePath, excludePatterns, isDirectory, false);

            // Check if exclusion is specifically due to a default pattern
            const isExcludedByDefault = this.isMatch(entryName, entryFullPath, entryRelativePath, this.defaultExcludes, isDirectory, false);

            // Determine if the item should be printed based on the logic:
            // Print if:
            // 1. Type matches AND
            // 2. It's included AND
            // 3. (It's NOT excluded OR (it IS excluded BUT only by a default pattern, thus overridden by include))
            const shouldPrint = typeMatches && isIncluded && (!isExcluded || (isExcluded && isExcludedByDefault));

            // console.log(`Filter Check: Entry=${displayPath} Included=${isIncluded}, Excluded=${isExcluded}, ExcludedByDefault=${isExcludedByDefault}, TypeMatch=${typeMatches} -> ShouldPrint=${shouldPrint}`);


            // --- 4c. Print ---
            if (currentDepth + 1 <= maxDepth && shouldPrint) {
                 // console.log(`  Printing Entry: ${displayPath}`);
                 console.log(displayPath);
            }

            // --- 4d. Recurse ---
            if (isDirectory) { // Recurse if it's a directory (pruned directories were skipped)
                await this.traverse(entryFullPath, currentDepth + 1);
            }
        }
    } // End traverse
} // End class
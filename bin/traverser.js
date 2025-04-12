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
        // Store the defaults passed via options
        this.defaultExcludes = options.defaultExcludes;
        // console.log("Traverser Initialized With:", { options: JSON.stringify(this.options), basePath: this.basePath });
    }
    /**
     * Checks if a given item matches patterns.
     * For directory includes, also checks patterns like 'dir/**'.
     */
    isMatch(name, fullPath, relativePath, patterns, isDirContext, // Is this check for a directory?
    isIncludeCheck // Is this checking includePatterns?
    ) {
        if (!patterns || patterns.length === 0) {
            return false; // No patterns, no match
        }
        const absPathNormalized = path_1.default.normalize(fullPath).replace(/\\/g, '/');
        const relPathNormalized = relativePath === '.' ? '.' : path_1.default.normalize(relativePath).replace(/\\/g, '/');
        const testPaths = [
            name, // Match base name 'node_modules'
            absPathNormalized, // Match full path '/path/to/node_modules'
            // Only test relative path if option enabled AND path exists
            (this.options.relativePaths && relPathNormalized) ? relPathNormalized : undefined
        ].filter(p => typeof p === 'string');
        // Create options instance for this specific check (nocase might differ)
        const currentMicromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true
        };
        // console.log(`isMatch Internal: Testing ${JSON.stringify(testPaths)} against ${JSON.stringify(patterns)}`);
        if (micromatch_1.default.some(testPaths, patterns, currentMicromatchOptions)) {
            // console.log(`  -> Standard match SUCCESS`);
            return true;
        }
        // Special check for directory includes like 'node_modules/**' matching 'node_modules'
        // If checking includes for a directory, see if patterns like 'dir/**' or 'dir/' match 'dir'
        if (isDirContext && isIncludeCheck) {
            const dirMatchPatterns = patterns
                .map(p => {
                // Convert 'dir/**' to 'dir' for matching the directory itself
                if (p.endsWith('/**'))
                    return p.substring(0, p.length - 3);
                // Convert 'dir/' to 'dir'
                if (p.endsWith('/'))
                    return p.substring(0, p.length - 1);
                return null; // Don't derive other patterns
            })
                .filter(p => p !== null); // Filter out non-derived patterns
            if (dirMatchPatterns.length > 0 && micromatch_1.default.some(testPaths, dirMatchPatterns, currentMicromatchOptions)) {
                // console.log(`  -> Directory include match SUCCESS on derived patterns: ${dirMatchPatterns.join(',')}`);
                return true;
            }
        }
        return false;
    }
    traverse(dirPath_1) {
        return __awaiter(this, arguments, void 0, function* (dirPath, currentDepth = 0) {
            const { excludePatterns, // Effective excludes (default+global+cli)
            includePatterns, matchType, maxDepth, relativePaths } = this.options;
            // --- 1. Handle Starting Directory (Depth 0) ---
            if (currentDepth === 0) {
                const isDirTypeMatch = !matchType || matchType === 'd';
                const dirName = path_1.default.basename(dirPath);
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
            if (currentDepth >= maxDepth)
                return;
            // --- 3. Read Directory Entries ---
            let entries;
            try {
                entries = yield promises_1.default.readdir(dirPath, { withFileTypes: true });
            }
            catch (err) {
                return;
            } // Fail silently on errors
            // --- 4. Process Entries ---
            for (const dirent of entries) {
                const entryName = dirent.name;
                const entryFullPath = path_1.default.join(dirPath, entryName);
                const entryRelativePath = relativePaths ? path_1.default.relative(this.basePath, entryFullPath).replace(/\\/g, '/') || entryName : '';
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
                        }
                        else {
                            // console.log(`  Directory not pruned: ${displayPath} (Excluded but also explicitly included)`);
                        }
                    }
                }
                // --- End Pruning Check ---
                // --- 4b. Filtering Logic (for items NOT pruned) ---
                let typeMatches = true; // Type Check
                if (matchType) {
                    if (matchType === 'f' && !isFile)
                        typeMatches = false;
                    if (matchType === 'd' && !isDirectory)
                        typeMatches = false;
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
                    yield this.traverse(entryFullPath, currentDepth + 1);
                }
            }
        });
    } // End traverse
} // End class
exports.DirectoryTraverser = DirectoryTraverser;
//# sourceMappingURL=traverser.js.map
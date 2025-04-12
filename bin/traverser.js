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
        // Ensure basePath is absolute and normalized for consistent results
        this.basePath = path_1.default.resolve(basePath);
        this.micromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true // Crucial for matching hidden files/dirs like .git with patterns like .* or .git/**
        };
        // console.log("Traverser Initialized With:", { options: JSON.stringify(this.options), basePath: this.basePath, micromatchOptions: this.micromatchOptions }); // Debug log
    }
    // Helper to check match against name, full path, and relative path
    isMatch(name, fullPath, relativePath, // Path relative to basePath (e.g., 'node_modules', '.', 'dir1/file.txt')
    patterns) {
        if (!patterns || patterns.length === 0) {
            return false;
        }
        const effectiveRelativePath = relativePath === '.' ? '.' : relativePath.replace(/\\/g, '/'); // Normalize slashes for matching
        // Use local options based on traversal settings for this check
        const currentMicromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true,
            // Optimization: If not using relative paths, don't need basename/partial match
            // basename: !this.options.relativePaths,
            // partial: !this.options.relativePaths
        };
        // console.log(`isMatch Check: Name=${name}, Full=${fullPath}, Rel=${effectiveRelativePath}, Patterns=${JSON.stringify(patterns)}, Options=${JSON.stringify(currentMicromatchOptions)}`); // Debug Log
        // Check 1: Base name match (e.g., '*.log', 'node_modules')
        if (micromatch_1.default.isMatch(name, patterns, currentMicromatchOptions)) {
            // console.log(`  Match on Name: ${name}`);
            return true;
        }
        // Check 2: Full absolute path match (e.g., '/abs/path/to/exclude')
        if (micromatch_1.default.isMatch(fullPath, patterns, currentMicromatchOptions)) {
            // console.log(`  Match on Full Path: ${fullPath}`);
            return true;
        }
        // Check 3: Relative path match (e.g., 'src/*.ts', 'build/output.log')
        // Only perform this check if relative paths are enabled AND the path is meaningful
        if (this.options.relativePaths && effectiveRelativePath && micromatch_1.default.isMatch(effectiveRelativePath, patterns, currentMicromatchOptions)) {
            // console.log(`  Match on Relative Path: ${effectiveRelativePath}`);
            return true;
        }
        return false;
    }
    traverse(dirPath_1) {
        return __awaiter(this, arguments, void 0, function* (dirPath, currentDepth = 0) {
            const { excludePatterns, includePatterns, matchType, maxDepth, relativePaths } = this.options;
            // --- 1. Handle Starting Directory (Depth 0) ---
            if (currentDepth === 0) {
                const isDirTypeMatch = !matchType || matchType === 'd';
                const dirName = path_1.default.basename(dirPath);
                const relativePathForMatch = relativePaths ? '.' : ''; // Use '.' for relative check
                const displayPath = relativePaths ? '.' : dirPath;
                // console.log(`Start Dir Check: Name=${dirName}, Full=${dirPath}, RelMatch=${relativePathForMatch}, Display=${displayPath}, Depth=${currentDepth}`); // Debug
                const isIncluded = this.isMatch(dirName, dirPath, relativePathForMatch, includePatterns);
                const isExcluded = this.isMatch(dirName, dirPath, relativePathForMatch, excludePatterns);
                // console.log(`  Start Dir Included=${isIncluded}, Excluded=${isExcluded}, TypeMatch=${isDirTypeMatch}`); // Debug
                if (isDirTypeMatch && isIncluded && !isExcluded) {
                    // console.log(`  Printing Start Dir: ${displayPath}`); // Debug
                    console.log(displayPath);
                }
            }
            // --- 2. Depth Check ---
            if (currentDepth >= maxDepth) {
                // console.log(`Max depth ${maxDepth} reached at depth ${currentDepth}. Stopping recursion for ${dirPath}`); // Debug
                return;
            }
            // --- 3. Read Directory Entries ---
            let entries;
            try {
                entries = yield promises_1.default.readdir(dirPath, { withFileTypes: true });
            }
            catch (err) {
                if (err.code === 'EACCES' || err.code === 'EPERM') {
                    // console.error(`Permission error reading directory ${dirPath}: ${err.message}`); // Keep error logging
                }
                else {
                    // console.error(`Error reading directory ${dirPath}: ${err.message}`); // Keep error logging
                }
                return;
            }
            // --- 4. Process Entries ---
            for (const dirent of entries) {
                const entryPath = path_1.default.join(dirPath, dirent.name);
                const displayPathForEntry = relativePaths ? path_1.default.relative(this.basePath, entryPath).replace(/\\/g, '/') || dirent.name : entryPath;
                const relativePathForMatch = displayPathForEntry; // Use the calculated display path for matching
                const isDirectory = dirent.isDirectory();
                const isFile = dirent.isFile();
                // console.log(`\nProcessing Entry: Name=${dirent.name}, Full=${entryPath}, RelMatch=${relativePathForMatch}, Display=${displayPathForEntry}, Depth=${currentDepth + 1}, isDir=${isDirectory}`); // Debug
                // --- 4a. Pruning Check (Revised) ---
                // Check if the directory *itself* should be pruned based on exclude patterns.
                // Crucially, we only prune if it's NOT explicitly included.
                if (isDirectory) {
                    const isDirExcluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, excludePatterns);
                    if (isDirExcluded) {
                        const isDirExplicitlyIncluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, includePatterns);
                        if (!isDirExplicitlyIncluded) {
                            // console.log(`  Pruning directory: ${displayPathForEntry} (Excluded and not explicitly included)`); // Debug
                            continue; // <<< PRUNE HERE: Skip processing and recursion for this directory
                        }
                        else {
                            // console.log(`  Directory not pruned (excluded but also included): ${displayPathForEntry}`); // Debug
                        }
                    }
                }
                // --- End Pruning Check ---
                // --- 4b. Filtering Logic (for items NOT pruned) ---
                // Type Check
                let typeMatches = true;
                if (matchType) {
                    if (matchType === 'f' && !isFile)
                        typeMatches = false;
                    if (matchType === 'd' && !isDirectory)
                        typeMatches = false;
                }
                // Include/Exclude Check (run again for files, and for directories that were *not* pruned)
                const isIncluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, includePatterns);
                const isExcluded = this.isMatch(dirent.name, entryPath, relativePathForMatch, excludePatterns);
                // console.log(`  Filter Check: Included=${isIncluded}, Excluded=${isExcluded}, TypeMatch=${typeMatches}`); // Debug
                // --- 4c. Print ---
                if (currentDepth + 1 <= maxDepth && typeMatches && isIncluded && !isExcluded) {
                    // console.log(`  Printing Entry: ${displayPathForEntry}`); // Debug
                    console.log(displayPathForEntry);
                }
                // --- 4d. Recurse ---
                // Recurse ONLY if it's a directory (pruned directories won't reach here)
                if (isDirectory) {
                    yield this.traverse(entryPath, currentDepth + 1);
                }
            }
        });
    } // End of traverse method
} // End of class
exports.DirectoryTraverser = DirectoryTraverser;
//# sourceMappingURL=traverser.js.map
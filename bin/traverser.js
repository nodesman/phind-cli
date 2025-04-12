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
            dot: true // Essential for matching '.git' etc.
        };
        this.defaultExcludes = new Set(options.defaultExcludes);
        // Pre-calculate include patterns that are not the default '*'
        this.nonDefaultIncludePatterns = options.includePatterns.filter(p => p !== '*');
    }
    /**
     * Simple check if an item matches any pattern in a list.
     */
    matchesAnyPattern(name, fullPath, relativePath, patterns) {
        if (!patterns || patterns.length === 0) {
            return false;
        }
        const absPathNormalized = path_1.default.normalize(fullPath).replace(/\\/g, '/');
        const relPathNormalized = relativePath === '.' ? '.' : path_1.default.normalize(relativePath).replace(/\\/g, '/');
        const testPaths = [name, absPathNormalized];
        if (this.options.relativePaths && relPathNormalized) {
            testPaths.push(relPathNormalized);
        }
        return micromatch_1.default.some(testPaths, patterns, this.baseMicromatchOptions);
    }
    /**
     * Checks if a directory should be pruned.
     * Prune if excluded UNLESS explicitly included by a non-'*' pattern.
     */
    shouldPrune(name, fullPath, relativePath) {
        const isExcluded = this.matchesAnyPattern(name, fullPath, relativePath, this.options.excludePatterns);
        if (!isExcluded) {
            return false; // Not excluded, don't prune
        }
        // It's excluded, check if an *explicit* include pattern saves it
        // We use `nonDefaultIncludePatterns` to avoid '*' preventing pruning.
        // We also need to check patterns like dir/** or dir/ matching dir
        const explicitIncludePatterns = this.nonDefaultIncludePatterns.map(p => {
            if (p.endsWith('/**'))
                return p.substring(0, p.length - 3);
            if (p.endsWith('/'))
                return p.substring(0, p.length - 1);
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
    shouldPrintItem(name, fullPath, relativePath, isDirectory, isFile) {
        // 1. Type Check
        const { matchType } = this.options;
        if (matchType) {
            if (matchType === 'f' && !isFile)
                return false;
            if (matchType === 'd' && !isDirectory)
                return false;
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
                if (p.endsWith('/**'))
                    return p.substring(0, p.length - 3);
                if (p.endsWith('/'))
                    return p.substring(0, p.length - 1);
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
    traverse(dirPath_1) {
        return __awaiter(this, arguments, void 0, function* (dirPath, currentDepth = 0) {
            const { maxDepth, relativePaths } = this.options;
            // --- 1. Handle Starting Directory (Depth 0) ---
            if (currentDepth === 0) {
                const dirName = path_1.default.basename(dirPath);
                const relativePathForMatch = relativePaths ? '.' : '';
                const displayPath = relativePaths ? '.' : dirPath;
                if (this.shouldPrintItem(dirName, dirPath, relativePathForMatch, true, false)) {
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
            } // Fail silently
            // --- 4. Process Entries ---
            for (const dirent of entries) {
                const entryName = dirent.name;
                const entryFullPath = path_1.default.join(dirPath, entryName);
                const entryRelativePath = relativePaths ? path_1.default.relative(this.basePath, entryFullPath).replace(/\\/g, '/') || entryName : '';
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
                    yield this.traverse(entryFullPath, currentDepth + 1);
                }
            }
        });
    } // End traverse
} // End class
exports.DirectoryTraverser = DirectoryTraverser;
//# sourceMappingURL=traverser.js.map
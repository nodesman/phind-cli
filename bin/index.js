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
exports.traverseDirectory = traverseDirectory;
// src/index.ts
const promises_1 = __importDefault(require("fs/promises")); // Use promise-based fs
const path_1 = __importDefault(require("path"));
const micromatch_1 = __importDefault(require("micromatch"));
function traverseDirectory(dirPath_1, options_1) {
    return __awaiter(this, arguments, void 0, function* (dirPath, options, currentDepth = 0) {
        const { excludePatterns, includePatterns, matchType, maxDepth, ignoreCase, relativePaths, basePath } = options;
        // Stop if we've exceeded max depth (check before reading directory)
        if (currentDepth > maxDepth) {
            return;
        }
        let entries;
        try {
            // Use withFileTypes for efficiency
            entries = yield promises_1.default.readdir(dirPath, { withFileTypes: true });
        }
        catch (err) { // Catch potential errors
            // Log permission errors etc. to stderr, but continue if possible
            // Avoid crashing on inaccessible directories
            if (err.code === 'EACCES' || err.code === 'EPERM') {
                console.error(`Permission error reading directory ${dirPath}: ${err.message}`);
            }
            else {
                console.error(`Error reading directory ${dirPath}: ${err.message}`);
            }
            return; // Stop processing this directory on error
        }
        const micromatchOptions = { nocase: ignoreCase, dot: true };
        for (const dirent of entries) {
            const entryPath = path_1.default.join(dirPath, dirent.name);
            // Calculate relative path *before* potential pruning/filtering
            const displayPath = relativePaths ? path_1.default.relative(basePath, entryPath) || '.' : entryPath;
            const isDirectory = dirent.isDirectory();
            const isFile = dirent.isFile();
            // --- Pruning Check (for directories only) ---
            let isExcludedByPrune = false;
            if (isDirectory) {
                // Match against dir name or full path for exclusion pruning
                const isExcludedDir = micromatch_1.default.isMatch(dirent.name, excludePatterns, micromatchOptions) ||
                    micromatch_1.default.isMatch(entryPath, excludePatterns, micromatchOptions) ||
                    (relativePaths && micromatch_1.default.isMatch(displayPath, excludePatterns, micromatchOptions));
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
                if (matchType === 'f' && !isFile)
                    typeMatches = false;
                if (matchType === 'd' && !isDirectory)
                    typeMatches = false;
            }
            // --- Include/Exclude Pattern Check (for items not pruned) ---
            const isIncluded = micromatch_1.default.isMatch(dirent.name, includePatterns, micromatchOptions) ||
                micromatch_1.default.isMatch(entryPath, includePatterns, micromatchOptions) ||
                (relativePaths && micromatch_1.default.isMatch(displayPath, includePatterns, micromatchOptions));
            const isExcluded = micromatch_1.default.isMatch(dirent.name, excludePatterns, micromatchOptions) ||
                micromatch_1.default.isMatch(entryPath, excludePatterns, micromatchOptions) ||
                (relativePaths && micromatch_1.default.isMatch(displayPath, excludePatterns, micromatchOptions));
            // --- Print if matches all criteria ---
            // Check depth condition *before* printing
            if (currentDepth <= maxDepth && typeMatches && isIncluded && !isExcluded) {
                console.log(displayPath);
            }
            // --- Recurse ---
            // Only recurse if it's a directory and we haven't hit max depth yet
            if (isDirectory && currentDepth < maxDepth) {
                yield traverseDirectory(entryPath, options, currentDepth + 1);
            }
        }
    });
}
//# sourceMappingURL=index.js.map
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
    constructor(options) {
        this.options = options;
        this.micromatchOptions = {
            nocase: this.options.ignoreCase,
            dot: true // Always match dotfiles unless explicitly excluded
        };
    }
    traverse(dirPath_1) {
        return __awaiter(this, arguments, void 0, function* (dirPath, currentDepth = 0) {
            const { excludePatterns, includePatterns, matchType, maxDepth, relativePaths, basePath } = this.options;
            if (currentDepth > maxDepth) {
                return;
            }
            let entries;
            try {
                entries = yield promises_1.default.readdir(dirPath, { withFileTypes: true });
            }
            catch (err) {
                if (err.code === 'EACCES' || err.code === 'EPERM') {
                    console.error(`Permission error reading directory ${dirPath}: ${err.message}`);
                }
                else {
                    console.error(`Error reading directory ${dirPath}: ${err.message}`);
                }
                return;
            }
            for (const dirent of entries) {
                const entryPath = path_1.default.join(dirPath, dirent.name);
                const displayPath = relativePaths ? path_1.default.relative(basePath, entryPath) || '.' : entryPath;
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
                    if (matchType === 'f' && !isFile)
                        typeMatches = false;
                    if (matchType === 'd' && !isDirectory)
                        typeMatches = false;
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
                    yield this.traverse(entryPath, currentDepth + 1);
                }
            }
        });
    }
    // Helper to check match against name, full path, and relative path
    isMatch(name, fullPath, relativePath, patterns) {
        // Avoid matching empty patterns array
        if (!patterns || patterns.length === 0) {
            return false;
        }
        return micromatch_1.default.isMatch(name, patterns, this.micromatchOptions) ||
            micromatch_1.default.isMatch(fullPath, patterns, this.micromatchOptions) ||
            (this.options.relativePaths && micromatch_1.default.isMatch(relativePath, patterns, this.micromatchOptions));
    }
}
exports.DirectoryTraverser = DirectoryTraverser;
//# sourceMappingURL=traverser.js.map
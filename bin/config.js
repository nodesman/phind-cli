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
exports.PhindConfig = void 0;
// src/config.ts
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
class PhindConfig {
    constructor() {
        this.hardcodedDefaultExcludes = ['node_modules', '.git'];
        this.globalIgnorePatterns = [];
        this.globalIgnorePath = '';
        this.cliExcludePatterns = [];
        this.combinedExcludePatterns = null; // Cache combined patterns
        this.globalIgnorePath = this.determineGlobalIgnoreFilePath();
    }
    determineGlobalIgnoreFilePath() {
        const homedir = os_1.default.homedir();
        let configDir;
        if (process.platform === 'win32' && process.env.APPDATA) {
            configDir = process.env.APPDATA;
        }
        else {
            configDir = process.env.XDG_CONFIG_HOME || path_1.default.join(homedir, '.config');
        }
        return path_1.default.join(configDir, 'phind', 'ignore');
    }
    getGlobalIgnorePath() {
        return this.globalIgnorePath;
    }
    loadGlobalIgnores() {
        return __awaiter(this, arguments, void 0, function* (forceReload = false) {
            if (!forceReload && this.globalIgnorePatterns.length > 0) {
                // Already loaded and not forcing reload
                return;
            }
            try {
                const content = yield promises_1.default.readFile(this.globalIgnorePath, 'utf-8');
                this.globalIgnorePatterns = content
                    .split(/\r?\n/) // Split by newline (Windows or Unix)
                    .map(line => line.trim()) // Trim whitespace
                    .filter(line => line && !line.startsWith('#')); // Ignore empty lines and comments
            }
            catch (err) {
                if (err.code === 'ENOENT') {
                    this.globalIgnorePatterns = []; // File not found is okay
                }
                else {
                    console.warn(`Warning: Could not read global ignore file at ${this.globalIgnorePath}: ${err.message}`);
                    this.globalIgnorePatterns = [];
                }
            }
            this.combinedExcludePatterns = null; // Invalidate cache
        });
    }
    setCliExcludes(cliExcludes) {
        this.cliExcludePatterns = cliExcludes;
        this.combinedExcludePatterns = null; // Invalidate cache
    }
    getEffectiveExcludePatterns() {
        if (this.combinedExcludePatterns === null) {
            // Combine defaults, global ignores, and command-line excludes
            this.combinedExcludePatterns = [
                ...this.hardcodedDefaultExcludes,
                ...this.globalIgnorePatterns,
                ...this.cliExcludePatterns,
            ];
            // Optional: Deduplicate if necessary
            // this.combinedExcludePatterns = [...new Set(this.combinedExcludePatterns)];
        }
        return this.combinedExcludePatterns;
    }
    getDefaultExcludesDescription() {
        return `"${this.hardcodedDefaultExcludes.join('", "')}"`;
    }
}
exports.PhindConfig = PhindConfig;
//# sourceMappingURL=config.js.map
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
        // Allow overriding via environment variable for testing
        const testOverridePath = process.env.PHIND_TEST_GLOBAL_IGNORE_PATH;
        if (testOverridePath) {
            return path_1.default.resolve(testOverridePath);
        }
        let configDir;
        // Check platform-specific locations first
        if (process.platform === 'win32' && process.env.APPDATA) {
            configDir = process.env.APPDATA;
        }
        else if (process.env.XDG_CONFIG_HOME) {
            // Use XDG if defined (works on Linux, macOS, etc.)
            configDir = process.env.XDG_CONFIG_HOME;
        }
        // Fallback to ~/.config if no specific location found yet
        if (!configDir) {
            const homedir = os_1.default.homedir(); // <-- Call homedir() only when needed
            configDir = path_1.default.join(homedir, '.config');
        }
        return path_1.default.join(configDir, 'phind', 'ignore');
    }
    getGlobalIgnorePath() {
        return this.globalIgnorePath;
    }
    loadGlobalIgnores() {
        return __awaiter(this, arguments, void 0, function* (forceReload = false) {
            if (!forceReload && this.globalIgnorePatterns.length > 0) {
                return;
            }
            try {
                const content = yield promises_1.default.readFile(this.globalIgnorePath, 'utf-8');
                this.globalIgnorePatterns = content
                    .split(/\r?\n/) // Split by newline
                    .map(line => line.split('#')[0].trim()) // Remove comments FIRST, then trim
                    .filter(line => line); // Ignore empty lines (implicitly ignores comment-only lines now)
            }
            catch (err) {
                if (err.code === 'ENOENT') {
                    this.globalIgnorePatterns = [];
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
        // Handle empty case explicitly
        if (this.hardcodedDefaultExcludes.length === 0) {
            return "";
        }
        return `"${this.hardcodedDefaultExcludes.join('", "')}"`;
    }
}
exports.PhindConfig = PhindConfig;
//# sourceMappingURL=config.js.map
// src/config.ts
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export class PhindConfig {
    private readonly hardcodedDefaultExcludes: string[] = ['node_modules', '.git', '.gradle'];
    private globalIgnorePatterns: string[] = [];
    private globalIgnorePath: string = '';
    private cliExcludePatterns: string[] = [];
    private combinedExcludePatterns: string[] | null = null; // Cache combined patterns

    constructor() {
        this.globalIgnorePath = this.determineGlobalIgnoreFilePath();
    }

    private determineGlobalIgnoreFilePath(): string {
        // Allow overriding via environment variable for testing
        const testOverridePath = process.env.PHIND_TEST_GLOBAL_IGNORE_PATH;
        if (testOverridePath) {
            return path.resolve(testOverridePath);
        }

        let configDir: string | undefined;

        // Check platform-specific locations first
        if (process.platform === 'win32' && process.env.APPDATA) {
            configDir = process.env.APPDATA;
        } else if (process.env.XDG_CONFIG_HOME) {
            // Use XDG if defined (works on Linux, macOS, etc.)
            configDir = process.env.XDG_CONFIG_HOME;
        }

        // Fallback to ~/.config if no specific location found yet
        if (!configDir) {
            const homedir = os.homedir(); // <-- Call homedir() only when needed
            configDir = path.join(homedir, '.config');
        }

        return path.join(configDir, 'phind', 'ignore');
    }

    public getGlobalIgnorePath(): string {
        return this.globalIgnorePath;
    }

    // --- START: ADDED GETTERS ---
    public getHardcodedDefaultExcludes(): string[] {
        // Return a copy to prevent external modification of the internal array
        return [...this.hardcodedDefaultExcludes];
    }

    public getLoadedGlobalIgnorePatterns(): string[] {
        // Return a copy to prevent external modification of the internal array
        // Ensure loadGlobalIgnores has been called before accessing this meaningfully
        return [...this.globalIgnorePatterns];
    }
    // --- END: ADDED GETTERS ---


    public async loadGlobalIgnores(forceReload: boolean = false): Promise<void> {
        // --- Added check: If forcing reload, always clear current patterns ---
        if (forceReload) {
            this.globalIgnorePatterns = []; // Clear before attempting reload
            this.combinedExcludePatterns = null; // Ensure cache is invalidated
        }
        // --- End added check ---
        else if (this.globalIgnorePatterns.length > 0) {
            // If not forcing reload and patterns already exist, return
            return;
        }

        try {
            const content = await fs.readFile(this.globalIgnorePath, 'utf-8');
            this.globalIgnorePatterns = content
                .split(/\r?\n/) // Split by newline
                .map(line => line.split('#')[0].trim()) // Remove comments FIRST, then trim
                .filter(line => line); // Ignore empty lines (implicitly ignores comment-only lines now)
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                this.globalIgnorePatterns = []; // Explicitly set to empty on not found
            } else {
                console.warn(`Warning: Could not read global ignore file at ${this.globalIgnorePath}: ${err.message}`);
                this.globalIgnorePatterns = []; // Explicitly set to empty on error
            }
        }
        this.combinedExcludePatterns = null; // Invalidate cache after any read attempt (success or failure)
    }

    public setCliExcludes(cliExcludes: string[]): void {
        this.cliExcludePatterns = cliExcludes;
        this.combinedExcludePatterns = null; // Invalidate cache
    }

    public getEffectiveExcludePatterns(): string[] {
        if (this.combinedExcludePatterns === null) {
             this.combinedExcludePatterns = [
                ...this.hardcodedDefaultExcludes, // Use private directly here is fine
                ...this.globalIgnorePatterns,     // Use private directly here is fine
                ...this.cliExcludePatterns,       // Use private directly here is fine
            ];
             // Deduplicate using Set for cleaner results
             this.combinedExcludePatterns = [...new Set(this.combinedExcludePatterns)];
        }
        return this.combinedExcludePatterns;
    }

    public getDefaultExcludesDescription(): string {
        // Handle empty case explicitly
        if (this.hardcodedDefaultExcludes.length === 0) {
            return "";
        }
        return `"${this.hardcodedDefaultExcludes.join('", "')}"`;
    }
}
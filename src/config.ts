// src/config.ts
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export class PhindConfig {
    private readonly hardcodedDefaultExcludes: string[] = ['node_modules', '.git'];
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

    public async loadGlobalIgnores(forceReload: boolean = false): Promise<void> {
        if (!forceReload && this.globalIgnorePatterns.length > 0) {
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
                this.globalIgnorePatterns = [];
            } else {
                console.warn(`Warning: Could not read global ignore file at ${this.globalIgnorePath}: ${err.message}`);
                this.globalIgnorePatterns = [];
            }
        }
        this.combinedExcludePatterns = null; // Invalidate cache
    }

    public setCliExcludes(cliExcludes: string[]): void {
        this.cliExcludePatterns = cliExcludes;
        this.combinedExcludePatterns = null; // Invalidate cache
    }

    public getEffectiveExcludePatterns(): string[] {
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

    public getDefaultExcludesDescription(): string {
        // Handle empty case explicitly
        if (this.hardcodedDefaultExcludes.length === 0) {
            return "";
        }
        return `"${this.hardcodedDefaultExcludes.join('", "')}"`;
    }
}
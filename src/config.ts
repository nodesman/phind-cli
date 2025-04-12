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
        const homedir = os.homedir();
        let configDir: string;

        if (process.platform === 'win32' && process.env.APPDATA) {
            configDir = process.env.APPDATA;
        } else {
            configDir = process.env.XDG_CONFIG_HOME || path.join(homedir, '.config');
        }
        return path.join(configDir, 'phind', 'ignore');
    }

    public getGlobalIgnorePath(): string {
        return this.globalIgnorePath;
    }

    public async loadGlobalIgnores(forceReload: boolean = false): Promise<void> {
        if (!forceReload && this.globalIgnorePatterns.length > 0) {
            // Already loaded and not forcing reload
            return;
        }

        try {
            const content = await fs.readFile(this.globalIgnorePath, 'utf-8');
            this.globalIgnorePatterns = content
                .split(/\r?\n/) // Split by newline (Windows or Unix)
                .map(line => line.trim()) // Trim whitespace
                .filter(line => line && !line.startsWith('#')); // Ignore empty lines and comments
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                this.globalIgnorePatterns = []; // File not found is okay
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

    public getDefaultExcludesDescription(): string {
        return `"${this.hardcodedDefaultExcludes.join('", "')}"`;
    }
}
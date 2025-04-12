#!/usr/bin/env node

// src/cli.ts
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs/promises';
import { PhindConfig } from './config'; // Import new Config class
import { DirectoryTraverser, TraverseOptions } from './traverser'; // Import new Traverser class

class PhindApp {
    private config: PhindConfig;

    constructor() {
        this.config = new PhindConfig();
    }

    // Method to parse arguments using yargs
    private async parseArguments() {
        return await yargs(hideBin(process.argv))
            .usage('Usage: $0 [path] [options]')
            .command('$0 [path]', 'Find files/directories recursively', (yargs) => {
                yargs.positional('path', {
                    describe: 'Directory to search in',
                    type: 'string',
                    default: '.',
                });
            })
            .option('name', {
                alias: 'n',
                type: 'string',
                array: true,
                description: 'Glob pattern(s) for filenames/paths to include (default: *)',
                defaultDescription: '"*" (all files/dirs)',
                default: ['*'],
            })
            .option('exclude', {
                alias: 'e',
                type: 'string',
                array: true,
                description: `Glob pattern(s) to exclude. Also reads from ${this.config.getGlobalIgnorePath()} unless --no-global-ignore is used.`,
                default: [], // Handled by config class now
                defaultDescription: this.config.getDefaultExcludesDescription(),
            })
            .option('no-global-ignore', {
                type: 'boolean',
                description: 'Do not load patterns from the global ignore file.',
                default: false,
            })
            .option('type', {
                alias: 't',
                type: 'string',
                choices: ['f', 'd'] as const,
                description: 'Match only files (f) or directories (d)',
            })
            .option('maxdepth', {
                alias: 'd',
                type: 'number',
                description: 'Maximum directory levels to descend (0 means starting path only)',
                default: Infinity,
            })
            .option('ignore-case', {
                alias: 'i',
                type: 'boolean',
                description: 'Perform case-insensitive matching',
                default: false,
            })
            .option('relative', {
                alias: 'r',
                type: 'boolean',
                description: 'Print paths relative to the starting directory',
                default: false,
            })
            .help()
            .alias('help', 'h')
            .strict()
            .argv; // Await the promise here
    }

    // Method to validate the starting path
    private async validateStartPath(startArgPath: string): Promise<string> {
        const startPath = path.resolve(startArgPath);
        try {
            const stats = await fs.stat(startPath);
            if (!stats.isDirectory()) {
                throw new Error(`Start path "${startArgPath}" is not a directory.`);
            }
            return startPath; // Return resolved, validated path
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                throw new Error(`Start path "${startArgPath}" not found.`);
            } else {
                 throw new Error(`Error accessing start path "${startArgPath}": ${err.message}`);
            }
        }
    }

    // Main execution method
    public async run(): Promise<void> {
        try {
            const argv = await this.parseArguments();

            // Load global ignores if not disabled
            if (!argv.noGlobalIgnore) {
                await this.config.loadGlobalIgnores();
            }

            // Set CLI excludes in config
            this.config.setCliExcludes(argv.exclude as string[]);

            // Validate path
            const startArgPath = argv.path as string;
            const startPath = await this.validateStartPath(startArgPath);
            const basePath = startPath; // Use validated path as base

            // Prepare options for the traverser
            const maxDepth = argv.maxdepth === Infinity ? Number.MAX_SAFE_INTEGER : (argv.maxdepth as number);
            const traverseOptions: TraverseOptions = {
                excludePatterns: this.config.getEffectiveExcludePatterns(), // Get combined list
                includePatterns: argv.name as string[],
                matchType: argv.type ?? null,
                maxDepth: maxDepth,
                ignoreCase: argv.ignoreCase as boolean,
                relativePaths: argv.relative as boolean,
                basePath: basePath
            };

            // Create and run the traverser
            const traverser = new DirectoryTraverser(traverseOptions);
            await traverser.traverse(startPath); // Start traversal

        } catch (error: any) {
            // Catch errors from parsing, validation, or traversal
            console.error(`\nError: ${error.message}`);
            process.exit(1);
        }
    }
}

// --- Application Entry Point ---
// Create an instance of the app and run it
const app = new PhindApp();
app.run().catch(err => {
    // Catch unexpected errors not handled within run()
    console.error("\nAn unexpected critical error occurred:", err);
    process.exit(1);
});
#!/usr/bin/env node

// src/cli.ts
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs/promises';
import { PhindConfig } from './config'; // Import Config class
import { DirectoryTraverser, TraverseOptions } from './traverser'; // Import Traverser class

class PhindApp {
    private config: PhindConfig;

    constructor() {
        this.config = new PhindConfig();
    }

    // Method to parse arguments using yargs
    private async parseArguments() {
        // Note: Need to await the argv promise yargs returns
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
                default: ['*'], // Default include pattern
            })
            .option('exclude', {
                alias: 'e',
                type: 'string',
                array: true,
                // Updated description to reference config method for clarity
                description: `Glob pattern(s) to exclude. Also reads from ${this.config.getGlobalIgnorePath()} unless --no-global-ignore is used.`,
                default: [], // Defaults are now handled by PhindConfig
                defaultDescription: this.config.getDefaultExcludesDescription(), // Get defaults description from config
            })
            .option('no-global-ignore', {
                type: 'boolean',
                description: 'Do not load patterns from the global ignore file.',
                default: false,
            })
            .option('type', {
                alias: 't',
                type: 'string',
                choices: ['f', 'd'] as const, // Use as const for stricter type checking
                description: 'Match only files (f) or directories (d)',
            })
            .option('maxdepth', {
                alias: 'd',
                type: 'number',
                description: 'Maximum directory levels to descend (0 means starting path only)',
                default: Infinity,
                coerce: (val) => { // Add coercion for validation
                    if (val < 0) {
                        throw new Error("Argument maxdepth must be a non-negative number.");
                    }
                    return val === Infinity ? Number.MAX_SAFE_INTEGER : val; // Use MAX_SAFE_INTEGER internally
                }
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
            .strict() // Enable strict mode for unknown options/arguments
            .argv; // Ensure yargs processing is awaited
    }

    // Method to validate the starting path
    private async validateStartPath(startArgPath: string): Promise<string> {
        const startPath = path.resolve(startArgPath); // Resolve relative paths (like '.')
        try {
            const stats = await fs.stat(startPath);
            if (!stats.isDirectory()) {
                throw new Error(`Start path "${startArgPath}" (resolved to "${startPath}") is not a directory.`);
            }
            return startPath; // Return the resolved, validated absolute path
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                throw new Error(`Start path "${startArgPath}" (resolved to "${startPath}") not found.`);
            } else if (err.code === 'EACCES') {
                 throw new Error(`Permission denied accessing start path "${startArgPath}" (resolved to "${startPath}").`);
            } else {
                 throw new Error(`Error accessing start path "${startArgPath}" (resolved to "${startPath}"): ${err.message}`);
            }
        }
    }

    // Main execution method
    public async run(): Promise<void> {
        try {
            const argv = await this.parseArguments();

            // Load global ignores if not disabled
            if (!argv.noGlobalIgnore) {
                // Use forceReload=false (default) unless needed
                await this.config.loadGlobalIgnores();
            }

            // Set CLI excludes in config (after loading globals)
            this.config.setCliExcludes(argv.exclude as string[]);

            // Validate the starting path argument AFTER parsing args
            const startArgPath = argv.path as string;
            const startPath = await this.validateStartPath(startArgPath);

            // *** Crucial: basePath must be the validated, resolved startPath ***
            const basePath = startPath;

            // Prepare options for the traverser
            // MAX_SAFE_INTEGER is handled by yargs coerce now
            const maxDepth = argv.maxdepth as number;

            const traverseOptions: TraverseOptions = {
                // Get the combined list of excludes from config
                excludePatterns: this.config.getEffectiveExcludePatterns(),
                // Get includes directly from arguments
                includePatterns: argv.name as string[],
                // Use validated type or null
                matchType: argv.type ?? null,
                maxDepth: maxDepth,
                ignoreCase: argv.ignoreCase as boolean,
                relativePaths: argv.relative as boolean,
                // basePath is now passed to the constructor, not here
            };

            // Create and run the traverser, passing the resolved basePath
            const traverser = new DirectoryTraverser(traverseOptions, basePath);
            await traverser.traverse(startPath); // Start traversal from the resolved path

        } catch (error: any) {
            // Catch errors from parsing, validation, or traversal
            console.error(`\nError: ${error.message}`);
            process.exit(1);
        }
    }
}

// --- Application Entry Point ---
// Only run the app if this script is executed directly
if (require.main === module) {
    const app = new PhindApp();
    app.run().catch(err => {
        // Catch unexpected errors not handled within run()
        console.error("\nAn unexpected critical error occurred:", err);
        process.exit(1);
    });
}

// Export the class for potential programmatic use (optional)
export { PhindApp };
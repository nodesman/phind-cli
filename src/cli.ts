#!/usr/bin/env node

// src/cli.ts
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs/promises';
import { PhindConfig } from './config';
import { DirectoryTraverser, TraverseOptions } from './traverser';
// --- START: Import AI Client ---
import { GeminiClient } from './ai'; // Import AI client
// --- END: Import AI Client ---

class PhindApp {
    private config: PhindConfig;

    constructor() {
        this.config = new PhindConfig();
    }

    private async parseArguments() {
        return await yargs(hideBin(process.argv))
            .usage('Usage: $0 [path] [options] [--ai <query>]') // Updated usage
            .command('$0 [path]', 'Find files/directories recursively', (yargs) => {
                yargs.positional('path', {
                    describe: 'Directory to search in',
                    type: 'string',
                    default: '.',
                });
            })
            // --- Standard Options ---
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
                description: `Glob pattern(s) to exclude. Also reads from ${this.config.getGlobalIgnorePath()} unless --skip-global-ignore is used.`,
                default: [], // Keep default as empty array for CLI args
                defaultDescription: this.config.getDefaultExcludesDescription(),
            })
            .option('skip-global-ignore', {
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
                default: Infinity, // Default is Infinity
                coerce: (val) => {
                    if (val < 0) {
                        throw new Error("Argument maxdepth must be a non-negative number.");
                    }
                    // Convert Infinity string/concept to a usable large number for yargs/traverser
                    // Use Number.MAX_SAFE_INTEGER which is large enough for practical purposes.
                    // Also handle the actual Infinity value if it somehow gets passed directly.
                    return val === Infinity || String(val).toLowerCase() === 'infinity' ? Number.MAX_SAFE_INTEGER : val;
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
                description: 'Print paths relative to the starting directory (default). Use --relative=false for absolute paths.',
                default: true,
                defaultDescription: "true (relative paths)",
            })
            // --- START: Add AI Option ---
            .option('ai', {
                type: 'string', // Expects the query string
                description: 'Use AI (Google Gemini) to find relevant files based on a natural language query. Requires GEMINI_API_KEY env variable.',
                // --- FIX: REMOVE ALL CONFLICTS ---
                // conflicts: ['type', 'maxdepth', 'ignore-case', 'relative'], // REMOVED THIS LINE ENTIRELY
                // --- END FIX ---
                coerce: (arg: any) => {
                     if (typeof arg === 'string' && arg.trim() === '') {
                         throw new Error("The --ai option requires a non-empty query string.");
                     }
                     return arg;
                 }
            })
            // --- END: Add AI Option ---
            .help()
            .alias('help', 'h')
            .strict() // Keep strict mode to catch truly unknown options
            .argv;
    }

    private async validateStartPath(startArgPath: string): Promise<string> {
        const startPath = path.resolve(startArgPath);
        try {
            const stats = await fs.stat(startPath);
            if (!stats.isDirectory()) {
                throw new Error(`Start path "${startArgPath}" (resolved to "${startPath}") is not a directory.`);
            }
            return startPath;
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

    public async run(): Promise<void> {
        try {
            const argv = await this.parseArguments();

            // --- START: AI Mode Logic ---
            if (argv.ai) {
                const aiQuery = argv.ai as string;
                const apiKey = process.env.GEMINI_API_KEY;

                if (!apiKey) {
                    throw new Error("AI Mode requires the GEMINI_API_KEY environment variable to be set.");
                }
                 console.log(`AI Mode activated. Query: "${aiQuery}"`);

                // --- Get ALL files for AI analysis ---
                // We ignore most standard filters for AI mode, but respect global ignore unless skipped.
                // We always collect relative paths for consistency in the AI prompt.

                if (!argv.skipGlobalIgnore) {
                    // Ensure global ignores are loaded *before* accessing them
                    await this.config.loadGlobalIgnores();
                }

                // Use only hardcoded and global excludes for AI file collection
                const aiExcludePatterns = [
                    // --- Use getter ---
                    ...this.config.getHardcodedDefaultExcludes(),
                    // --- Use getter ---
                    ...(argv.skipGlobalIgnore ? [] : this.config.getLoadedGlobalIgnorePatterns())
                ];

                const startArgPath = argv.path as string;
                const startPath = await this.validateStartPath(startArgPath);
                const basePath = startPath;

                const aiTraverseOptions: TraverseOptions = {
                    excludePatterns: [...new Set(aiExcludePatterns)], // Use combined excludes (already using Set)
                    includePatterns: ['*'], // Include everything initially
                    matchType: null, // Get all types
                    maxDepth: Number.MAX_SAFE_INTEGER, // No depth limit
                    ignoreCase: false, // Case doesn't matter for collection
                    relativePaths: true, // ALWAYS use relative paths for AI input
                    // --- Use getter ---
                    defaultExcludes: this.config.getHardcodedDefaultExcludes(),
                    outputMode: 'collect' // CRITICAL: Collect results instead of printing
                };

                const aiTraverser = new DirectoryTraverser(aiTraverseOptions, basePath);
                console.log("AI Mode: Collecting all file paths...");
                await aiTraverser.traverse(startPath);
                const allFiles = aiTraverser.getCollectedResults();
                console.log(`AI Mode: Collected ${allFiles.length} paths to analyze.`);

                if (allFiles.length === 0) {
                     console.log("AI Mode: No files found matching initial criteria. AI cannot proceed.");
                     return; // Exit early if no files collected
                }

                // --- Interact with Gemini ---
                const geminiClient = new GeminiClient(apiKey);
                const relevantFiles = await geminiClient.findRelevantFiles(allFiles, aiQuery);

                // --- Print AI Results ---
                if (relevantFiles.length > 0) {
                     console.log("\nAI identified the following relevant files:");
                     relevantFiles.forEach(file => console.log(file));
                } else {
                     console.log("\nAI did not identify any relevant files based on your query.");
                }
                return; // End execution after AI mode
            }
            // --- END: AI Mode Logic ---

            // --- Standard Mode Logic (if --ai is not used) ---
            if (!argv.skipGlobalIgnore) {
                // Ensure global ignores are loaded before calculating effective excludes
                await this.config.loadGlobalIgnores();
            }
            // Set CLI excludes *after* potentially loading global ones
            this.config.setCliExcludes(argv.exclude as string[]);

            const startArgPath = argv.path as string;
            const startPath = await this.validateStartPath(startArgPath);
            const basePath = startPath; // Base path for traversal is the validated start path

             // Pass the coerced maxdepth value directly (it's either a number or MAX_SAFE_INTEGER)
            const traverseOptions: TraverseOptions = {
                excludePatterns: this.config.getEffectiveExcludePatterns(), // Now gets the combined list
                includePatterns: argv.name as string[],
                matchType: argv.type ?? null,
                maxDepth: argv.maxdepth as number, // Pass coerced value
                ignoreCase: argv.ignoreCase as boolean,
                relativePaths: argv.relative as boolean,
                // --- Use getter ---
                defaultExcludes: this.config.getHardcodedDefaultExcludes(), // Pass hardcoded defaults for override logic
                outputMode: 'print' // Standard mode prints directly
            };

            const traverser = new DirectoryTraverser(traverseOptions, basePath);
            await traverser.traverse(startPath);

        } catch (error: any) {
            console.error("--- Caught Error in PhindApp.run ---");
            // console.error(error); // Optionally log the full error object for debugging
            console.error("------------------------------------");
            console.error(`\nError: ${error.message}`);
            process.exit(1);
        }
    }
}

// --- Application Entry Point ---
if (require.main === module) {
    const app = new PhindApp();
    app.run().catch(err => {
        console.error("\nAn unexpected critical error occurred:", err);
        process.exit(1);
    });
}

export { PhindApp };
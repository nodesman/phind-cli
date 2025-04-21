#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhindApp = void 0;
// src/cli.ts
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("./config");
const traverser_1 = require("./traverser");
// --- START: Import AI Client ---
const ai_1 = require("./ai"); // Import AI client
// --- END: Import AI Client ---
class PhindApp {
    constructor() {
        this.config = new config_1.PhindConfig();
    }
    async parseArguments() {
        return await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
            default: [],
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
            choices: ['f', 'd'],
            description: 'Match only files (f) or directories (d)',
        })
            .option('maxdepth', {
            alias: 'd',
            type: 'number',
            description: 'Maximum directory levels to descend (0 means starting path only)',
            default: Infinity,
            coerce: (val) => {
                if (val < 0) {
                    throw new Error("Argument maxdepth must be a non-negative number.");
                }
                return val === Infinity ? Number.MAX_SAFE_INTEGER : val;
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
            conflicts: ['name', 'exclude', 'type', 'maxdepth', 'ignore-case', 'relative'], // AI mode overrides standard filters/output
            coerce: (arg) => {
                if (typeof arg === 'string' && arg.trim() === '') {
                    throw new Error("The --ai option requires a non-empty query string.");
                }
                return arg;
            }
        })
            // --- END: Add AI Option ---
            .help()
            .alias('help', 'h')
            .strict()
            .argv;
    }
    async validateStartPath(startArgPath) {
        const startPath = path_1.default.resolve(startArgPath);
        try {
            const stats = await promises_1.default.stat(startPath);
            if (!stats.isDirectory()) {
                throw new Error(`Start path "${startArgPath}" (resolved to "${startPath}") is not a directory.`);
            }
            return startPath;
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                throw new Error(`Start path "${startArgPath}" (resolved to "${startPath}") not found.`);
            }
            else if (err.code === 'EACCES') {
                throw new Error(`Permission denied accessing start path "${startArgPath}" (resolved to "${startPath}").`);
            }
            else {
                throw new Error(`Error accessing start path "${startArgPath}" (resolved to "${startPath}"): ${err.message}`);
            }
        }
    }
    async run() {
        try {
            const argv = await this.parseArguments();
            // --- START: AI Mode Logic ---
            if (argv.ai) {
                const aiQuery = argv.ai;
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    throw new Error("AI Mode requires the GEMINI_API_KEY environment variable to be set.");
                }
                console.log(`AI Mode activated. Query: "${aiQuery}"`);
                // --- Get ALL files for AI analysis ---
                // We ignore most standard filters for AI mode, but respect global ignore unless skipped.
                // We always collect relative paths for consistency in the AI prompt.
                if (!argv.skipGlobalIgnore) {
                    await this.config.loadGlobalIgnores();
                }
                // Use only hardcoded and global excludes for AI file collection
                const aiExcludePatterns = [
                    ...this.config.hardcodedDefaultExcludes,
                    ...(argv.skipGlobalIgnore ? [] : this.config.globalIgnorePatterns)
                ];
                const startArgPath = argv.path;
                const startPath = await this.validateStartPath(startArgPath);
                const basePath = startPath;
                const aiTraverseOptions = {
                    excludePatterns: [...new Set(aiExcludePatterns)], // Use combined excludes
                    includePatterns: ['*'], // Include everything initially
                    matchType: null, // Get all types
                    maxDepth: Number.MAX_SAFE_INTEGER, // No depth limit
                    ignoreCase: false, // Case doesn't matter for collection
                    relativePaths: true, // ALWAYS use relative paths for AI input
                    defaultExcludes: this.config.hardcodedDefaultExcludes,
                    outputMode: 'collect' // CRITICAL: Collect results instead of printing
                };
                const aiTraverser = new traverser_1.DirectoryTraverser(aiTraverseOptions, basePath);
                console.log("AI Mode: Collecting all file paths...");
                await aiTraverser.traverse(startPath);
                const allFiles = aiTraverser.getCollectedResults();
                console.log(`AI Mode: Collected ${allFiles.length} paths to analyze.`);
                if (allFiles.length === 0) {
                    console.log("AI Mode: No files found matching initial criteria. AI cannot proceed.");
                    return; // Exit early if no files collected
                }
                // --- Interact with Gemini ---
                const geminiClient = new ai_1.GeminiClient(apiKey);
                const relevantFiles = await geminiClient.findRelevantFiles(allFiles, aiQuery);
                // --- Print AI Results ---
                if (relevantFiles.length > 0) {
                    console.log("\nAI identified the following relevant files:");
                    relevantFiles.forEach(file => console.log(file));
                }
                else {
                    console.log("\nAI did not identify any relevant files based on your query.");
                }
                return; // End execution after AI mode
            }
            // --- END: AI Mode Logic ---
            // --- Standard Mode Logic (if --ai is not used) ---
            if (!argv.skipGlobalIgnore) {
                await this.config.loadGlobalIgnores();
            }
            this.config.setCliExcludes(argv.exclude);
            const startArgPath = argv.path;
            const startPath = await this.validateStartPath(startArgPath);
            const basePath = startPath;
            const traverseOptions = {
                excludePatterns: this.config.getEffectiveExcludePatterns(),
                includePatterns: argv.name,
                matchType: argv.type ?? null,
                maxDepth: argv.maxdepth,
                ignoreCase: argv.ignoreCase,
                relativePaths: argv.relative,
                defaultExcludes: this.config.hardcodedDefaultExcludes, // Use hardcoded defaults
                outputMode: 'print' // Standard mode prints directly
            };
            const traverser = new traverser_1.DirectoryTraverser(traverseOptions, basePath);
            await traverser.traverse(startPath);
        }
        catch (error) {
            console.error("--- Caught Error in PhindApp.run ---");
            // console.error(error); // Optionally log the full error object for debugging
            console.error("------------------------------------");
            console.error(`\nError: ${error.message}`);
            process.exit(1);
        }
    }
}
exports.PhindApp = PhindApp;
// --- Application Entry Point ---
if (require.main === module) {
    const app = new PhindApp();
    app.run().catch(err => {
        console.error("\nAn unexpected critical error occurred:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map
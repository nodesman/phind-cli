#!/usr/bin/env node
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
exports.PhindApp = void 0;
// src/cli.ts
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("./config"); // Import Config class
const traverser_1 = require("./traverser"); // Import Traverser class
class PhindApp {
    constructor() {
        this.config = new config_1.PhindConfig();
    }
    // Method to parse arguments using yargs
    parseArguments() {
        return __awaiter(this, void 0, void 0, function* () {
            // Note: Need to await the argv promise yargs returns
            return yield (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
                choices: ['f', 'd'], // Use as const for stricter type checking
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
        });
    }
    // Method to validate the starting path
    validateStartPath(startArgPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const startPath = path_1.default.resolve(startArgPath); // Resolve relative paths (like '.')
            try {
                const stats = yield promises_1.default.stat(startPath);
                if (!stats.isDirectory()) {
                    throw new Error(`Start path "${startArgPath}" (resolved to "${startPath}") is not a directory.`);
                }
                return startPath; // Return the resolved, validated absolute path
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
        });
    }
    // Main execution method
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const argv = yield this.parseArguments();
                // Load global ignores if not disabled
                if (!argv.noGlobalIgnore) {
                    // Use forceReload=false (default) unless needed
                    yield this.config.loadGlobalIgnores();
                }
                // Set CLI excludes in config (after loading globals)
                this.config.setCliExcludes(argv.exclude);
                // Validate the starting path argument AFTER parsing args
                const startArgPath = argv.path;
                const startPath = yield this.validateStartPath(startArgPath);
                // *** Crucial: basePath must be the validated, resolved startPath ***
                const basePath = startPath;
                // Prepare options for the traverser
                // MAX_SAFE_INTEGER is handled by yargs coerce now
                const maxDepth = argv.maxdepth;
                // Assume PhindConfig has a method `getDefaultExcludes()` returning string[]
                // This assumes the PhindConfig class *has* a method to get the raw defaults.
                // If not, hardcode them here based on the config's internal value.
                const defaultExcludes = this.config.hardcodedDefaultExcludes || ['node_modules', '.git'];
                // const defaultExcludes = ['node_modules', '.git']; // Or just hardcode if method access is problematic
                const traverseOptions = {
                    // Get the combined list of excludes from config
                    excludePatterns: this.config.getEffectiveExcludePatterns(),
                    // Get includes directly from arguments
                    includePatterns: argv.name,
                    // Use validated type or null
                    matchType: (_a = argv.type) !== null && _a !== void 0 ? _a : null,
                    maxDepth: maxDepth,
                    ignoreCase: argv.ignoreCase,
                    relativePaths: argv.relative,
                    // Pass default excludes separately for override logic
                    defaultExcludes: defaultExcludes,
                };
                // Create and run the traverser, passing the resolved basePath
                const traverser = new traverser_1.DirectoryTraverser(traverseOptions, basePath); // Pass basePath as second arg
                yield traverser.traverse(startPath); // Start traversal from the resolved path
            }
            catch (error) {
                // Catch errors from parsing, validation, or traversal
                console.error(`\nError: ${error.message}`);
                process.exit(1);
            }
        });
    }
}
exports.PhindApp = PhindApp;
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
//# sourceMappingURL=cli.js.map
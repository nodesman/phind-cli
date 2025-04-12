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
// src/cli.ts
const path_1 = __importDefault(require("path"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("./config"); // Import new Config class
const traverser_1 = require("./traverser"); // Import new Traverser class
class PhindApp {
    constructor() {
        this.config = new config_1.PhindConfig();
    }
    // Method to parse arguments using yargs
    parseArguments() {
        return __awaiter(this, void 0, void 0, function* () {
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
                choices: ['f', 'd'],
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
        });
    }
    // Method to validate the starting path
    validateStartPath(startArgPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const startPath = path_1.default.resolve(startArgPath);
            try {
                const stats = yield promises_1.default.stat(startPath);
                if (!stats.isDirectory()) {
                    throw new Error(`Start path "${startArgPath}" is not a directory.`);
                }
                return startPath; // Return resolved, validated path
            }
            catch (err) {
                if (err.code === 'ENOENT') {
                    throw new Error(`Start path "${startArgPath}" not found.`);
                }
                else {
                    throw new Error(`Error accessing start path "${startArgPath}": ${err.message}`);
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
                    yield this.config.loadGlobalIgnores();
                }
                // Set CLI excludes in config
                this.config.setCliExcludes(argv.exclude);
                // Validate path
                const startArgPath = argv.path;
                const startPath = yield this.validateStartPath(startArgPath);
                const basePath = startPath; // Use validated path as base
                // Prepare options for the traverser
                const maxDepth = argv.maxdepth === Infinity ? Number.MAX_SAFE_INTEGER : argv.maxdepth;
                const traverseOptions = {
                    excludePatterns: this.config.getEffectiveExcludePatterns(), // Get combined list
                    includePatterns: argv.name,
                    matchType: (_a = argv.type) !== null && _a !== void 0 ? _a : null,
                    maxDepth: maxDepth,
                    ignoreCase: argv.ignoreCase,
                    relativePaths: argv.relative,
                    basePath: basePath
                };
                // Create and run the traverser
                const traverser = new traverser_1.DirectoryTraverser(traverseOptions);
                yield traverser.traverse(startPath); // Start traversal
            }
            catch (error) {
                // Catch errors from parsing, validation, or traversal
                console.error(`\nError: ${error.message}`);
                process.exit(1);
            }
        });
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
//# sourceMappingURL=cli.js.map
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
const promises_1 = __importDefault(require("fs/promises")); // Import promises directly
const index_1 = require("./index"); // Import the core logic
// Use an async main function to handle top-level await
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Define args using yargs, inferring types where possible
        const argv = yield (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
            description: 'Glob pattern(s) to exclude (files or directories)',
            defaultDescription: '"node_modules", ".git"',
            default: ['node_modules', '.git'],
        })
            .option('type', {
            alias: 't',
            type: 'string',
            choices: ['f', 'd'], // Use 'as const' for stricter type checking
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
            .strict() // Report errors for unknown options
            .argv; // await the argv promise
        // Ensure types are inferred correctly, cast if necessary or use 'unknown' then check
        const startArgPath = argv.path; // Cast path to string (yargs should ensure it)
        const maxDepth = argv.maxdepth === Infinity ? Number.MAX_SAFE_INTEGER : argv.maxdepth; // Handle Infinity
        const startPath = path_1.default.resolve(startArgPath);
        const basePath = startPath; // Use for relative path calculations
        // Validate start path
        try {
            const stats = yield promises_1.default.stat(startPath);
            if (!stats.isDirectory()) {
                console.error(`Error: Start path "${startArgPath}" is not a directory.`);
                process.exit(1);
            }
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                console.error(`Error: Start path "${startArgPath}" not found.`);
            }
            else {
                console.error(`Error accessing start path "${startArgPath}": ${err.message}`);
            }
            process.exit(1);
        }
        // Call the core traversal function
        yield (0, index_1.traverseDirectory)(startPath, {
            // Ensure argv properties are correctly typed or cast
            excludePatterns: argv.exclude,
            includePatterns: argv.name,
            matchType: (_a = argv.type) !== null && _a !== void 0 ? _a : null, // Handle potential undefined type
            maxDepth: maxDepth,
            ignoreCase: argv.ignoreCase,
            relativePaths: argv.relative,
            basePath: basePath
        });
    });
}
// Execute main and catch errors
main().catch(err => {
    console.error("\nAn unexpected error occurred:", err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map
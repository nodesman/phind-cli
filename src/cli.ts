#!/usr/bin/env node

// src/cli.ts
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs/promises'; // Import promises directly
import { traverseDirectory } from './index'; // Import the core logic

// Use an async main function to handle top-level await
async function main() {
    // Define args using yargs, inferring types where possible
    const argv = await yargs(hideBin(process.argv))
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
            choices: ['f', 'd'] as const, // Use 'as const' for stricter type checking
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
    const startArgPath = argv.path as string; // Cast path to string (yargs should ensure it)
    const maxDepth = argv.maxdepth === Infinity ? Number.MAX_SAFE_INTEGER : (argv.maxdepth as number); // Handle Infinity

    const startPath = path.resolve(startArgPath);
    const basePath = startPath; // Use for relative path calculations

    // Validate start path
    try {
        const stats = await fs.stat(startPath);
        if (!stats.isDirectory()) {
            console.error(`Error: Start path "${startArgPath}" is not a directory.`);
            process.exit(1);
        }
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            console.error(`Error: Start path "${startArgPath}" not found.`);
        } else {
            console.error(`Error accessing start path "${startArgPath}": ${err.message}`);
        }
        process.exit(1);
    }

    // Call the core traversal function
    await traverseDirectory(startPath, {
        // Ensure argv properties are correctly typed or cast
        excludePatterns: argv.exclude as string[],
        includePatterns: argv.name as string[],
        matchType: argv.type ?? null, // Handle potential undefined type
        maxDepth: maxDepth,
        ignoreCase: argv.ignoreCase as boolean,
        relativePaths: argv.relative as boolean,
        basePath: basePath
    });
}

// Execute main and catch errors
main().catch(err => {
    console.error("\nAn unexpected error occurred:", err);
    process.exit(1);
});
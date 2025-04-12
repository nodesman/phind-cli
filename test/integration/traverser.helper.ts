// test/integration/traverser.helper.ts
import { DirectoryTraverser, TraverseOptions } from '../../src/traverser'; // Adjust path if needed
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { Dirent } from 'fs';

// Define a standard test structure used across multiple files
export const testStructure = {
    'file1.txt': 'content1',
    'file2.log': 'content2',
    ' Capitals.TXT': 'case test', // Removed leading space
    '.hiddenfile': 'hidden content',
    '.hiddenDir': {
        'insideHidden.txt': 'hidden dir content',
    },
    'dir1': {
        'file3.txt': 'content3',
        'subDir1': {
            'file4.js': 'content4',
            '.hiddensub': 'hidden',
            'another.log': 'sub log'
        },
        'file6.data': 'data content',
        'exclude_me.tmp': 'should be pruned by tmp exclude'
    },
    'dir2': {
        'file5.log': 'content5',
        // 'image.JPG': 'uppercase jpg', // <<< CHANGE THIS
        'image_upper.JPG': 'uppercase jpg', // <<< TO THIS (unique name)
        'image.jpg': 'lowercase jpg' // Added missing file
    },
    '.git': { 'config': 'git config', 'HEAD': 'ref: refs/heads/main' },
    'node_modules': { 'some_package': { 'index.js': 'code' } },
    'emptyDir': null,
    'dir with spaces': { 'file inside spaces.txt': 'space content' },
    'unreadable_dir': {}
};

export async function createTestStructure(baseDir: string, structure: any): Promise<void> {
    for (const name in structure) {
        const currentPath = path.join(baseDir, name);
        const value = structure[name];
        if (typeof value === 'string') {
            await fs.ensureDir(path.dirname(currentPath));
            await fs.writeFile(currentPath, value);
        } else if (typeof value === 'object' && value !== null) {
            await fs.ensureDir(currentPath);
            await createTestStructure(currentPath, value);
        } else {
            await fs.ensureDir(currentPath);
        }
    }
}

// Setup function for beforeEach
export async function setupTestEnvironment(): Promise<{ testDir: string; consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance }> {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-test-'));
    await createTestStructure(testDir, testStructure);

    // Make 'unreadable_dir' unreadable (best effort)
    try {
        await fs.chmod(path.join(testDir, 'unreadable_dir'), 0o000);
    } catch (e: any) {
        console.warn(`Could not set permissions for unreadable_dir test: ${e.message}`);
    }

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Resolve the real path AFTER creating the structure and setting permissions
    const realTestDir = await fs.realpath(testDir);

    return { testDir: realTestDir, consoleLogSpy, consoleErrorSpy }; // Return the REAL path
}

// Teardown function for afterEach
export async function cleanupTestEnvironment(testDir: string, spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance }): Promise<void> {
    // Restore permissions first (might fail if test failed)
    try {
        await fs.chmod(path.join(testDir, 'unreadable_dir'), 0o755);
    } catch (e) { /* Ignore */ }
    await fs.remove(testDir);
    spies.consoleLogSpy.mockRestore();
    spies.consoleErrorSpy.mockRestore();
}

// Helper to normalize and sort output paths
// --- START FIX ---
export const normalizeAndSort = (calls: any[][]): string[] => {
    // The `calls` array contains the arguments passed to console.log.
    // We assume call[0] is the path string logged by the traverser.
    // The traverser ALREADY produced the correct relative/absolute path based on options.
    // We just need to normalize separators and sort here.
    return calls
        .map(call => {
            let p = call[0]; // The path string logged by the traverser

            // Check if p is a string before normalizing
            if (typeof p !== 'string') {
                // Handle cases where console.log might have been called with non-strings
                // (e.g., during debugging), although it shouldn't happen in normal operation.
                // You might want to return a placeholder, filter it out, or throw an error.
                console.warn(`normalizeAndSort encountered non-string log: ${p}`);
                return ''; // Return empty string or handle as appropriate
            }


            // Normalize path separators etc.
            p = path.normalize(p);
            // Ensure consistent forward slashes for comparison across platforms
            p = p.replace(/\\/g, '/');

            // If the original path was empty string (e.g., from a relative calc), represent as '.'
            // (The traverser should already be logging '.', but this is a safeguard)
            if (p === '') {
                return '.';
            }

            return p;
        })
        .filter(p => p !== '') // Filter out any empty strings from non-string logs
        .sort();
};
// --- END FIX ---


// Runner function
export const runTraverse = async (
    startPath: string, // Allow specifying a start path different from testDir base
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    // --- START FIX: Refactored options handling ---
    const hardcodedDefaults = ['node_modules', '.git'];

    // Combine hardcoded defaults with any excludes explicitly passed in test options
    const combinedExcludes = [
        ...hardcodedDefaults,
        ...(options.excludePatterns || []) // Add excludes specifically from the test options
    ];
    const uniqueCombinedExcludes = [...new Set(combinedExcludes)];

    // Base options for the traverser, excluding the ones we'll specifically set/override
    // Use defaults that mirror the CLI behavior if not provided in options
    const baseOptions: Omit<TraverseOptions, 'excludePatterns' | 'defaultExcludes' | 'includePatterns' | 'relativePaths'> = {
        matchType: options.matchType === undefined ? null : options.matchType, // Explicitly handle null
        maxDepth: options.maxDepth ?? Number.MAX_SAFE_INTEGER,
        ignoreCase: options.ignoreCase ?? false,
    };

     // Final options passed to the traverser constructor
     const finalOptions: TraverseOptions = {
         ...baseOptions, // Start with base non-conflicting options
         // Apply test-specific options that should override baseOptions if present
         includePatterns: options.includePatterns ?? ['*'], // Default to '*' if not specified
         relativePaths: options.relativePaths ?? false, // Default to absolute paths
         // --- Crucial part for exclude logic ---
         excludePatterns: uniqueCombinedExcludes, // Use the combined list for actual exclusion filtering
         defaultExcludes: hardcodedDefaults, // ALWAYS pass the hardcoded defaults for the override logic check
         // Pass other options directly if they exist in the 'options' object
         ...(options.matchType !== undefined && { matchType: options.matchType }),
         ...(options.maxDepth !== undefined && { maxDepth: options.maxDepth }),
         ...(options.ignoreCase !== undefined && { ignoreCase: options.ignoreCase }),
     };
    // --- END FIX ---

    // Use the provided startPath to determine the basePath for the traverser instance.
    const absoluteBasePath = path.resolve(startPath);

    const traverser = new DirectoryTraverser(finalOptions, absoluteBasePath);
    // Start the actual traversal from the absoluteBasePath
    await traverser.traverse(absoluteBasePath);

    // Normalize the results from the spy
    return normalizeAndSort(consoleLogSpy.mock.calls);
};

// Convenience runner for relative paths
export const runTraverseRelative = async (
    startPath: string, // Allow specifying start path
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    // Ensure relativePaths: true is passed correctly
    // runTraverse will handle merging other options and defaults
    return await runTraverse(startPath, consoleLogSpy, { ...options, relativePaths: true });
};
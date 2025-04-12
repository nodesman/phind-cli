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
    'Capitals.TXT': 'case test', // Removed leading space
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
        'image.JPG': 'uppercase jpg',
        'image.jpg': 'lowercase jpg' // Added missing file
    },
    '.git': { 'config': 'git config', 'HEAD': 'ref: refs/heads/main' },
    'node_modules': { 'some_package': { 'index.js': 'code' } },
    'emptyDir': null,
    'dir with spaces': { 'file inside spaces.txt': 'space content' },
    'unreadable_dir': {}
};

// ... rest of the helper file remains the same ...

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
        // Use the original (potentially unresolved) path reference if chmod needs it,
        // although testDir passed in *should* be the resolved one from setup.
        await fs.chmod(path.join(testDir, 'unreadable_dir'), 0o755);
    } catch (e) { /* Ignore */ }
    await fs.remove(testDir);
    spies.consoleLogSpy.mockRestore();
    spies.consoleErrorSpy.mockRestore();
}

// Helper to normalize and sort output paths
export const normalizeAndSort = (calls: any[][], relative: boolean, basePath?: string): string[] => {
    // If relative is true, we need the basePath to correctly calculate relative paths
    if (relative && !basePath) {
        throw new Error("basePath is required for relative path normalization");
    }
    return calls
        .map(call => {
            let p = path.normalize(call[0]);
            if (relative && basePath) {
                 // Calculate relative path from the provided base path
                 p = path.relative(basePath, p);
                 // Ensure consistent forward slashes for relative paths
                 p = p.replace(/\\/g, '/');
                 // If the path is the base path itself, represent it as '.'
                 if (p === '') p = '.';
            } else if (!relative) {
                 // For absolute paths, just normalize separators for consistency if needed
                 p = p.replace(/\\/g, '/');
            }
            return p;
        })
        .sort();
};


// Runner function
export const runTraverse = async (
    startPath: string, // Allow specifying a start path different from testDir base
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    // Define defaults common across tests, matching PhindConfig hardcoded defaults
    const hardcodedDefaults = ['node_modules', '.git'];

    // Start with base defaults for TraverseOptions
    const baseOptions: TraverseOptions = {
        includePatterns: ['*'], // Default include pattern
        excludePatterns: [],    // Base exclude list (will be combined)
        matchType: null,
        maxDepth: Number.MAX_SAFE_INTEGER,
        ignoreCase: false,
        relativePaths: false, // Default to absolute for base runner
        defaultExcludes: hardcodedDefaults, // Pass the *actual* defaults separately
    };

    // Merge user options from the test, allowing overrides of base defaults AND defaultExcludes itself
    const mergedOptions = { ...baseOptions, ...options };

    // Calculate effective excludes *like PhindConfig would*
    const effectiveExcludes = [
        ...(mergedOptions.defaultExcludes || []), // Use the defaults specified in mergedOptions
        ...(options.excludePatterns || [])      // Add any *specific* exclude patterns from the test call
    ];

    // Final options to pass to traverser
    const finalOptions: TraverseOptions = {
        ...mergedOptions,
        excludePatterns: effectiveExcludes,
        defaultExcludes: mergedOptions.defaultExcludes || [],
    };

    // Use the provided startPath to determine the basePath for the traverser instance.
    // The traverser needs the base path *relative to which* patterns and relative output should be calculated.
    // Usually, this is the initial startPath of the whole operation.
    const absoluteBasePath = path.resolve(startPath);

    const traverser = new DirectoryTraverser(finalOptions, absoluteBasePath);
    // Start the actual traversal from the (potentially different) startPath
    await traverser.traverse(absoluteBasePath);

    // Normalize based on the determined absoluteBasePath if paths are relative
    const basePathForNormalization = finalOptions.relativePaths ? absoluteBasePath : undefined;
    return normalizeAndSort(consoleLogSpy.mock.calls, finalOptions.relativePaths, basePathForNormalization);
};


// Convenience runner for relative paths
export const runTraverseRelative = async (
    startPath: string, // Allow specifying start path
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    // Ensure relativePaths: true is passed correctly
    return await runTraverse(startPath, consoleLogSpy, { ...options, relativePaths: true });
};
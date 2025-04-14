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
        // 'image.JPG': 'uppercase jpg', // <<< KEEP COMMENTED OR REMOVE
        'image_upper.JPG': 'uppercase jpg', // <<< USE THIS UNIQUE NAME
        'image.jpg': 'lowercase jpg' // Added missing file
    },
    '.git': { 'config': 'git config', 'HEAD': 'ref: refs/heads/main' },
    'node_modules': { 'some_package': { 'index.js': 'code' } },
    '.gradle': { 'caches': { 'modules-2': { 'files-2.1': {} } }, 'wrapper': { 'gradle-wrapper.jar': '' } },
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

// Helper to normalize and sort output paths from spy calls
export const normalizeAndSort = (calls: any[][]): string[] => {
    return calls
        .map(call => {
            let p = call[0]; // The path string logged by the traverser

            // Check if p is a string before normalizing
            if (typeof p !== 'string') {
                console.warn(`normalizeAndSort encountered non-string log: ${p}`);
                return ''; // Return empty string or handle as appropriate
            }

            // --- REMOVED path.normalize(p) ---

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


// --- START: Helper Refactoring ---

// Base runner function - implements the core logic
const runTraverseBase = async (
    startPath: string,
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> & { relativePathsOverride?: boolean } // Allow override for specific tests
): Promise<string[]> => {
    const hardcodedDefaults = ['node_modules', '.git', '.gradle'];

    // Determine the final relativePaths setting
    const relativePaths = options.relativePathsOverride ?? true; // Default to RELATIVE now

    // Combine hardcoded defaults with any excludes explicitly passed in test options
    const combinedExcludes = [
        ...hardcodedDefaults,
        ...(options.excludePatterns || [])
    ];
    const uniqueCombinedExcludes = [...new Set(combinedExcludes)];

    const finalOptions: TraverseOptions = {
        includePatterns: options.includePatterns ?? ['*'],
        excludePatterns: uniqueCombinedExcludes,
        matchType: options.matchType === undefined ? null : options.matchType,
        maxDepth: options.maxDepth ?? Number.MAX_SAFE_INTEGER,
        ignoreCase: options.ignoreCase ?? false,
        relativePaths: relativePaths, // Use the determined value
        defaultExcludes: hardcodedDefaults,
    };

    const absoluteBasePath = path.resolve(startPath);
    const traverser = new DirectoryTraverser(finalOptions, absoluteBasePath);
    await traverser.traverse(absoluteBasePath);

    return normalizeAndSort(consoleLogSpy.mock.calls);
};

// NEW Default Runner (Relative Paths) - replaces old runTraverseRelative
export const runTraverse = async (
    startPath: string,
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    // Ensures relativePaths: true unless explicitly overridden in options
    // This aligns with the new default behavior of the CLI.
    return await runTraverseBase(startPath, consoleLogSpy, { ...options, relativePathsOverride: options.relativePaths ?? true });
};

// NEW Absolute Path Runner - replaces old runTraverse
export const runTraverseAbsolute = async (
    startPath: string,
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    // Force relativePaths: false
    return await runTraverseBase(startPath, consoleLogSpy, { ...options, relativePathsOverride: false });
};

// --- END: Helper Refactoring ---
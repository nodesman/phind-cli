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
    ' Capitals.TXT': 'case test',
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
        'image.JPG': 'uppercase jpg'
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

    return { testDir, consoleLogSpy, consoleErrorSpy };
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
export const normalizeAndSort = (calls: any[][], relative: boolean): string[] => {
    return calls
        .map(call => {
            let p = path.normalize(call[0]);
            if (relative) {
                p = p.replace(/\\/g, '/'); // Ensure forward slashes for relative paths consistency
                if (p === '' && call[0] === '.') p = '.'; // Handle base dir '.' correctly
            }
            return p;
        })
        .sort();
};

// Runner function
export const runTraverse = async (
    testDir: string,
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    const defaultOptions: TraverseOptions = {
        includePatterns: ['*'],
        excludePatterns: [], // Keep explicitly empty unless overridden
        matchType: null,
        maxDepth: Number.MAX_SAFE_INTEGER,
        ignoreCase: false,
        relativePaths: false, // Default to absolute for base runner
        basePath: testDir,
        ...options,
    };
    const traverser = new DirectoryTraverser(defaultOptions);
    await traverser.traverse(testDir);

    return normalizeAndSort(consoleLogSpy.mock.calls, defaultOptions.relativePaths);
};

// Convenience runner for relative paths
export const runTraverseRelative = async (
    testDir: string,
    consoleLogSpy: jest.SpyInstance,
    options: Partial<TraverseOptions> = {}
): Promise<string[]> => {
    return await runTraverse(testDir, consoleLogSpy, { ...options, relativePaths: true });
};
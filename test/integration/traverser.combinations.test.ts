// test/integration/traverser.combinations.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

describe('DirectoryTraverser - Option Combinations', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    // Exclude Priority already tested in exclude.test.ts
    // it('should handle overlapping include and exclude patterns correctly (exclude takes priority)');
    it('should find specific file types within a certain depth (type=f, maxDepth=1) (relative)', async () => {
         const expected = [
            // '.' is not a file
            '.hiddenfile',
            ' Capitals.TXT',
            'file1.txt',
            'file2.log',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { matchType: 'f', maxDepth: 1 });
        expect(results).toEqual(expected);
    });

    it('should find specific directory types within a certain depth (type=d, maxDepth=1) (relative)', async () => {
        const expected = [
            '.',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'unreadable_dir',
            '.hiddenDir'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { matchType: 'd', maxDepth: 1, excludePatterns: ['node_modules', '.git'] });
        expect(results).toEqual(expected);
    });

    it('should exclude patterns only up to a certain depth (exclude *.log, maxDepth=1)', async () => {
       const expected = [
            '.', // Start dir
            '.git',
            '.hiddenDir',
            '.hiddenfile',
            ' Capitals.TXT',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'file1.txt',
            // 'file2.log' Excluded at depth 1
            'node_modules',
            'unreadable_dir',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'], maxDepth: 1 });
        expect(results).toEqual(expected);
    });

    it('should include patterns only up to a certain depth (include *.txt, maxDepth=1)', async () => {
         // Only '.txt' files at depth 0 or 1. Case-insensitive due to ignoreCase: true
         // '.' is depth 0 but not a file and doesn't match '*.txt'
         // ' Capitals.TXT' is depth 1 and matches '*.txt' case-insensitively
         // 'file1.txt' is depth 1 and matches '*.txt'
        const expected = [
            ' Capitals.TXT', // Included due to ignoreCase: true
            'file1.txt',
        ].sort();
        // Add ignoreCase: true to match the likely intent of including ' Capitals.TXT'
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], maxDepth: 1, ignoreCase: true });
        expect(results).toEqual(expected);
    });

    it('should handle include, exclude, type, and depth simultaneously (absolute)', async () => {
         // Find only .txt files (case-insensitive) NOT in dir1, up to depth 2
        const expected = [
            path.join(testDir, ' Capitals.TXT'),
            path.join(testDir, 'file1.txt'),
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, {
            includePatterns: ['**/*.txt'],
            excludePatterns: [path.join(testDir, 'dir1')], // Exclude dir1 entirely
            matchType: 'f',
            maxDepth: 2,
            ignoreCase: true
         });
        expect(results).toEqual(expected);
    });

    it('should handle include, exclude, type, and depth simultaneously (relative)', async () => {
         // Find only .txt files (case-insensitive) NOT in dir1, up to depth 2
        const expected = [
            // MaxDepth 1
            ' Capitals.TXT',
            'file1.txt',
            // MaxDepth 2
            '.hiddenDir/insideHidden.txt',
            'dir with spaces/file inside spaces.txt',
            // 'dir1/file3.txt' is excluded by pattern 'dir1'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['**/*.txt'],
            excludePatterns: ['dir1'], // Exclude dir1 entirely
            matchType: 'f',
            maxDepth: 2,
            ignoreCase: true
         });
        expect(results).toEqual(expected);
    });

    it('should handle ignoreCase combined with include patterns and type filter', async () => {
       const expected = [
            'dir2/image.JPG'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['*.jpg'],
            matchType: 'f',
            ignoreCase: true
        });
        expect(results).toEqual(expected);
    });

    it('should handle ignoreCase combined with exclude patterns and depth limit', async () => {
        const expected = [
            '.',
            // ' Capitals.TXT' is excluded by 'capitals.txt' + ignoreCase: true
            '.git',
            '.hiddenDir',
            '.hiddenfile',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'file1.txt', // Not excluded
            'file2.log', // Not excluded
            'node_modules',
            'unreadable_dir',
        ].sort();

        // Exclude 'capitals.txt' (lowercase), ignoreCase=true, maxDepth=1
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            excludePatterns: ['capitals.txt'],
            maxDepth: 1,
            ignoreCase: true,
        });
        expect(results).toEqual(expected);
    });

    it('should handle ignoreCase combined with pruning logic', async () => {
       const expected = [
            '.', // Starting dir
            '.git', // Default exclude applied by helper
            // .git contents should be excluded by default (helper combines now)
            '.hiddenDir',
            // .hiddenDir contents included unless excluded otherwise
            '.hiddenfile',
            // ' Capitals.TXT', // Included by default *
            'dir with spaces',
            // dir with spaces contents included unless excluded otherwise
            'dir2',
            // dir2 contents included unless excluded otherwise
            'emptyDir',
            'file1.txt',
            'file2.log',
            'node_modules',
            'unreadable_dir',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1'], ignoreCase: true });
        // The helper now combines default excludes, so .git/* and node_modules/* should not be present
        expect(results).toEqual(expected);
    });

    it('should correctly prune case-insensitively when ignoreCase=true', async () => {
        const expected = [
           '.',
           '.git', // Default exclude applied by helper
            // .git contents should be excluded by default (helper combines now)
           '.hiddenDir',
            '.hiddenfile',
            'dir with spaces',
            'dir2',
           'emptyDir',
            'file1.txt',
            'file2.log',
            'node_modules',
            'unreadable_dir',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['dIr1'], ignoreCase: true });
        expect(results).toEqual(expected);
    });

    it('should find files excluding specific directories up to depth 2 (relative, type=f, exclude dir2)', async () => {
         // MaxDepth 2 includes depth 0, 1, 2
         // matchType 'f' means only files
         // excludePatterns 'dir2' prunes dir2
         // Default excludes (.git, node_modules) applied by helper
         const expected = [
            // Depth 1 files:
            '.hiddenfile',
            ' Capitals.TXT',
            'file1.txt',
            'file2.log',

            // Depth 2 files (excluding dir2 contents and default excluded dirs):
            '.hiddenDir/insideHidden.txt',
            'dir with spaces/file inside spaces.txt',
            'dir1/exclude_me.tmp',
            'dir1/file3.txt',
            'dir1/file6.data',
            // dir1/subDir1/file4.js is depth 3
            // dir2/** is pruned
        ].sort();

        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['*'], // Default include needed to find items
            excludePatterns: ['dir2'], // Explicitly prune dir2
            matchType: 'f',
            maxDepth: 2
        });
         expect(results).toEqual(expected);
    });

    it('should find directories excluding those matching sub-patterns (relative, type=d)', async () => {
         // Find directories ONLY (type=d)
         // Exclude hidden dirs/files (**/.*) and files starting with 'file' (**/file*)
         // Default excludes (.git, node_modules) are applied by helper
         const expected = [
            '.',
            // '.hiddenDir', // Excluded by **/.*
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            // 'node_modules', // Excluded by default
            'unreadable_dir',
         ].sort();
         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['*'], // Need '*' to potentially match directories
            excludePatterns: ['**/.*', '**/file*'], // Exclude hidden and 'file*' items
            matchType: 'd' // Only directories
         });
         expect(results).toEqual(expected);
    });
});
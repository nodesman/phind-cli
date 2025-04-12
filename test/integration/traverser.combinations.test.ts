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
         const expected = [
            '.',
            '.git',
            '.hiddenDir',
            '.hiddenfile',
            ' Capitals.TXT',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'file1.txt',
            'file2.log',
            'node_modules',
            'unreadable_dir',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], maxDepth: 1 });
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
            '.git',
            '.hiddenDir',
            '.hiddenfile',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'file1.txt',
            'node_modules',
            'unreadable_dir',
        ].sort();

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
            '.git',
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
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1'], ignoreCase: true });
        expect(results).toEqual(expected);
    });

    it('should correctly prune case-insensitively when ignoreCase=true', async () => {
        const expected = [
           '.',
            '.git',
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

    it('should find files excluding specific directories up to a certain depth using CLI options', async () => {
         const expected = [
            // MaxDepth 1 - all of these
            '.hiddenfile',
            ' Capitals.TXT',
            'dir with spaces',
            'file1.txt',
            'file2.log',

            // MaxDepth 2 - contents *not* under excluded dir2 (it's pruned)
            '.hiddenDir/insideHidden.txt',
            'dir with spaces/file inside spaces.txt',
        ].sort();

        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['**/*'],
            excludePatterns: ['dir2'], // Prune dir2
            matchType: 'f',
            maxDepth: 2
        });
         expect(results).toEqual(expected);
    });

    it('should find directories matching a pattern, excluding sub-patterns', async () => {
         // Find directories ONLY
         // Matching pattern: all dirs
         // Exclude all subfiles/subdirs
         const expected = [
            '.',
            '.hiddenDir',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'node_modules',
            'unreadable_dir',
        ].sort();
         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['**/'], // Try match all dirs
            excludePatterns: ['**/.*', '**/file*'],
            matchType: 'd'
         });
        expect(results).toEqual(expected);
    });
});
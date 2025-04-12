// test/integration/traverser.include.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

describe('DirectoryTraverser - Include Patterns (--name)', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    it('should include only files matching a simple glob pattern (*.txt) (absolute)', async () => {
        const expected = [
            path.join(testDir, 'Capitals.TXT'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include only files matching a simple glob pattern (*.txt) (relative)', async () => {
        const expected = [
            '.hiddenDir/insideHidden.txt',
            ' Capitals.TXT', // Case sensitive by default
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'file1.txt',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include only items matching multiple glob patterns (*.txt, *.js) (absolute)', async () => {
        const expected = [
            path.join(testDir, 'Capitals.TXT'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'),
            path.join(testDir, 'file1.txt'),
            path.join(testDir, 'node_modules', 'some_package', 'index.js'),
        ].sort();

        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include only items matching multiple glob patterns (*.txt, *.js) (relative)', async () => {
        const expected = [
            '.hiddenDir/insideHidden.txt',
            ' Capitals.TXT',
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'dir1/subDir1/file4.js',
            'file1.txt',
            'node_modules/some_package/index.js',
        ].sort();

        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include items matching a pattern with case sensitivity by default (absolute)', async () => {
        const expected = [
             path.join(testDir, 'file1.txt'),
             path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
             path.join(testDir, 'dir1', 'file3.txt'),
        ];
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expect.arrayContaining(expected));
         expect(results).not.toContain(path.join(testDir, 'Capitals.TXT')); // excluded due to default case sensitivity

    });

    it('should include items matching a pattern with case sensitivity by default (relative)', async () => {
        const expected = [
            'file1.txt',
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
        ];
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results).not.toContain(' Capitals.TXT');
    });

    it('should include items matching a pattern ignoring case when ignoreCase=true (absolute)', async () => {
        const expected = [
            path.join(testDir, 'Capitals.TXT'), // Now included
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include items matching a pattern ignoring case when ignoreCase=true (relative)', async () => {
        const expected = [
            ' Capitals.TXT', // Now included
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'file1.txt',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include hidden files/dirs when pattern explicitly matches them (.*) (absolute)', async () => {
        const expected = [
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenfile'),
            path.join(testDir, '.git'),
        ].sort();
         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
        const expected = [
            '.',
            '.git',
            '.hiddenDir',
            '.hiddenfile',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (absolute)', async () => {
        const expected = [
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, '.hiddenfile'),
             path.join(testDir, 'dir1', 'subDir1', '.hiddensub'),
             path.join(testDir, '.git'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (relative)', async () => {
        const expected = [
            '.git', // Directory itself
            '.hiddenDir', // Directory itself
            '.hiddenDir/insideHidden.txt',
            '.hiddenfile',
            'dir1/subDir1/.hiddensub'
        ].sort();
        // Globstar `**` combined with `.` pattern
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include items based on matching the full absolute path', async () => {
         const targetPath = path.join(testDir, 'dir1', 'file3.txt');
         const expected = [targetPath];

         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: [targetPath] });
         expect(results).toEqual(expect.arrayContaining(expected));
         expect(results.length).toEqual(expected.length);
    });

     it('should include items based on matching the full relative path', async () => {
        const targetPath = 'dir1/file3.txt';
        const expected = [targetPath];
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: [targetPath] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
     });

    it('should include items within a specific subdirectory using ** (dir1/**) (absolute)', async () => {
        const expected = [
            path.join(testDir, 'dir1', 'exclude_me.tmp'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'file6.data'),
            path.join(testDir, 'dir1', 'subDir1'), // The subDir itself
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'),
            path.join(testDir, 'dir1', 'subDir1', 'another.log'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['dir1/**'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include items within a specific subdirectory using ** (dir1/**) (relative)', async () => {
        const expected = [
            'dir1/exclude_me.tmp',
            'dir1/file3.txt',
            'dir1/file6.data',
            'dir1/subDir1', // The subDir itself
            'dir1/subDir1/.hiddensub',
            'dir1/subDir1/another.log',
            'dir1/subDir1/file4.js',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['dir1/**'] });
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should include the directory itself when using a pattern like dir1/**', async () => {
         const expected = [
            path.join(testDir, 'dir1'), // The dir1
            path.join(testDir, 'dir1', 'exclude_me.tmp'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'file6.data'),
            path.join(testDir, 'dir1', 'subDir1'), // The subDir itself
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'),
            path.join(testDir, 'dir1', 'subDir1', 'another.log'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'),
        ].sort();
         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: [path.join(testDir, 'dir1'), 'dir1/**'] }); // Dir1 needs its own include
        expect(results).toEqual(expect.arrayContaining(expected));
        expect(results.length).toEqual(expected.length);
    });

    it('should NOT include items if the include pattern does not match anything', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.nonexistent'] });
        expect(results).toEqual([]);
    });

    it('should include items matching the base name', async () => {
        const expected = [
            path.join(testDir, 'file1.txt'),
        ];
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['file1.txt'] });
        expect(results).toEqual(expect.arrayContaining(expected));
    });
});
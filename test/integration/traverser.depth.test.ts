// test/integration/traverser.depth.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

describe('DirectoryTraverser - Depth Limiting (--maxdepth)', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    it('should find only the starting item when maxDepth=0 (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 0 });
        expect(results).toEqual([testDir]);
    });

    it('should find only the starting item "." when maxDepth=0 (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 0 });
        expect(results).toEqual(['.']);
    });

    it('should find items only at depth 0 and 1 when maxDepth=1 (absolute)', async () => {
        const expected = [
            path.join(testDir, '.git'),
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenfile'),
            path.join(testDir, ' Capitals.TXT'),
            path.join(testDir, 'dir with spaces'),
            path.join(testDir, 'dir1'),
            path.join(testDir, 'dir2'),
            path.join(testDir, 'emptyDir'),
            path.join(testDir, 'file1.txt'),
            path.join(testDir, 'file2.log'),
            path.join(testDir, 'node_modules'),
            path.join(testDir, 'unreadable_dir'),
            testDir
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).toEqual(expected);
    });

    it('should find items only at depth 0 and 1 when maxDepth=1 (relative)', async () => {
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
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).toEqual(expected);
    });

    it('should find items up to the specified maxDepth (e.g., 2) (absolute)', async () => {
        const expected = [
            path.join(testDir, '.git'),
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, '.hiddenfile'),
            path.join(testDir, ' Capitals.TXT'),
            path.join(testDir, 'dir with spaces'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1'),
            path.join(testDir, 'dir2'),
            path.join(testDir, 'emptyDir'),
            path.join(testDir, 'file1.txt'),
            path.join(testDir, 'file2.log'),
            path.join(testDir, 'node_modules'),
            path.join(testDir, 'unreadable_dir'),
            path.join(testDir, 'dir1', 'exclude_me.tmp'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'file6.data'),
            path.join(testDir, 'dir1', 'subDir1'),
            testDir
        ].sort();

        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 2 });
        expect(results).toEqual(expected);
    });

    it('should find items up to the specified maxDepth (e.g., 2) (relative)', async () => {
        const expected = [
            '.',
            '.git',
            '.hiddenDir',
            '.hiddenDir/insideHidden.txt',
            '.hiddenfile',
            ' Capitals.TXT',
            'dir with spaces',
            'dir with spaces/file inside spaces.txt',
            'dir1',
            'dir2',
            'emptyDir',
            'file1.txt',
            'file2.log',
            'node_modules',
            'unreadable_dir',
            'dir1/exclude_me.tmp',
            'dir1/file3.txt',
            'dir1/file6.data',
            'dir1/subDir1',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 2 });
        expect(results).toEqual(expected);
    });

    it('should find all items if maxDepth is greater than actual depth (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 100 });
        expect(results.length).toBeGreaterThan(10); //Arbitrary assertion to avoid listing all results
    });

    it('should find all items if maxDepth is Infinity/MAX_SAFE_INTEGER (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: Number.MAX_SAFE_INTEGER });
         expect(results.length).toBeGreaterThan(10);
    });

    it('should find all items if maxDepth is Infinity/MAX_SAFE_INTEGER (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: Number.MAX_SAFE_INTEGER });
         expect(results.length).toBeGreaterThan(10);
    });

    it('should not print items deeper than maxDepth', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).not.toContain('dir1/subDir1/file4.js');
    });

    it('should stop recursing into directories when currentDepth equals maxDepth', async () => {
        //To accurately test if the algorithm stops recursing, mock fs.readdir
        const originalReaddir = require('fs-extra').readdir;
        const readdirMock = jest.spyOn(require('fs-extra'), 'readdir');

        readdirMock.mockImplementation((dir: any, options: any) => {
            //Only allow readdir to be called in the testDir and its direct children
            if (dir === testDir || Object.keys(testStructure['dir1']).map(item => path.join(testDir, 'dir1', item)).includes(dir)
                || Object.keys(testStructure).filter(item => typeof testStructure[item] === 'object' && testStructure[item] !== null).map(item => path.join(testDir, item)).includes(dir))
                return originalReaddir(dir, options)

            return Promise.resolve([])
        });
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results.length).toBeGreaterThan(5)
        readdirMock.mockRestore()
    });
});
// test/integration/traverser.depth.test.ts
import path from 'path';
import fs from 'fs-extra'; // Import fs-extra for mocking readdir
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative, testStructure } from './traverser.helper'; // Import testStructure

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
        // Helper now correctly applies default excludes
        const expected = [
            // path.join(testDir, '.git'), // Excluded by default
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenfile'),
            path.join(testDir, ' Capitals.TXT'),
            path.join(testDir, 'dir with spaces'),
            path.join(testDir, 'dir1'),
            path.join(testDir, 'dir2'),
            path.join(testDir, 'emptyDir'),
            path.join(testDir, 'file1.txt'),
            path.join(testDir, 'file2.log'),
            // path.join(testDir, 'node_modules'), // Excluded by default
            path.join(testDir, 'unreadable_dir'),
            testDir
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).toEqual(expected);
    });

    it('should find items only at depth 0 and 1 when maxDepth=1 (relative)', async () => {
         // Helper now correctly applies default excludes
        const expected = [
            '.',
            // '.git', // Excluded by default
            '.hiddenDir',
            '.hiddenfile',
            ' Capitals.TXT',
            'dir with spaces',
            'dir1',
            'dir2',
            'emptyDir',
            'file1.txt',
            'file2.log',
            // 'node_modules', // Excluded by default
            'unreadable_dir',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).toEqual(expected);
    });

    it('should find items up to the specified maxDepth (e.g., 2) (absolute)', async () => {
         // Helper now correctly applies default excludes
        const expected = [
            // path.join(testDir, '.git'), // Excluded by default
            // path.join(testDir, '.git', 'config'), // Excluded by default
            // path.join(testDir, '.git', 'HEAD'), // Excluded by default
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
            // path.join(testDir, 'node_modules'), // Excluded by default
            // path.join(testDir, 'node_modules', 'some_package'), // Excluded by default
            // path.join(testDir, 'node_modules', 'some_package', 'index.js'), // Excluded by default
            path.join(testDir, 'unreadable_dir'),
            path.join(testDir, 'dir1', 'exclude_me.tmp'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'file6.data'),
            path.join(testDir, 'dir1', 'subDir1'),
            // Contents of dir2 are at depth 2
            path.join(testDir, 'dir2', 'file5.log'),
            path.join(testDir, 'dir2', 'image.JPG'),
            path.join(testDir, 'dir2', 'image.jpg'),
            testDir // Base dir itself
        ].sort();

        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 2 });
        expect(results).toEqual(expected);
    });

    it('should find items up to the specified maxDepth (e.g., 2) (relative)', async () => {
        // Helper now correctly applies default excludes
        const expected = [
            '.',
            // '.git', // Excluded by default
            // '.git/config', // Excluded by default
            // '.git/HEAD', // Excluded by default
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
            // 'node_modules', // Excluded by default
            // 'node_modules/some_package', // Excluded by default
            // 'node_modules/some_package/index.js', // Excluded by default
            'unreadable_dir',
            'dir1/exclude_me.tmp',
            'dir1/file3.txt',
            'dir1/file6.data',
            'dir1/subDir1',
            // Contents of dir2 are at depth 2
            'dir2/file5.log',
            'dir2/image.JPG',
            'dir2/image.jpg',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 2 });
        expect(results).toEqual(expected);
    });

    it('should find all items if maxDepth is greater than actual depth (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 100 });
        // Check a deep file exists, confirming recursion went deep
        expect(results).toContain(path.join(testDir, 'dir1', 'subDir1', 'file4.js'));
        // Expect count to be greater than depth 2 count (adjust based on actual full structure count)
        expect(results.length).toBeGreaterThan(20); // Adjust count based on final structure and excludes
    });

    it('should find all items if maxDepth is Infinity/MAX_SAFE_INTEGER (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: Number.MAX_SAFE_INTEGER });
        expect(results).toContain(path.join(testDir, 'dir1', 'subDir1', 'file4.js'));
         expect(results.length).toBeGreaterThan(20); // Adjust count
    });

    it('should find all items if maxDepth is Infinity/MAX_SAFE_INTEGER (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: Number.MAX_SAFE_INTEGER });
        expect(results).toContain('dir1/subDir1/file4.js');
         expect(results.length).toBeGreaterThan(20); // Adjust count
    });

    it('should not print items deeper than maxDepth', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).not.toContain('dir1/subDir1/file4.js'); // Depth 3
        expect(results).not.toContain('.hiddenDir/insideHidden.txt'); // Depth 2
    });

    it('should stop recursing into directories when currentDepth equals maxDepth', async () => {
        // This test tries to verify that readdir isn't called unnecessarily deep.
        const originalReaddir = fs.readdir; // Use the actual fs.readdir
        const readdirMock = jest.spyOn(fs, 'readdir');

        // Mock implementation - Check path depth relative to testDir
        readdirMock.mockImplementation(async (dirPath: fs.PathLike, options?: any): Promise<string[] | Buffer[] | fs.Dirent[]> => {
            const relativePath = path.relative(testDir, dirPath.toString());
            const depth = relativePath === '' ? 0 : relativePath.split(path.sep).length;

            // If depth is 2 (meaning we are *inside* a depth 1 directory like dir1),
            // readdir should NOT be called if maxDepth is 1.
            if (depth >= 2) { // >= maxDepth + 1
                throw new Error(`readdir called on directory too deep: ${dirPath} (depth ${depth}) with maxDepth 1`);
            }
            // Allow calls for depth 0 and 1
            return originalReaddir(dirPath, options); // Call the original function
        });

        // Run the traversal with maxDepth 1
        await expect(runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 }))
            .resolves // Expect it to complete without throwing the error from the mock
            .not.toThrow();

        // Verify readdir was called on the root and potentially depth 1 dirs
        expect(readdirMock).toHaveBeenCalledWith(expect.stringContaining(testDir), expect.anything()); // Called on root
        expect(readdirMock).toHaveBeenCalledWith(expect.stringContaining(path.join(testDir, 'dir1')), expect.anything()); // May be called on depth 1 dirs

        // Check it wasn't called on a depth 2 directory
        expect(readdirMock).not.toHaveBeenCalledWith(expect.stringContaining(path.join(testDir, 'dir1', 'subDir1')), expect.anything());

        readdirMock.mockRestore(); // Clean up the mock
    });
});
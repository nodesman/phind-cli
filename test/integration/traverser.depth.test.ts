// test/integration/traverser.depth.test.ts
import path from 'path';
import fs from 'fs-extra'; // Import fs-extra for mocking readdir
// --- FIX 1: Import promises API specifically for mocking ---
import fsPromises from 'fs/promises';
// --- FIX 2: Import types from 'fs', not 'fs/promises' ---
import type { Dirent, PathLike, ObjectEncodingOptions } from 'fs';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative, testStructure } from './traverser.helper';

describe('DirectoryTraverser - Depth Limiting (--maxdepth)', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
        jest.restoreAllMocks(); // Ensure mocks are restored after each test
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
            path.join(testDir, 'dir2', 'file5.log'),
            // path.join(testDir, 'dir2', 'image.JPG'), // <-- Changed name in helper
            path.join(testDir, 'dir2', 'image_upper.JPG'), // <-- Use unique name
            path.join(testDir, 'dir2', 'image.jpg'),
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
            'dir2/file5.log',
            // 'dir2/image.JPG', // <-- Changed name in helper
            'dir2/image_upper.JPG', // <-- Use unique name
            'dir2/image.jpg',
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
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 2 });
        expect(results).toEqual(expected);
    });

    it('should find all items if maxDepth is greater than actual depth (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: 100 });
        // Check a deep file exists, confirming recursion went deep
        expect(results).toContain(path.join(testDir, 'dir1', 'subDir1', 'file4.js'));
        // Adjust count based on final structure (testStructure) and default excludes
        const totalExpectedCount = 25; // Manually count items in testStructure excluding node_modules/* and .git/* contents
        expect(results.length).toBe(totalExpectedCount);
    });

    it('should find all items if maxDepth is Infinity/MAX_SAFE_INTEGER (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { maxDepth: Number.MAX_SAFE_INTEGER });
        expect(results).toContain(path.join(testDir, 'dir1', 'subDir1', 'file4.js'));
        const totalExpectedCount = 25; // As above
        expect(results.length).toBe(totalExpectedCount);
    });

    it('should find all items if maxDepth is Infinity/MAX_SAFE_INTEGER (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: Number.MAX_SAFE_INTEGER });
        expect(results).toContain('dir1/subDir1/file4.js');
        const totalExpectedCount = 25; // As above
        expect(results.length).toBe(totalExpectedCount);
    });

    it('should not print items deeper than maxDepth', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 });
        expect(results).not.toContain('dir1/subDir1/file4.js'); // Depth 3
        expect(results).not.toContain('.hiddenDir/insideHidden.txt'); // Depth 2
    });

    it('should stop recursing into directories when currentDepth equals maxDepth', async () => {
        // This test verifies that readdir isn't called unnecessarily deep.
        const originalReaddir = fsPromises.readdir;

        // Spy on the promises version of readdir, targeting the overload used by the traverser
        const readdirMock = jest.spyOn(fsPromises, 'readdir') as jest.SpyInstance<
            Promise<Dirent[]>, // Return type of the overload
            [path: PathLike, options: ObjectEncodingOptions & { withFileTypes: true }] // Arguments of the overload
        >;

        // Mock implementation - Check path depth relative to testDir
        // --- FIX 3: Update mock signature to match the specific overload being spied on ---
        readdirMock.mockImplementation(async (
            dirPath: PathLike,
            options: ObjectEncodingOptions & { withFileTypes: true } // Match the spy signature's options type
        ): Promise<Dirent[]> => { // Match the spy signature's return type
            const currentPathStr = dirPath.toString(); // Ensure string for path operations
            const relativePath = path.relative(testDir, currentPathStr);
            const depth = relativePath === '' ? 0 : relativePath.split(path.sep).length;

            // If depth is 2 (meaning we are *inside* a depth 1 directory like dir1),
            // readdir should NOT be called if maxDepth is 1.
            if (depth >= 2) { // >= maxDepth + 1
                throw new Error(`readdir called on directory too deep: ${currentPathStr} (depth ${depth}) with maxDepth 1`);
            }

            // Allow calls for depth 0 and 1
            // Call the original *promise* version, ensuring options type matches.
            return originalReaddir(dirPath, options); // Options type now matches
        });

        // Run the traversal with maxDepth 1
        await expect(runTraverseRelative(testDir, spies.consoleLogSpy, { maxDepth: 1 }))
            .resolves // Expect it to complete without throwing the error from the mock
            .not.toThrow();

        // Verify readdir was called on the root and potentially depth 1 dirs
        const expectedOptions = expect.objectContaining({ withFileTypes: true });
        expect(readdirMock).toHaveBeenCalledWith(testDir, expectedOptions); // Called on root
        expect(readdirMock).toHaveBeenCalledWith(path.join(testDir, 'dir1'), expectedOptions); // May be called on depth 1 dirs like dir1

        // Check it wasn't called on a depth 2 directory
        expect(readdirMock).not.toHaveBeenCalledWith(path.join(testDir, 'dir1', 'subDir1'), expectedOptions);

        // No need to call mockRestore here if using jest.restoreAllMocks() in afterEach
    });
});
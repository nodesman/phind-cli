// test/integration/traverser.options.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative, normalizeAndSort } from './traverser.helper'; // Added normalizeAndSort

describe('DirectoryTraverser - Other Options & Error Handling', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    it('should perform case-insensitive matching for includes when ignoreCase=true (absolute)', async () => {
        const expected = [
            path.join(testDir, ' Capitals.TXT'), // Now included due to ignoreCase
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'), // Also match .txt files
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected)); // Now contains case-insensitive match
    });

    it('should perform case-insensitive matching for includes when ignoreCase=true (relative)', async () => {
        const expected = [
            ' Capitals.TXT', // Now included due to ignoreCase
            '.hiddenDir/insideHidden.txt', // Also match .txt files
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'file1.txt',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected)); // Now contains case-insensitive match
    });

    it('should perform case-insensitive matching for excludes when ignoreCase=true (absolute)', async () => {
       // Run once without excludes to get a baseline
       const baselineResults = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
       spies.consoleLogSpy.mockClear(); // Clear spy before the actual test run

       const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.jpg'], ignoreCase: true }); // Note: exclude *.jpg (lowercase)

       // Expect fewer results than baseline
       expect(results.length).toBeLessThan(baselineResults.length);
       // Expect *neither* case to be present due to case-insensitive exclude
       expect(results).not.toContain(path.join(testDir, 'dir2', 'image.JPG'));
       expect(results).not.toContain(path.join(testDir, 'dir2', 'image.jpg'));
    });

     it('should perform case-insensitive matching for excludes when ignoreCase=true (relative)', async () => {
         // Run once without excludes to get a baseline
         const baselineResults = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         spies.consoleLogSpy.mockClear(); // Clear spy before the actual test run

         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.jpg'], ignoreCase: true }); // Note: exclude *.jpg (lowercase)

         // Expect fewer results than baseline
         expect(results.length).toBeLessThan(baselineResults.length);
         // Expect *neither* case to be present due to case-insensitive exclude
         expect(results).not.toContain('dir2/image.JPG');
         expect(results).not.toContain('dir2/image.jpg');
     });

    it('should perform case-insensitive pruning for directories when ignoreCase=true', async () => {
        // Run once without excludes to get a baseline
        const baselineResults = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
        spies.consoleLogSpy.mockClear(); // Clear spy

        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['DIR1'], ignoreCase: true }); // Exclude uppercase name

        // Expect fewer results due to pruning
        expect(results.length).toBeLessThan(baselineResults.length);
        // Expect dir1 and its contents to be gone
        expect(results).not.toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1'));
    });

    it('should log an error to stderr and continue when encountering an unreadable directory (EACCES/EPERM)', async () => {
        await runTraverse(testDir, spies.consoleLogSpy); // Run any traversal that includes unreadable_dir
        expect(spies.consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Permission error reading directory'));
        expect(spies.consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(path.join(testDir, 'unreadable_dir').replace(/\\/g, '/'))); // Normalize slashes for comparison
    });

    it('should NOT list contents of an unreadable directory', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        expect(results).not.toEqual(expect.arrayContaining([
             expect.stringContaining(path.join('unreadable_dir', 'some_file_inside')) // hypothetical
        ]));
    });

    it('should still list the unreadable directory itself if it matches filters before the read error', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        expect(results).toContain(path.join(testDir, 'unreadable_dir'));
    });

    it('should use the basePath correctly for calculating relative paths', async () => {
        // The basePath for relative calculations is the second argument to the DirectoryTraverser constructor,
        // which is implicitly `testDir` in runTraverseRelative.
        // This test verifies that runTraverseRelative produces paths relative to testDir.
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy); // No options needed here to test default behavior

        // Should contain paths relative to testDir
        expect(results).toContain('.');
        expect(results).toContain('file1.txt');
        expect(results).toContain('dir1/file3.txt');
        expect(results).not.toContain(path.join(testDir, 'file1.txt')); // Should not contain absolute

        // Example of testing a custom base path directly (requires modifying test or helper)
        /*
        const { DirectoryTraverser } = require('../../src/traverser'); // Adjust import if needed
        const customBasePath = path.join(testDir, 'dir1');
        const traverser = new DirectoryTraverser({
            includePatterns: ['*'],
            excludePatterns: [],
            matchType: null,
            maxDepth: Number.MAX_SAFE_INTEGER,
            ignoreCase: false,
            relativePaths: true, // Enable relative paths
            defaultExcludes: ['node_modules', '.git'] // Apply defaults if needed
        }, customBasePath); // <-- Pass custom base path here
        spies.consoleLogSpy.mockClear(); // Clear previous calls
        await traverser.traverse(testDir); // Start traversal from testDir
        const calls = spies.consoleLogSpy.mock.calls;
        const relativeResults = normalizeAndSort(calls, true); // Use normalizeAndSort from helper
        // console.log("Relative results from custom base:", relativeResults); // Debug output
        expect(relativeResults).toContain('../file1.txt'); // Example assertion relative to dir1
        expect(relativeResults).toContain('.'); // dir1 relative to itself
        expect(relativeResults).toContain('file3.txt');
        expect(relativeResults).toContain('../dir2/file5.log')
        */
    });
});
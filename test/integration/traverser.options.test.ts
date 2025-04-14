// test/integration/traverser.options.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseAbsolute, normalizeAndSort } from './traverser.helper'; // Updated helper import

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
        // Use new absolute helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected)); // Now contains case-insensitive match
    });

    it('should perform case-insensitive matching for includes when ignoreCase=true (relative)', async () => {
        const expected = [
            './ Capitals.TXT', // Now included due to ignoreCase, prepended ./
            './.hiddenDir/insideHidden.txt', // Prepend ./
            './dir with spaces/file inside spaces.txt', // Prepend ./
            './dir1/file3.txt', // Prepend ./
            './file1.txt', // Prepend ./
        ].sort();
        // Use new default relative helper
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected)); // Now contains case-insensitive match
    });

    it('should perform case-insensitive matching for excludes when ignoreCase=true (absolute)', async () => {
       // Run once without excludes to get a baseline
       const baselineResults = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*'] }); // Use absolute helper
       spies.consoleLogSpy.mockClear(); // Clear spy before the actual test run

       const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['*.jpg'], ignoreCase: true }); // Note: exclude *.jpg (lowercase) // Use absolute helper

       // Expect fewer results than baseline
       expect(results.length).toBeLessThan(baselineResults.length);
       // Expect *neither* case to be present due to case-insensitive exclude
       expect(results).not.toContain(path.join(testDir, 'dir2', 'image_upper.JPG')); // <<< USE UNIQUE NAME
       expect(results).not.toContain(path.join(testDir, 'dir2', 'image.jpg'));
    });

     it('should perform case-insensitive matching for excludes when ignoreCase=true (relative)', async () => {
         // Run once without excludes to get a baseline
         const baselineResults = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] }); // Use relative helper
         spies.consoleLogSpy.mockClear(); // Clear spy before the actual test run

         const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.jpg'], ignoreCase: true }); // Note: exclude *.jpg (lowercase) // Use relative helper

         // Expect fewer results than baseline
         expect(results.length).toBeLessThan(baselineResults.length);
         // Expect *neither* case to be present due to case-insensitive exclude (with ./)
         expect(results).not.toContain('./dir2/image_upper.JPG'); // <<< USE UNIQUE NAME
         expect(results).not.toContain('./dir2/image.jpg');
     });

    it('should perform case-insensitive pruning for directories when ignoreCase=true', async () => {
        // Run once without excludes to get a baseline
        const baselineResults = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*'] }); // Use absolute helper
        spies.consoleLogSpy.mockClear(); // Clear spy

        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['DIR1'], ignoreCase: true }); // Exclude uppercase name // Use absolute helper

        // Expect fewer results due to pruning
        expect(results.length).toBeLessThan(baselineResults.length);
        // Expect dir1 and its contents to be gone
        expect(results).not.toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1'));
    });

    it('should log an error to stderr and continue when encountering an unreadable directory (EACCES/EPERM)', async () => {
        await runTraverseAbsolute(testDir, spies.consoleLogSpy); // Run any traversal that includes unreadable_dir // Use absolute helper
        expect(spies.consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Permission error reading directory'));
        expect(spies.consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(path.join(testDir, 'unreadable_dir').replace(/\\/g, '/'))); // Normalize slashes for comparison
    });

    it('should NOT list contents of an unreadable directory', async () => {
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy); // Use absolute helper
        expect(results).not.toEqual(expect.arrayContaining([
             expect.stringContaining(path.join('unreadable_dir', 'some_file_inside')) // hypothetical
        ]));
    });

    it('should still list the unreadable directory itself if it matches filters before the read error', async () => {
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy); // Use absolute helper
        expect(results).toContain(path.join(testDir, 'unreadable_dir'));
    });

    it('should use the basePath correctly for calculating relative paths', async () => {
        // The basePath for relative calculations is the second argument to the DirectoryTraverser constructor,
        // which is implicitly `testDir` in runTraverse (the default relative helper).
        // This test verifies that runTraverse produces paths relative to testDir and prepends ./.
        const results = await runTraverse(testDir, spies.consoleLogSpy); // Use new default relative helper

        // Should contain paths relative to testDir, starting with ./
        expect(results).toContain('.');
        expect(results).toContain('./file1.txt');
        expect(results).toContain('./dir1/file3.txt');
        expect(results).not.toContain(path.join(testDir, 'file1.txt')); // Should not contain absolute

        // Example of testing a custom base path directly (requires modifying test or helper)
        /*
        const { DirectoryTraverser } = require('../../src/traverser'); // Adjust import if needed
        const customBasePath = path.join(testDir, 'dir1');
        // Need to instantiate traverser manually, passing customBasePath as second arg
        // And set relativePaths: true in options
        const traverser = new DirectoryTraverser({
            includePatterns: ['*'],
            excludePatterns: ['node_modules', '.git'], // Pass default excludes if needed by test logic
            matchType: null,
            maxDepth: Number.MAX_SAFE_INTEGER,
            ignoreCase: false,
            relativePaths: true, // Explicitly enable relative paths
            defaultExcludes: ['node_modules', '.git'] // Pass defaults for override logic
        }, customBasePath); // <-- Pass custom base path here

        spies.consoleLogSpy.mockClear(); // Clear previous calls
        await traverser.traverse(testDir); // Start traversal from parent of base path
        const calls = spies.consoleLogSpy.mock.calls;
        const relativeResults = normalizeAndSort(calls); // Use normalizeAndSort from helper

        // Expectations relative to customBasePath='dir1'
        expect(relativeResults).toContain('../file1.txt'); // Parent dir file
        expect(relativeResults).toContain('.');             // Base path dir1 itself
        expect(relativeResults).toContain('./file3.txt');    // File inside dir1
        expect(relativeResults).toContain('../dir2/file5.log'); // Sibling dir file
        expect(relativeResults).toContain('./subDir1/file4.js'); // Child dir file
        */
    });
});
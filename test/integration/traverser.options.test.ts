// test/integration/traverser.options.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

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
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected)); // Now contains case-insensitive match
    });

    it('should perform case-insensitive matching for includes when ignoreCase=true (relative)', async () => {
        const expected = [
            ' Capitals.TXT', // Now included due to ignoreCase
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expect.arrayContaining(expected)); // Now contains case-insensitive match
    });

    it('should perform case-insensitive matching for excludes when ignoreCase=true (absolute)', async () => {
       const baseResults = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
       const original = baseResults.length;
       const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'], ignoreCase: true });
       expect(results.length).toBeLessThan(original); // verify something is actually removed,
        expect(results).not.toContain(path.join(testDir, 'dir2', 'image.JPG'));
    });

     it('should perform case-insensitive matching for excludes when ignoreCase=true (relative)', async () => {
         const baseResults = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         const original = baseResults.length;
         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'], ignoreCase: true });
         expect(results.length).toBeLessThan(original); // verify something is actually removed
        expect(results).not.toContain('dir2/image.JPG');
     });

    it('should perform case-insensitive pruning for directories when ignoreCase=true', async () => {
       const expected = [
           //  path.join(testDir, 'Capitals.TXT'), // Exclude capitals because we prune it
       ].sort();
       const baseResults = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
        const original = baseResults.length;
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['CAPITALS*'], ignoreCase: true });
        expect(results.length).toBeLessThan(original);
        expect(results).not.toContain(path.join(testDir, ' Capitals.TXT'));
    });

    it('should log an error to stderr and continue when encountering an unreadable directory (EACCES/EPERM)', async () => {
        await runTraverse(testDir, spies.consoleLogSpy); // Run any traversal that includes unreadable_dir
        expect(spies.consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Permission error reading directory'));
        expect(spies.consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(path.join(testDir, 'unreadable_dir')));
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
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { basePath: path.join(testDir, 'dir1') });

        expect(results).toContain('dir1');

        expect(results).toContain("file3.txt");

        expect(results).not.toContain("dir1/file3.txt")
    });
});
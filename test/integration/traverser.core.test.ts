// test/integration/traverser.core.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper'; // Import helpers

describe('DirectoryTraverser - Core Functionality', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    it('should find all items by default when no options are restrictive (absolute paths, default excludes applied)', async () => {
        // runTraverse helper now applies default excludes like the CLI
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, '.hiddenfile'));
        expect(results).toContain(path.join(testDir, '.hiddenDir'));
        expect(results).toContain(path.join(testDir, 'emptyDir'));
        expect(results).toContain(path.join(testDir, 'unreadable_dir'));
        // Should NOT contain default excludes
        expect(results).not.toContain(path.join(testDir, '.git'));
        expect(results).not.toContain(path.join(testDir, 'node_modules'));
        expect(results).not.toContain(path.join(testDir, '.git', 'config'));
        expect(results).not.toContain(path.join(testDir, 'node_modules', 'some_package', 'index.js'));
    });

    it('should find all items by default when no options are restrictive (relative paths, default excludes applied)', async () => {
        // runTraverseRelative helper now applies default excludes like the CLI
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy);
        expect(results).toContain('.');
        expect(results).toContain('file1.txt');
        expect(results).toContain('.hiddenfile');
        expect(results).toContain('.hiddenDir');
        expect(results).toContain('emptyDir');
        expect(results).toContain('unreadable_dir');
         // Should NOT contain default excludes
        expect(results).not.toContain('.git');
        expect(results).not.toContain('node_modules');
        expect(results).not.toContain('.git/config');
        expect(results).not.toContain('node_modules/some_package/index.js');
    });

    it('should correctly handle paths with spaces (absolute paths)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        expect(results).toContain(path.join(testDir, 'dir with spaces'));
        expect(results).toContain(path.join(testDir, 'dir with spaces', 'file inside spaces.txt'));
    });

    it('should correctly handle paths with spaces (relative paths)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy);
        expect(results).toContain('dir with spaces');
        expect(results).toContain('dir with spaces/file inside spaces.txt');
    });

     it('should handle traversing an empty directory (finding the dir itself)', async () => {
        // runTraverseRelative starts in testDir, it should find 'emptyDir' within it
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy);
        expect(results).toContain('emptyDir');
    });

    it('should handle traversing *inside* an empty directory (finding the starting dir path)', async () => {
        // Start traversal *from* emptyDir. The starting directory itself should be printed if it matches filters.
        const emptyDirPath = path.join(testDir, 'emptyDir');
        // With default includePatterns: ['*'], the emptyDir itself matches.
        const results = await runTraverse(emptyDirPath, spies.consoleLogSpy);
        // Should print the absolute path of the starting directory.
        expect(results).toEqual([emptyDirPath]);
    });

    it('should handle traversing *inside* an empty directory (finding ".") (relative)', async () => {
        // Start traversal *from* emptyDir. The starting directory itself should be printed if it matches filters.
        const emptyDirPath = path.join(testDir, 'emptyDir');
        // With default includePatterns: ['*'], the emptyDir itself matches.
        // With relativePaths: true, it should print '.'
        const results = await runTraverseRelative(emptyDirPath, spies.consoleLogSpy);
        expect(results).toEqual(['.']);
    });

     it('should output the starting directory "." when relativePaths is true and it matches include patterns', async () => {
         // Start from testDir, relativePaths=true, include='*' -> should print '.'
         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         expect(results).toContain('.');
     });

     it('should NOT output the starting directory "." when relativePaths is false even if it matches', async () => {
         // Start from testDir, relativePaths=false, include='*' -> should print absolute path, not '.'
         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         expect(results).not.toContain('.');
         expect(results).toContain(testDir); // Should contain the absolute path
     });

    it('should output the resolved absolute path for the starting directory when relativePaths is false', async () => {
        // Start from testDir, relativePaths=false, include='*' -> should print absolute path
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
        expect(results).toContain(testDir);
    });
});
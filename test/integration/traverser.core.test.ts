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

    it('should find all items by default when no options are restrictive (absolute paths)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        // Expect all files and directories, including hidden ones and those usually defaulted out
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, '.hiddenfile'));
        expect(results).toContain(path.join(testDir, '.hiddenDir'));
        expect(results).toContain(path.join(testDir, '.git')); // Included here (no excludes)
        expect(results).toContain(path.join(testDir, 'node_modules')); // Included here (no excludes)
        expect(results).toContain(path.join(testDir, 'emptyDir'));
        expect(results).toContain(path.join(testDir, 'unreadable_dir')); // The dir itself
    });

    it('should find all items by default when no options are restrictive (relative paths)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy);
        expect(results).toContain('.');
        expect(results).toContain('file1.txt');
        expect(results).toContain('.hiddenfile');
        expect(results).toContain('.hiddenDir');
        expect(results).toContain('.git'); // Included here (no excludes)
        expect(results).toContain('node_modules'); // Included here (no excludes)
        expect(results).toContain('emptyDir');
        expect(results).toContain('unreadable_dir');
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
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy);
        expect(results).toContain('emptyDir');
    });

    it('should handle traversing *inside* an empty directory (finding nothing)', async () => {
        const results = await runTraverse(path.join(testDir, 'emptyDir'), spies.consoleLogSpy);
        expect(results).toEqual([]);
    });

     it('should output the starting directory "." when relativePaths is true and it matches include patterns', async () => {
         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         expect(results).toContain('.');
     });

     it('should NOT output the starting directory "." when relativePaths is false even if it matches', async () => {
         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         expect(results).not.toContain('.');
         expect(results).toContain(testDir); // Should contain the absolute path if matched by '*' indirectly
     });

    it('should output the resolved absolute path for the starting directory when relativePaths is false', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
        expect(results).toContain(testDir);
    });
});
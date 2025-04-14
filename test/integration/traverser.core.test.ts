// test/integration/traverser.core.test.ts
import path from 'path';
// --- FIX: Update import names ---
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseAbsolute } from './traverser.helper'; // Import helpers, updated names

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
        // --- FIX: Use absolute helper ---
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy);
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
        // --- FIX: Use default (relative) helper ---
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        // --- FIX: Update relative path expectations ---
        expect(results).toContain('.');
        expect(results).toContain('./file1.txt');
        expect(results).toContain('./.hiddenfile');
        expect(results).toContain('./.hiddenDir');
        expect(results).toContain('./emptyDir');
        expect(results).toContain('./unreadable_dir');
         // Should NOT contain default excludes (prefixed)
        expect(results).not.toContain('./.git');
        expect(results).not.toContain('./node_modules');
        expect(results).not.toContain('./.git/config');
        expect(results).not.toContain('./node_modules/some_package/index.js');
    });

    it('should correctly handle paths with spaces (absolute paths)', async () => {
        // --- FIX: Use absolute helper ---
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy);
        expect(results).toContain(path.join(testDir, 'dir with spaces'));
        expect(results).toContain(path.join(testDir, 'dir with spaces', 'file inside spaces.txt'));
    });

    it('should correctly handle paths with spaces (relative paths)', async () => {
        // --- FIX: Use default (relative) helper ---
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        // --- FIX: Update relative path expectations ---
        expect(results).toContain('./dir with spaces');
        expect(results).toContain('./dir with spaces/file inside spaces.txt');
    });

     it('should handle traversing an empty directory (finding the dir itself)', async () => {
        // --- FIX: Use default (relative) helper ---
        const results = await runTraverse(testDir, spies.consoleLogSpy);
        // --- FIX: Update relative path expectations ---
        expect(results).toContain('./emptyDir');
    });

    it('should handle traversing *inside* an empty directory (finding the starting dir path)', async () => {
        const emptyDirPath = path.join(testDir, 'emptyDir');
        // --- FIX: Use absolute helper ---
        const results = await runTraverseAbsolute(emptyDirPath, spies.consoleLogSpy);
        expect(results).toEqual([emptyDirPath]);
    });

    it('should handle traversing *inside* an empty directory (finding ".") (relative)', async () => {
        const emptyDirPath = path.join(testDir, 'emptyDir');
        // --- FIX: Use default (relative) helper ---
        const results = await runTraverse(emptyDirPath, spies.consoleLogSpy);
        expect(results).toEqual(['.']);
    });

     it('should output the starting directory "." when relativePaths is true and it matches include patterns', async () => {
         // --- FIX: Use default (relative) helper ---
         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         expect(results).toContain('.');
     });

     it('should NOT output the starting directory "." when relativePaths is false even if it matches', async () => {
         // --- FIX: Use absolute helper ---
         const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
         expect(results).not.toContain('.');
         expect(results).toContain(testDir); // Should contain the absolute path
     });

    it('should output the resolved absolute path for the starting directory when relativePaths is false', async () => {
        // --- FIX: Use absolute helper ---
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*'] });
        expect(results).toContain(testDir);
    });
});
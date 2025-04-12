// test/integration/traverser.type.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

describe('DirectoryTraverser - Type Filtering (--type)', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    it('should find only files when matchType="f" (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { matchType: 'f', excludePatterns: ['node_modules', '.git'] });
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, '.hiddenfile'));
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, '.'));
        expect(results).not.toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'emptyDir'));
        expect(results).not.toContain(path.join(testDir, 'unreadable_dir'));
    });

    it('should find only files when matchType="f" (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { matchType: 'f', excludePatterns: ['node_modules', '.git'] });
        expect(results).toContain('file1.txt');
        expect(results).toContain('.hiddenfile');
        expect(results).toContain('dir1/file3.txt');
        expect(results).not.toContain('.');
        expect(results).not.toContain('dir1');
        expect(results).not.toContain('emptyDir');
        expect(results).not.toContain('unreadable_dir');
    });

    it('should find only directories when matchType="d" (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { matchType: 'd', excludePatterns: ['node_modules', '.git'] });
        expect(results).toContain(path.join(testDir, 'dir1'));
        expect(results).toContain(path.join(testDir, 'dir1', 'subDir1'));
        expect(results).toContain(path.join(testDir, 'emptyDir'));
        expect(results).toContain(path.join(testDir, 'unreadable_dir'));
        expect(results).toContain(path.join(testDir, '.hiddenDir'));
        expect(results).not.toContain(path.join(testDir, 'file1.txt'));
        expect(results).not.toContain(path.join(testDir, '.hiddenfile'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'file3.txt'));
    });

    it('should find only directories when matchType="d" (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { matchType: 'd', excludePatterns: ['node_modules', '.git'] });
        expect(results).toContain('.');
        expect(results).toContain('dir1');
        expect(results).toContain('dir1/subDir1');
        expect(results).toContain('emptyDir');
        expect(results).toContain('unreadable_dir');
        expect(results).toContain('.hiddenDir');
        expect(results).not.toContain('file1.txt');
        expect(results).not.toContain('.hiddenfile');
        expect(results).not.toContain('dir1/file3.txt');
    });

    it('should find both files and directories when matchType=null (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['node_modules', '.git'] });
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, '.hiddenfile'));
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).toContain(path.join(testDir, 'dir1'));
        expect(results).toContain(path.join(testDir, 'dir1', 'subDir1'));
        expect(results).toContain(path.join(testDir, 'emptyDir'));
        expect(results).toContain(path.join(testDir, 'unreadable_dir'));
        expect(results).toContain(path.join(testDir, '.hiddenDir'));
    });

    it('should find both files and directories when matchType=null (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['node_modules', '.git'] });
        expect(results).toContain('.');
        expect(results).toContain('file1.txt');
        expect(results).toContain('.hiddenfile');
        expect(results).toContain('dir1/file3.txt');
        expect(results).toContain('dir1');
        expect(results).toContain('dir1/subDir1');
        expect(results).toContain('emptyDir');
        expect(results).toContain('unreadable_dir');
        expect(results).toContain('.hiddenDir');
    });

    it('should return nothing if matchType="f" and directory contains only directories', async () => {
        // Test specifically *inside* an empty directory
        const results = await runTraverse(testDir, spies.consoleLogSpy, { matchType: 'f', basePath: path.join(testDir, 'emptyDir') });
        expect(results).toEqual([]);
    });

    it('should return nothing if matchType="d" and directory contains only files', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { matchType: 'd', basePath: path.join(testDir, 'file1.txt')});
        expect(results).toEqual([]);
    });

    it('should correctly identify the starting directory "." as a directory when matchType="d" (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { matchType: 'd' });
        expect(results).toContain('.');
    });

    it('should correctly NOT identify the starting directory "." as a file when matchType="f" (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { matchType: 'f' });
        expect(results).not.toContain('.');
    });
});
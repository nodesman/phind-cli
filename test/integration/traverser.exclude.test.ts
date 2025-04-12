```typescript
// test/integration/traverser.exclude.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

describe('DirectoryTraverser - Exclude Patterns (--exclude)', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    it('should exclude files matching a simple glob pattern (*.log) (absolute)', async () => {
        // Helper now applies default excludes, so .git and node_modules are also excluded
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'] });
        expect(results).not.toContain(path.join(testDir, 'file2.log'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'another.log'));
        expect(results).not.toContain(path.join(testDir, 'dir2', 'file5.log'));
        expect(results).toContain(path.join(testDir, 'file1.txt')); // Ensure others are still present
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
        expect(results).not.toContain(path.join(testDir, 'node_modules')); // Default exclude check
    });

    it('should exclude files matching a simple glob pattern (*.log) (relative)', async () => {
         // Helper now applies default excludes
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'] });
        expect(results).not.toContain('file2.log');
        expect(results).not.toContain('dir1/subDir1/another.log');
        expect(results).not.toContain('dir2/file5.log');
        expect(results).toContain('file1.txt'); // Ensure others are still present
        expect(results).toContain('dir1/file3.txt');
        expect(results).not.toContain('.git'); // Default exclude check
        expect(results).not.toContain('node_modules'); // Default exclude check
    });

    it('should exclude items matching multiple glob patterns (*.log, *.tmp) (absolute)', async () => {
         // Helper now applies default excludes
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log', '*.tmp'] });
        expect(results).not.toContain(path.join(testDir, 'file2.log'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'another.log'));
        expect(results).not.toContain(path.join(testDir, 'dir2', 'file5.log'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'exclude_me.tmp'));
        expect(results).toContain(path.join(testDir, 'file1.txt')); // Ensure others are still present
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
        expect(results).not.toContain(path.join(testDir, 'node_modules')); // Default exclude check
    });

    it('should exclude items matching multiple glob patterns (*.log, *.tmp) (relative)', async () => {
         // Helper now applies default excludes
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log', '*.tmp'] });
        expect(results).not.toContain('file2.log');
        expect(results).not.toContain('dir1/subDir1/another.log');
        expect(results).not.toContain('dir2/file5.log');
        expect(results).not.toContain('dir1/exclude_me.tmp');
        expect(results).toContain('file1.txt'); // Ensure others are still present
        expect(results).toContain('dir1/file3.txt');
        expect(results).not.toContain('.git'); // Default exclude check
        expect(results).not.toContain('node_modules'); // Default exclude check
    });

    it('should exclude items matching a pattern with case sensitivity by default (absolute)', async () => {
         // Helper now applies default excludes
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'] });
        expect(results).not.toContain(path.join(testDir, 'dir2', 'image.JPG'));
        expect(results).toContain(path.join(testDir, 'dir2', 'image.jpg')); // lowercase should still be included
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
    });

    it('should exclude items matching a pattern with case sensitivity by default (relative)', async () => {
         // Helper now applies default excludes
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'] });
        expect(results).not.toContain('dir2/image.JPG');
        expect(results).toContain('dir2/image.jpg'); // lowercase should still be included
        expect(results).not.toContain('.git'); // Default exclude check
    });

    it('should exclude hidden files/dirs when pattern explicitly matches them (.*) (absolute)', async () => {
         // Helper applies default excludes, including .git. The '.*' pattern also matches .git.
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['.*'] });
        expect(results).not.toContain(path.join(testDir, '.hiddenfile'));
        expect(results).not.toContain(path.join(testDir, '.hiddenDir'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Excluded by both default and pattern
        expect(results).toContain(path.join(testDir, 'file1.txt')); // others present
        expect(results).toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'node_modules')); // Default excluded
    });

    it('should exclude hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
         // Helper applies default excludes (.git, node_modules). '.*' also matches .git and .hidden*.
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['.*'] });
        expect(results).not.toContain('.hiddenfile');
        expect(results).not.toContain('.hiddenDir');
        expect(results).not.toContain('.git'); // Excluded by both default and pattern
        expect(results).toContain('file1.txt'); // others present
        expect(results).toContain('dir1');
        expect(results).not.toContain('node_modules'); // Default excluded
    });

    it('should exclude hidden files/dirs anywhere using appropriate glob (** /.*) (absolute)', async () => {
         // Helper applies default excludes (.git, node_modules). '**/.*' and '.*' will match .git, .hidden*, .hiddensub
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['**/.*', '.*'] });
        expect(results).not.toContain(path.join(testDir, '.hiddenfile'));
        expect(results).not.toContain(path.join(testDir, '.hiddenDir'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', '.hiddensub'));
        expect(results).not.toContain(path.join(testDir, '.git')); //Excluded by default and pattern
        expect(results).toContain(path.join(testDir, 'file1.txt')); // others present
        expect(results).toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'node_modules')); // Default excluded
    });

    it('should exclude hidden files/dirs anywhere using appropriate glob (** /.*) (relative)', async () => {
         // Helper applies default excludes (.git, node_modules). '**/.*' and '.*' will match .git, .hidden*, .hiddensub
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['**/.*', '.*'] });
        expect(results).not.toContain('.hiddenfile');
        expect(results).not.toContain('.hiddenDir');
        expect(results).not.toContain('dir1/subDir1/.hiddensub');
        expect(results).not.toContain('.git'); //Excluded by default and pattern
        expect(results).toContain('file1.txt'); // others present
        expect(results).toContain('dir1');
        expect(results).not.toContain('node_modules'); // Default excluded
    });

    it('should exclude items based on matching the full absolute path', async () => {
        const excludePath = path.join(testDir, 'dir1', 'subDir1', 'file4.js');
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: [excludePath] });
        expect(results).not.toContain(excludePath);
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
    });

    it('should exclude items based on matching the full relative path', async () => {
        const excludePath = 'dir1/subDir1/file4.js';
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: [excludePath] });
        expect(results).not.toContain(excludePath);
        expect(results).toContain('file1.txt');
        expect(results).toContain('dir1/file3.txt');
        expect(results).not.toContain('.git'); // Default exclude check
    });

    it('should exclude items matching the base name', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['file1.txt'] });
        expect(results).not.toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path
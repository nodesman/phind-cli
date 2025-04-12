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
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'] });
        expect(results).not.toContain(path.join(testDir, 'file2.log'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'another.log'));
        expect(results).not.toContain(path.join(testDir, 'dir2', 'file5.log'));
        expect(results).toContain(path.join(testDir, 'file1.txt')); // Ensure others are still present
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
    });

    it('should exclude files matching a simple glob pattern (*.log) (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'] });
        expect(results).not.toContain('file2.log');
        expect(results).not.toContain('dir1/subDir1/another.log');
        expect(results).not.toContain('dir2/file5.log');
        expect(results).toContain('file1.txt'); // Ensure others are still present
        expect(results).toContain('dir1/file3.txt');
    });

    it('should exclude items matching multiple glob patterns (*.log, *.tmp) (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log', '*.tmp'] });
        expect(results).not.toContain(path.join(testDir, 'file2.log'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'another.log'));
        expect(results).not.toContain(path.join(testDir, 'dir2', 'file5.log'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'exclude_me.tmp'));
        expect(results).toContain(path.join(testDir, 'file1.txt')); // Ensure others are still present
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
    });

    it('should exclude items matching multiple glob patterns (*.log, *.tmp) (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log', '*.tmp'] });
        expect(results).not.toContain('file2.log');
        expect(results).not.toContain('dir1/subDir1/another.log');
        expect(results).not.toContain('dir2/file5.log');
        expect(results).not.toContain('dir1/exclude_me.tmp');
        expect(results).toContain('file1.txt'); // Ensure others are still present
        expect(results).toContain('dir1/file3.txt');
    });

    it('should exclude items matching a pattern with case sensitivity by default (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'] });
        expect(results).not.toContain(path.join(testDir, 'dir2', 'image.JPG'));
        expect(results).toContain(path.join(testDir, 'dir2', 'image.jpg')); //lowercase still included
    });

    it('should exclude items matching a pattern with case sensitivity by default (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'] });
        expect(results).not.toContain('dir2/image.JPG');
        expect(results).toContain('dir2/image.jpg'); //lowercase still included
    });

    it('should exclude hidden files/dirs when pattern explicitly matches them (.*) (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['.*'] });
        expect(results).not.toContain(path.join(testDir, '.hiddenfile'));
        expect(results).not.toContain(path.join(testDir, '.hiddenDir'));
        expect(results).toContain(path.join(testDir, 'file1.txt')); // others present
        expect(results).toContain(path.join(testDir, 'dir1'));
    });

    it('should exclude hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['.*'] });
        expect(results).not.toContain('.hiddenfile');
        expect(results).not.toContain('.hiddenDir');
        expect(results).toContain('file1.txt'); // others present
        expect(results).toContain('dir1');
    });

    it('should exclude hidden files/dirs anywhere using appropriate glob (** /.*) (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['**/.*', '.*'] });
        expect(results).not.toContain(path.join(testDir, '.hiddenfile'));
        expect(results).not.toContain(path.join(testDir, '.hiddenDir'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', '.hiddensub'));
        expect(results).not.toContain(path.join(testDir, '.git')); //Excluded at top level
        expect(results).toContain(path.join(testDir, 'file1.txt')); // others present
        expect(results).toContain(path.join(testDir, 'dir1'));
    });

    it('should exclude hidden files/dirs anywhere using appropriate glob (** /.*) (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['**/.*', '.*'] });
        expect(results).not.toContain('.hiddenfile');
        expect(results).not.toContain('.hiddenDir');
        expect(results).not.toContain('dir1/subDir1/.hiddensub');
        expect(results).not.toContain('.git'); //Excluded at top level
        expect(results).toContain('file1.txt'); // others present
        expect(results).toContain('dir1');
    });

    it('should exclude items based on matching the full absolute path', async () => {
        const excludePath = path.join(testDir, 'dir1', 'subDir1', 'file4.js');
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: [excludePath] });
        expect(results).not.toContain(excludePath);
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
    });

    it('should exclude items based on matching the full relative path', async () => {
        const excludePath = 'dir1/subDir1/file4.js';
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: [excludePath] });
        expect(results).not.toContain(excludePath);
        expect(results).toContain('file1.txt');
        expect(results).toContain('dir1/file3.txt');
    });

    it('should exclude items matching the base name', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['file1.txt'] });
        expect(results).not.toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, 'file2.log'));
    });

    it('should prune traversal into a directory matching an exclude pattern (absolute path exclude)', async () => {
        const excludeDir = path.join(testDir, 'dir1');
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: [excludeDir] });
        expect(results).not.toContain(excludeDir);
        expect(results).not.toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'file4.js'));
        expect(results).toContain(path.join(testDir, 'file1.txt'));
    });

    it('should prune traversal into a directory matching an exclude pattern (relative path exclude)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1'] });
        expect(results).not.toContain('dir1');
        expect(results).not.toContain('dir1/file3.txt');
        expect(results).not.toContain('dir1/subDir1/file4.js');
        expect(results).toContain('file1.txt');
    });

    it('should prune traversal into a directory matching an exclude pattern by name (e.g., node_modules)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['node_modules'] });
        expect(results).not.toContain(path.join(testDir, 'node_modules'));
        expect(results).not.toContain(path.join(testDir, 'node_modules', 'some_package', 'index.js'));
        expect(results).toContain(path.join(testDir, 'file1.txt'));
    });

    it('should NOT prune a directory if only its *contents* match an exclude pattern (e.g., exclude dir1/*.log)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1/*.log'] });
        expect(results).toContain('dir1');
        expect(results).not.toContain('dir1/subDir1/another.log');
        expect(results).toContain('dir1/file3.txt');
    });

    it('should exclude files within a specific subdirectory using ** (dir1/**/*.log) (absolute)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: [path.join(testDir, 'dir1', '**', '*.log')] });
         expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'another.log'));
         expect(results).toContain(path.join(testDir, 'dir2', 'file5.log')); // file5 should NOT be excluded
         expect(results).toContain(path.join(testDir, 'file2.log')); // file2 NOT excluded
         expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt')); // file3 present
         expect(results).toContain(path.join(testDir, 'dir1')); //Ensure dir1 itself was listed
         expect(results).toContain(path.join(testDir, 'file1.txt')); //file1 listed
    });

    it('should exclude files within a specific subdirectory using ** (dir1/**/*.log) (relative)', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1/**/*.log'] });
        expect(results).not.toContain('dir1/subDir1/another.log');
         expect(results).toContain('dir2/file5.log'); // file5 should NOT be excluded
         expect(results).toContain('file2.log'); // file2 NOT excluded
        expect(results).toContain('dir1/file3.txt');
        expect(results).toContain('dir1'); //Ensure dir1 itself was listed
        expect(results).toContain('file1.txt'); //file1 listed
    });

    it('should still find items if the exclude pattern does not match anything', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.nonexistent'] });
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
    });

    it('should correctly exclude items even if they also match an include pattern (exclude priority)', async () => {
         const results = await runTraverseRelative(testDir, spies.consoleLogSpy, {
            includePatterns: ['*.txt'],
            excludePatterns: ['file1.txt']
        });

         expect(results).not.toContain('file1.txt');
         expect(results).toContain(' Capitals.TXT');
         expect(results).toContain('dir1/file3.txt');
    });

    it('should simulate default excludes (.git, node_modules) correctly', async () => {
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { excludePatterns: ['node_modules', '.git'] });
        expect(results).not.toContain('.git');
        expect(results).not.toContain('node_modules');
        expect(results).not.toContain('.git/config');
        expect(results).not.toContain('node_modules/some_package');
        expect(results).toContain('dir1');
        expect(results).toContain('.hiddenDir');
    });
});
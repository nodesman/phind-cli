// test/integration/traverser.include.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseRelative } from './traverser.helper';

describe('DirectoryTraverser - Include Patterns (--name)', () => {
    let testDir: string;
    let spies: { consoleLogSpy: jest.SpyInstance; consoleErrorSpy: jest.SpyInstance };

    beforeEach(async () => {
        ({ testDir, ...spies } = await setupTestEnvironment());
    });

    afterEach(async () => {
        await cleanupTestEnvironment(testDir, spies);
    });

    // --- *.txt Tests (Case Sensitive Default) ---
    it('should include only files matching a simple glob pattern (*.txt) (absolute)', async () => {
        const expected = [
            // path.join(testDir, ' Capitals.TXT'), // Excluded due to case sensitivity (no ignoreCase: true)
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
    });

    it('should include only files matching a simple glob pattern (*.txt) (relative)', async () => {
        const expected = [
            '.hiddenDir/insideHidden.txt',
            // ' Capitals.TXT', // Excluded due to case sensitivity (no ignoreCase: true)
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'file1.txt',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
    });

    // --- Multiple Patterns (*.txt, *.js) ---
    it('should include only items matching multiple glob patterns (*.txt, *.js) (absolute)', async () => {
        const expected = [
            // path.join(testDir, ' Capitals.TXT'), // Excluded by case
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'),
            path.join(testDir, 'file1.txt'),
            // Included because '*.js' is an explicit non-default include overriding the 'node_modules' default exclude
            path.join(testDir, 'node_modules', 'some_package', 'index.js'), // <-- This was missing
        ].sort();

        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expected);
    });

    it('should include only items matching multiple glob patterns (*.txt, *.js) (relative)', async () => {
        const expected = [
             '.hiddenDir/insideHidden.txt',
            // ' Capitals.TXT', // Excluded by case
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'dir1/subDir1/file4.js',
            'file1.txt',
             // Included because '*.js' is an explicit non-default include overriding the 'node_modules' default exclude
            'node_modules/some_package/index.js', // <-- This was missing
        ].sort();

        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expected);
    });

    // --- Case Sensitivity Tests ---
    it('should include items matching a pattern with case sensitivity by default (absolute)', async () => {
        const expected = [
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
        // Explicitly check the case-mismatched file is NOT included
        expect(results).not.toContain(path.join(testDir, ' Capitals.TXT'));
    });

    it('should include items matching a pattern with case sensitivity by default (relative)', async () => {
        const expected = [
            '.hiddenDir/insideHidden.txt',
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'file1.txt',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
        // Explicitly check the case-mismatched file is NOT included
        expect(results).not.toContain(' Capitals.TXT');
    });

    it('should include items matching a pattern ignoring case when ignoreCase=true (absolute)', async () => {
        const expected = [
            path.join(testDir, ' Capitals.TXT'), // Now included
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expected);
    });

    it('should include items matching a pattern ignoring case when ignoreCase=true (relative)', async () => {
        const expected = [
            ' Capitals.TXT', // Now included
            '.hiddenDir/insideHidden.txt',
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt',
            'file1.txt',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expected);
    });

    // --- Hidden Files (.*) ---
    // Note: runTraverse helper implicitly adds default excludes ('node_modules', '.git') to the options.
    // The include pattern '.*' is a non-default include pattern.
    // The `shouldPrintItem` logic will check:
    // - Is '.git' included by '.*'? Yes.
    // - Is '.git' excluded by 'node_modules' or '.git'? Yes.
    // - Does '.git' match a non-default include (''.*')? Yes.
    // -> Therefore, '.git' should be printed, overriding the default exclusion.
    it('should include hidden files/dirs when pattern explicitly matches them (.*) (absolute)', async () => {
        const expected = [
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenfile'),
            path.join(testDir, '.git'), // Included because '.*' is a non-default include overriding the default exclude
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'), // Base name matches '.*'
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expected);
    });

    it('should include hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
        const expected = [
            // '.' // Base dir itself is not hidden, doesn't match '.*' pattern
            '.hiddenDir',
            '.hiddenfile',
            '.git', // Included because '.*' is a non-default include overriding the default exclude
            'dir1/subDir1/.hiddensub', // Base name matches '.*'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expected);
    });

    // --- Hidden Files (** /.*) ---
    // Similar logic: '**/.*' and '.*' are non-default includes that override the default exclusion of '.git'.
    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (absolute)', async () => {
        const expected = [
            path.join(testDir, '.hiddenDir'),
            // path.join(testDir, '.hiddenDir', 'insideHidden.txt'), // Name doesn't start with '.'
            path.join(testDir, '.hiddenfile'),
            path.join(testDir, '.git'), // Included via override
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'), // Matches '**/.*'
        ].sort();
        // Needs both patterns: '.*' for top level, '**/.*' for nested.
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expected);
    });

    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (relative)', async () => {
        const expected = [
            // '.' // Not hidden
            '.hiddenDir',
            // '.hiddenDir/insideHidden.txt', // Name doesn't start with '.'
            '.hiddenfile',
            '.git', // Included via override
            'dir1/subDir1/.hiddensub', // Matches '**/.*'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expected);
    });


    // --- Full Path Matching ---
     it('should include items based on matching the full absolute path', async () => {
         const targetPath = path.join(testDir, 'dir1', 'file3.txt');
         const expected = [targetPath]; // Only this specific file

         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: [targetPath] });
         expect(results).toEqual(expected);
     });

     it('should include items based on matching the full relative path', async () => {
        const targetPath = 'dir1/file3.txt';
        const expected = [targetPath]; // Only this specific file
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: [targetPath] });
        expect(results).toEqual(expected);
     });

    // --- Subdirectory Globstar (dir1/**) ---
    // Micromatch behavior: 'dir1/**' matches files/dirs *inside* dir1, but not dir1 itself.
    // To include dir1 itself, you need a separate pattern like 'dir1'.
    it('should include items within a specific subdirectory using ** (dir1/**) (absolute)', async () => {
        const expected = [
            // path.join(testDir, 'dir1'), // Not matched by 'dir1/**'
            path.join(testDir, 'dir1', 'exclude_me.tmp'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'file6.data'),
            path.join(testDir, 'dir1', 'subDir1'),
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'),
            path.join(testDir, 'dir1', 'subDir1', 'another.log'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'),
        ].sort();
        // Use the absolute path pattern corresponding to 'dir1/**'
        const pattern = path.join(testDir, 'dir1', '**').replace(/\\/g, '/');
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: [pattern] });
        expect(results).toEqual(expected);
    });

    it('should include items within a specific subdirectory using ** (dir1/**) (relative)', async () => {
        const expected = [
            // 'dir1', // Not matched by 'dir1/**'
            'dir1/exclude_me.tmp',
            'dir1/file3.txt',
            'dir1/file6.data',
            'dir1/subDir1',
            'dir1/subDir1/.hiddensub',
            'dir1/subDir1/another.log',
            'dir1/subDir1/file4.js',
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['dir1/**'] });
        expect(results).toEqual(expected);
    });

    it('should include the directory itself AND contents when using patterns like dir1 and dir1/**', async () => {
         const expected = [
            path.join(testDir, 'dir1'), // Matches 'dir1' pattern
            path.join(testDir, 'dir1', 'exclude_me.tmp'), // Matches 'dir1/**'
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'file6.data'),
            path.join(testDir, 'dir1', 'subDir1'),
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'),
            path.join(testDir, 'dir1', 'subDir1', 'another.log'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'),
        ].sort();
         // Provide absolute path for dir1 and globstar pattern
         const pattern1 = path.join(testDir, 'dir1').replace(/\\/g, '/');
         const pattern2 = path.join(testDir, 'dir1', '**').replace(/\\/g, '/');
         const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: [pattern1, pattern2] });
         expect(results).toEqual(expected);
    });

    // --- No Match ---
    it('should NOT include items if the include pattern does not match anything', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.nonexistent'] });
        expect(results).toEqual([]);
    });

    // --- Base Name Match ---
    it('should include items matching the base name', async () => {
        const expected = [
            path.join(testDir, 'file1.txt'),
        ];
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['file1.txt'] });
        expect(results).toEqual(expected);
    });
});
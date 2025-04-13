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
        // Assertion Change Reason: Aligning with user expectation that default excludes (node_modules)
        // are not overridden by broad include patterns like '*.js'.
        const expected = [
            // path.join(testDir, ' Capitals.TXT'), // Excluded by case
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'dir1', 'subDir1', 'file4.js'), // Matches *.js
            path.join(testDir, 'file1.txt'), // Matches *.txt
            // path.join(testDir, 'node_modules', 'some_package', 'index.js'), // Excluded: Default exclude + non-specific include override
        ].sort();

        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expected);
    });

    it('should include only items matching multiple glob patterns (*.txt, *.js) (relative)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (node_modules)
        // are not overridden by broad include patterns like '*.js'.
        const expected = [
             '.hiddenDir/insideHidden.txt',
            // ' Capitals.TXT', // Excluded by case
            'dir with spaces/file inside spaces.txt',
            'dir1/file3.txt', // Matches *.txt
            'dir1/subDir1/file4.js', // Matches *.js
            'file1.txt', // Matches *.txt
             // 'node_modules/some_package/index.js', // Excluded: Default exclude + non-specific include override
        ].sort();

        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expected);
    });

    // --- Case Sensitivity Tests ---
    // ... (these tests remain unchanged as their logic is correct) ...
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
    it('should include hidden files/dirs when pattern explicitly matches them (.*) (absolute)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (.git)
        // are not overridden by broad include patterns like '.*'.
        const expected = [
            path.join(testDir, '.hiddenDir'),
            path.join(testDir, '.hiddenfile'),
            // path.join(testDir, '.git'), // Excluded: Default exclude + non-specific include override
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'), // Base name matches '.*'
        ].sort();
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expected);
    });

    it('should include hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (.git)
        // are not overridden by broad include patterns like '.*'. Also, '.' shouldn't be listed for '.*'.
        const expected = [
            // '.' // Base dir itself is not hidden, doesn't match '.*' pattern, and excluded anyway by traverser fix
            '.hiddenDir',
            '.hiddenfile',
            // '.git', // Excluded: Default exclude + non-specific include override
            'dir1/subDir1/.hiddensub', // Base name matches '.*'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expected);
    });

    // --- Hidden Files (** /.*) ---
    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (absolute)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (.git)
        // are not overridden by broad include patterns like '**/.*' or '.*'.
        const expected = [
            path.join(testDir, '.hiddenDir'),
            // path.join(testDir, '.hiddenDir', 'insideHidden.txt'), // Name doesn't start with '.'
            path.join(testDir, '.hiddenfile'),
            // path.join(testDir, '.git'), // Excluded: Default exclude + non-specific include override
            path.join(testDir, 'dir1', 'subDir1', '.hiddensub'), // Matches '**/.*'
        ].sort();
        // Needs both patterns: '.*' for top level, '**/.*' for nested.
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expected);
    });

    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (relative)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (.git)
        // are not overridden by broad include patterns like '**/.*' or '.*'. Also, '.' shouldn't be listed.
        const expected = [
            // '.' // Not hidden, and excluded anyway by traverser fix
            '.hiddenDir',
            // '.hiddenDir/insideHidden.txt', // Name doesn't start with '.'
            '.hiddenfile',
            // '.git', // Excluded: Default exclude + non-specific include override
            'dir1/subDir1/.hiddensub', // Matches '**/.*'
        ].sort();
        const results = await runTraverseRelative(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expected);
    });

    // --- Full Path Matching ---
    // ... (these tests remain unchanged as their logic is correct) ...
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
    // ... (these tests remain unchanged as their logic is correct) ...
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
    // ... (test remains unchanged) ...
    it('should NOT include items if the include pattern does not match anything', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.nonexistent'] });
        expect(results).toEqual([]);
    });

    // --- Base Name Match ---
    // ... (test remains unchanged) ...
    it('should include items matching the base name', async () => {
        const expected = [
            path.join(testDir, 'file1.txt'),
        ];
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['file1.txt'] });
        expect(results).toEqual(expected);
    });
});
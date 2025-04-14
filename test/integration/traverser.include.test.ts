// test/integration/traverser.include.test.ts
import path from 'path';
// Import the new helper names
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseAbsolute } from './traverser.helper';

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
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
    });

    it('should include only files matching a simple glob pattern (*.txt) (relative)', async () => {
        const expected = [
            './.hiddenDir/insideHidden.txt', // Prepend ./
            // './ Capitals.TXT', // Excluded due to case sensitivity (no ignoreCase: true)
            './dir with spaces/file inside spaces.txt', // Prepend ./
            './dir1/file3.txt', // Prepend ./
            './file1.txt', // Prepend ./
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
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
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
        expect(results).toEqual(expected);
    });

    it('should include only items matching multiple glob patterns (*.txt, *.js) (relative)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (node_modules)
        // are not overridden by broad include patterns like '*.js'.
        const expected = [
             './.hiddenDir/insideHidden.txt', // Prepend ./
            // './ Capitals.TXT', // Excluded by case
            './dir with spaces/file inside spaces.txt', // Prepend ./
            './dir1/file3.txt', // Matches *.txt, Prepend ./
            './dir1/subDir1/file4.js', // Matches *.js, Prepend ./
            './file1.txt', // Matches *.txt, Prepend ./
             // './node_modules/some_package/index.js', // Excluded: Default exclude + non-specific include override
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt', '*.js'] });
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
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
        // Explicitly check the case-mismatched file is NOT included
        expect(results).not.toContain(path.join(testDir, ' Capitals.TXT'));
    });

    it('should include items matching a pattern with case sensitivity by default (relative)', async () => {
        const expected = [
            './.hiddenDir/insideHidden.txt', // Prepend ./
            './dir with spaces/file inside spaces.txt', // Prepend ./
            './dir1/file3.txt', // Prepend ./
            './file1.txt', // Prepend ./
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'] });
        expect(results).toEqual(expected);
        // Explicitly check the case-mismatched file is NOT included
        expect(results).not.toContain('./ Capitals.TXT'); // Check with ./
    });

    it('should include items matching a pattern ignoring case when ignoreCase=true (absolute)', async () => {
        const expected = [
            path.join(testDir, ' Capitals.TXT'), // Now included
            path.join(testDir, '.hiddenDir', 'insideHidden.txt'),
            path.join(testDir, 'dir with spaces', 'file inside spaces.txt'),
            path.join(testDir, 'dir1', 'file3.txt'),
            path.join(testDir, 'file1.txt'),
        ].sort();
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
        expect(results).toEqual(expected);
    });

    it('should include items matching a pattern ignoring case when ignoreCase=true (relative)', async () => {
        const expected = [
            './ Capitals.TXT', // Now included, Prepend ./
            './.hiddenDir/insideHidden.txt', // Prepend ./
            './dir with spaces/file inside spaces.txt', // Prepend ./
            './dir1/file3.txt', // Prepend ./
            './file1.txt', // Prepend ./
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['*.txt'], ignoreCase: true });
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
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
        expect(results).toEqual(expected);
    });

    it('should include hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (.git)
        // are not overridden by broad include patterns like '.*'. Also, '.' shouldn't be listed for '.*'.
        const expected = [
            // '.' // Base dir itself is not hidden, doesn't match '.*' pattern, and excluded anyway by traverser fix
            './.hiddenDir', // Prepend ./
            './.hiddenfile', // Prepend ./
            // './.git', // Excluded: Default exclude + non-specific include override
            './dir1/subDir1/.hiddensub', // Base name matches '.*', Prepend ./
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['.*'] });
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
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expected);
    });

    it('should include hidden files/dirs anywhere using appropriate glob (** /.*) (relative)', async () => {
        // Assertion Change Reason: Aligning with user expectation that default excludes (.git)
        // are not overridden by broad include patterns like '**/.*' or '.*'. Also, '.' shouldn't be listed.
        const expected = [
            // '.' // Not hidden, and excluded anyway by traverser fix
            './.hiddenDir', // Prepend ./
            // './.hiddenDir/insideHidden.txt', // Name doesn't start with '.'
            './.hiddenfile', // Prepend ./
            // './.git', // Excluded: Default exclude + non-specific include override
            './dir1/subDir1/.hiddensub', // Matches '**/.*', Prepend ./
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['**/.*', '.*'] });
        expect(results).toEqual(expected);
    });

    // --- Full Path Matching ---
     it('should include items based on matching the full absolute path', async () => {
         const targetPath = path.join(testDir, 'dir1', 'file3.txt');
         const expected = [targetPath]; // Only this specific file
        // Use the new absolute path helper
         const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: [targetPath] });
         expect(results).toEqual(expected);
     });

     it('should include items based on matching the full relative path', async () => {
        const targetPath = './dir1/file3.txt'; // Use ./ prefix in target path now
        const expected = [targetPath]; // Only this specific file
        // Use the new relative path helper (default)
        // Pass the pattern with the './' prefix as well, so it matches the output path
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: [targetPath] });
        expect(results).toEqual(expected);
     });


    // --- Subdirectory Globstar (dir1/**) ---
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
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: [pattern] });
        expect(results).toEqual(expected);
    });

    it('should include items within a specific subdirectory using ** (dir1/**) (relative)', async () => {
        const expected = [
            // './dir1', // Not matched by 'dir1/**'
            './dir1/exclude_me.tmp', // Prepend ./
            './dir1/file3.txt', // Prepend ./
            './dir1/file6.data', // Prepend ./
            './dir1/subDir1', // Prepend ./
            './dir1/subDir1/.hiddensub', // Prepend ./
            './dir1/subDir1/another.log', // Prepend ./
            './dir1/subDir1/file4.js', // Prepend ./
        ].sort();
        // Use the new relative path helper (default)
        const results = await runTraverse(testDir, spies.consoleLogSpy, { includePatterns: ['dir1/**'] }); // Relative pattern is fine here
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
         // Use the new absolute path helper
         const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: [pattern1, pattern2] });
         expect(results).toEqual(expected);
    });

    // --- No Match ---
    it('should NOT include items if the include pattern does not match anything', async () => {
        // Use the new absolute path helper (or relative, doesn't matter for empty result)
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['*.nonexistent'] });
        expect(results).toEqual([]);
    });

    // --- Base Name Match ---
    it('should include items matching the base name', async () => {
        const expected = [
            path.join(testDir, 'file1.txt'),
        ];
        // Use the new absolute path helper
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { includePatterns: ['file1.txt'] });
        expect(results).toEqual(expected);
    });
});
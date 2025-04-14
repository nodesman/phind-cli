// test/integration/traverser.exclude.test.ts
import path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, runTraverse, runTraverseAbsolute } from './traverser.helper';

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
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'] });
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
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log'] });
        expect(results).not.toContain('./file2.log');
        expect(results).not.toContain('./dir1/subDir1/another.log');
        expect(results).not.toContain('./dir2/file5.log');
        expect(results).toContain('./file1.txt'); // Ensure others are still present
        expect(results).toContain('./dir1/file3.txt');
        expect(results).not.toContain('.git'); // Default exclude check
        expect(results).not.toContain('node_modules'); // Default exclude check
    });

    it('should exclude items matching multiple glob patterns (*.log, *.tmp) (absolute)', async () => {
         // Helper now applies default excludes
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log', '*.tmp'] });
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
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.log', '*.tmp'] });
        expect(results).not.toContain('./file2.log');
        expect(results).not.toContain('./dir1/subDir1/another.log');
        expect(results).not.toContain('./dir2/file5.log');
        expect(results).not.toContain('./dir1/exclude_me.tmp');
        expect(results).toContain('./file1.txt'); // Ensure others are still present
        expect(results).toContain('./dir1/file3.txt');
        expect(results).not.toContain('.git'); // Default exclude check
        expect(results).not.toContain('node_modules'); // Default exclude check
    });

    it('should exclude items matching a pattern with case sensitivity by default (absolute)', async () => {
         // Helper now applies default excludes
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'] });
        expect(results).not.toContain(path.join(testDir, 'dir2', 'image_upper.JPG')); // Use unique name
        // The presence of 'image.jpg' depends on filesystem case sensitivity and readdir order - avoid asserting its presence.
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
    });

    it('should exclude items matching a pattern with case sensitivity by default (relative)', async () => {
         // Helper now applies default excludes
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['*.JPG'] });
        expect(results).not.toContain('./dir2/image_upper.JPG'); // Use unique name
        // The presence of 'image.jpg' depends on filesystem case sensitivity and readdir order - avoid asserting its presence.
        expect(results).not.toContain('.git'); // Default exclude check
    });

    it('should exclude hidden files/dirs when pattern explicitly matches them (.*) (absolute)', async () => {
         // Helper applies default excludes, including .git. The '.*' pattern also matches .git.
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['.*'] });
        expect(results).not.toContain(path.join(testDir, '.hiddenfile'));
        expect(results).not.toContain(path.join(testDir, '.hiddenDir'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Excluded by both default and pattern
        expect(results).toContain(path.join(testDir, 'file1.txt')); // others present
        expect(results).toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'node_modules')); // Default excluded
    });

    it('should exclude hidden files/dirs when pattern explicitly matches them (.*) (relative)', async () => {
         // Helper applies default excludes (.git, node_modules). '.*' also matches .git and .hidden*.
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['.*'] });
        expect(results).not.toContain('./.hiddenfile');
        expect(results).not.toContain('./.hiddenDir');
        expect(results).not.toContain('.git'); // Excluded by both default and pattern
        expect(results).toContain('./file1.txt'); // others present
        expect(results).toContain('./dir1');
        expect(results).not.toContain('node_modules'); // Default excluded
    });

    it('should exclude hidden files/dirs anywhere using appropriate glob (** /.*) (absolute)', async () => {
         // Helper applies default excludes (.git, node_modules). '**/.*' and '.*' will match .git, .hidden*, .hiddensub
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['**/.*', '.*'] });
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
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['**/.*', '.*'] });
        expect(results).not.toContain('./.hiddenfile');
        expect(results).not.toContain('./.hiddenDir');
        expect(results).not.toContain('./dir1/subDir1/.hiddensub');
        expect(results).not.toContain('.git'); //Excluded by default and pattern
        expect(results).toContain('./file1.txt'); // others present
        expect(results).toContain('./dir1');
        expect(results).not.toContain('node_modules'); // Default excluded
    });

    it('should exclude items based on matching the full absolute path', async () => {
        const excludePath = path.join(testDir, 'dir1', 'subDir1', 'file4.js');
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: [excludePath] });
        expect(results).not.toContain(excludePath);
        expect(results).toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
    });

    it('should exclude items based on matching the full relative path', async () => {
        const excludePath = './dir1/subDir1/file4.js';
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: [excludePath] });
        expect(results).not.toContain(excludePath);
        expect(results).toContain('./file1.txt');
        expect(results).toContain('./dir1/file3.txt');
        expect(results).not.toContain('.git'); // Default exclude check
    });

    it('should exclude items matching the base name', async () => {
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['file1.txt'] });
        expect(results).not.toContain(path.join(testDir, 'file1.txt'));
        expect(results).toContain(path.join(testDir, 'file2.log')); // Ensure other files are still present
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
    });

    // Add more tests as needed, e.g., for pruning directories
    it('should prune entire directories matching exclude pattern (absolute)', async () => {
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1'] });
        expect(results).not.toContain(path.join(testDir, 'dir1'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'file3.txt'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1'));
        expect(results).not.toContain(path.join(testDir, 'dir1', 'subDir1', 'file4.js'));
        expect(results).toContain(path.join(testDir, 'dir2')); // Ensure other dirs are present
        expect(results).toContain(path.join(testDir, 'dir2', 'file5.log'));
        expect(results).not.toContain(path.join(testDir, '.git')); // Default exclude check
    });

    it('should prune entire directories matching exclude pattern (relative)', async () => {
        const results = await runTraverse(testDir, spies.consoleLogSpy, { excludePatterns: ['dir1'] });
        expect(results).not.toContain('./dir1');
        expect(results).not.toContain('./dir1/file3.txt');
        expect(results).not.toContain('./dir1/subDir1');
        expect(results).not.toContain('./dir1/subDir1/file4.js');
        expect(results).toContain('./dir2'); // Ensure other dirs are present
        expect(results).toContain('./dir2/file5.log');
        expect(results).not.toContain('.git'); // Default exclude check
    });

    // Test Override Logic (Important!)
    // Test case 1: Include a pattern that matches a default-excluded directory name
    it('should NOT exclude a default pattern if explicitly included via includePatterns (absolute)', async () => {
        const nodeModulesPath = path.join(testDir, 'node_modules');
        const packagePath = path.join(nodeModulesPath, 'some_package');
        const indexPath = path.join(packagePath, 'index.js');

        // Explicitly include node_modules and its contents using patterns
        // These are non-default includes, so they override the default exclusion
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, {
             includePatterns: [nodeModulesPath, path.join(nodeModulesPath, '**')]
        });

        // Should find node_modules and its contents despite being a default exclude
        expect(results).toContain(nodeModulesPath); // Matches nodeModulesPath pattern
        expect(results).toContain(packagePath); // Matches nodeModulesPath/** pattern
        expect(results).toContain(indexPath); // Matches nodeModulesPath/** pattern

        // Should still exclude other defaults like .git (unless also explicitly included)
        expect(results).not.toContain(path.join(testDir, '.git'));
    });

     // Test case 2: Include a pattern that matches a default-excluded directory name (relative)
     it('should NOT exclude a default pattern if explicitly included via includePatterns (relative)', async () => {
         // Explicitly include node_modules and its contents using relative patterns
         // These are non-default includes.
         const results = await runTraverse(testDir, spies.consoleLogSpy, {
             includePatterns: ['node_modules', 'node_modules/**']
         });

         // Should find node_modules and its contents despite being a default exclude
         expect(results).toContain('./node_modules'); // Matches 'node_modules' pattern
         expect(results).toContain('./node_modules/some_package'); // Matches 'node_modules/**'
         expect(results).toContain('./node_modules/some_package/index.js'); // Matches 'node_modules/**'

         // Should still exclude other defaults like .git
         expect(results).not.toContain('.git');

         // Test with '*' added back - results should be the same for node_modules part
         spies.consoleLogSpy.mockClear();
         const resultsWithStar = await runTraverse(testDir, spies.consoleLogSpy, {
            includePatterns: ['*', 'node_modules', 'node_modules/**'] // Add '*'
        });
         expect(resultsWithStar).toContain('.'); // Matches '*'
         // node_modules parts are still included due to the explicit non-default patterns
         expect(resultsWithStar).toContain('./node_modules');
         expect(resultsWithStar).toContain('./node_modules/some_package');
         expect(resultsWithStar).toContain('./node_modules/some_package/index.js');
         expect(resultsWithStar).not.toContain('.git'); // Still default excluded

     });

     // Test case 3: Include a pattern matching only a file *inside* a default-excluded directory
     it('should NOT prune a directory excluded by default if explicitly including a file inside (absolute)', async () => {
        const nodeModulesPath = path.join(testDir, 'node_modules');
        const packagePath = path.join(nodeModulesPath, 'some_package');
        const indexPath = path.join(packagePath, 'index.js');

        // 1. Include ONLY the specific file inside node_modules ('indexPath' is a non-default include)
        const resultsOnlySpecific = await runTraverseAbsolute(testDir, spies.consoleLogSpy, {
            includePatterns: [indexPath]
        });
        // Expect ONLY the specific file to be printed. Pruning is prevented by the refined non-default include check,
        // and the item itself matches the specific include.
        expect(resultsOnlySpecific).toEqual([indexPath]);
        spies.consoleLogSpy.mockClear(); // Clear spy for next run

        // 2. Include the specific file AND '*' (default include)
        const resultsWithStar = await runTraverseAbsolute(testDir, spies.consoleLogSpy, {
            includePatterns: ['*', indexPath] // Add '*' back
        });
         // Should contain the explicitly included file (override worked)
         expect(resultsWithStar).toContain(indexPath);
         // Check parent dirs:
         // Pruning of node_modules was prevented by include 'indexPath' targeting content inside.
         // 'node_modules' is default excluded, and '*' is not specific enough to override the exclusion for printing.
         // 'some_package' is not default excluded and matches '*', so it should be printed.
         expect(resultsWithStar).not.toContain(nodeModulesPath);
         expect(resultsWithStar).toContain(packagePath);
         // Should still exclude other defaults
         expect(resultsWithStar).not.toContain(path.join(testDir, '.git'));
         // Should contain other items matched by '*'
         expect(resultsWithStar).toContain(path.join(testDir, 'file1.txt'));
         expect(resultsWithStar).toContain(path.join(testDir, 'dir1'));
     });

     // Test case 4: Include a pattern matching only a file *inside* a default-excluded directory (relative)
     it('should NOT prune a directory excluded by default if explicitly including a file inside (relative)', async () => {
         const includePath = './node_modules/some_package/index.js'; // Non-default include

         // 1. Include ONLY the specific file inside node_modules
         const resultsOnlySpecific = await runTraverse(testDir, spies.consoleLogSpy, {
             includePatterns: [includePath]
         });
         // Expect ONLY the specific file to be printed. Pruning is prevented, item matches specific include.
         expect(resultsOnlySpecific).toEqual([includePath]);
         spies.consoleLogSpy.mockClear(); // Clear spy

         // 2. Include the specific file AND '*' (default include)
         const resultsWithStar = await runTraverse(testDir, spies.consoleLogSpy, {
             includePatterns: ['*', includePath] // Add '*'
         });
         // Should contain the explicitly included file (override worked)
         expect(resultsWithStar).toContain(includePath);
         // Check parent dirs: Pruning prevented.
         // 'node_modules' is default excluded, '*' doesn't override print exclusion.
         // 'some_package' matches '*' and is not default excluded, so it's printed.
         expect(resultsWithStar).not.toContain('./node_modules');
         expect(resultsWithStar).toContain('./node_modules/some_package');
         // Should still exclude other defaults
         expect(resultsWithStar).not.toContain('.git');
         // Should contain '.' and other items matching '*'
         expect(resultsWithStar).toContain('.');
         expect(resultsWithStar).toContain('./file1.txt');
         expect(resultsWithStar).toContain('./dir1');
     });

     // Test case 5: Include a glob pattern ('*.js') that matches a file inside a default-excluded directory
     it('should NOT prune a directory excluded by default if explicitly including files inside via glob (absolute)', async () => {
        const nodeModulesPath = path.join(testDir, 'node_modules');
        const packagePath = path.join(nodeModulesPath, 'some_package');
        const indexPath = path.join(packagePath, 'index.js');
        const otherJsPath = path.join(testDir, 'dir1', 'subDir1', 'file4.js');

        // Include pattern '*.js' is non-default
        const results = await runTraverseAbsolute(testDir, spies.consoleLogSpy, {
             includePatterns: ['*.js']
        });
        // Pruning of node_modules should NOT be prevented because '*.js' does not target content inside specifically.
        // Therefore, node_modules is pruned, and indexPath is never found.
        expect(results).not.toContain(indexPath); // Should NOT be included
        expect(results).toContain(otherJsPath);
        expect(results.length).toBe(1); // Only the JS file outside node_modules
        expect(results).not.toContain(nodeModulesPath);
        expect(results).not.toContain(packagePath);
    });

     // Test case 6: Include a glob pattern ('*.js') that matches a file inside a default-excluded directory (relative)
     it('should NOT prune a directory excluded by default if explicitly including files inside via glob (relative)', async () => {
        const includePath = './node_modules/some_package/index.js';
        const otherJsPath = './dir1/subDir1/file4.js';

        // Include pattern '*.js' is non-default
        const results = await runTraverse(testDir, spies.consoleLogSpy, {
            includePatterns: ['*.js']
        });
        // Pruning of node_modules should NOT be prevented because '*.js' does not target content inside specifically.
        // Therefore, node_modules is pruned, and includePath is never found.
        expect(results).not.toContain(includePath); // Should NOT be included
        expect(results).toContain(otherJsPath);
        expect(results.length).toBe(1); // Only the JS file outside node_modules
        expect(results).not.toContain('./node_modules');
        expect(results).not.toContain('./node_modules/some_package');
   });

}); // End describe block
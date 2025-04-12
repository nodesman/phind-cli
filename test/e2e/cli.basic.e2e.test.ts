// test/e2e/cli.basic.e2e.test.ts
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Basic Execution & Path Handling', () => {
    let testDir: string;
    let realTestDir: string; // Variable for the real path

    beforeEach(async () => {
        // Create the temp directory
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-basic-');
        testDir = await fs.mkdtemp(tempDirPrefix);
        // Resolve the real path after creation
        realTestDir = await fs.realpath(testDir);

        // Use the original testDir path for creating the structure
        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
            'subdir': {
                'nested.js': 'javascript',
            },
            '.hiddenfile': 'hidden',
            'emptyDir': null,
        });
    });

    afterEach(async () => {
        await fs.remove(testDir); // Remove using the original path
    });

    describe('Basic Execution', () => {
        // Test without --relative flag - Expect ABSOLUTE paths
        it('should run with no arguments and find items in current dir (excluding defaults, absolute paths)', () => {
            const result = runCli([], testDir); // Run CLI in the original temp dir
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // Construct expected paths using the REAL path
            const expected = [
                realTestDir, // Use real path for the base
                path.join(realTestDir, '.hiddenfile'),
                path.join(realTestDir, 'doc.txt'),
                path.join(realTestDir, 'emptyDir'),
                path.join(realTestDir, 'image.jpg'),
                path.join(realTestDir, 'subdir'),
                path.join(realTestDir, 'subdir', 'nested.js'),
            ].sort();
            // normalizeAndSort just normalizes separators and sorts
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with specific dir - NO --relative flag - Expect ABSOLUTE paths within
        it('should run with a specific directory path argument (absolute paths)', () => {
            const result = runCli(['subdir'], testDir); // Run CLI in the original temp dir
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // Construct expected paths using the REAL path
            const expected = [
                path.join(realTestDir, 'subdir'), // Use real path
                path.join(realTestDir, 'subdir', 'nested.js'),
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with spaces in name - NO --relative - Expect ABSOLUTE paths
        it('should run targeting a directory with spaces in its name (absolute paths)', async () => {
            const dirWithSpacesOriginal = path.join(testDir, 'dir with spaces');
            const dirWithSpacesReal = path.join(realTestDir, 'dir with spaces'); // Real path counterpart
            await fs.ensureDir(dirWithSpacesOriginal);
            await fs.writeFile(path.join(dirWithSpacesOriginal, 'file inside spaces.txt'), 'space content');

            const result = runCli(['dir with spaces'], testDir); // Run CLI in the original temp dir
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // Construct expected paths using the REAL path
            const expected = [
                dirWithSpacesReal, // Use real path
                path.join(dirWithSpacesReal, 'file inside spaces.txt')
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should exit with status 0 on successful execution', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
        });

        it('should output results to stdout', () => {
            const result = runCli([], testDir);
            expect(result.stdout).toBeDefined();
            // Check length relative to expected output count
            expect(result.stdoutLines.length).toBe(7); // Based on the basic structure and default excludes
        });

        it('should output nothing to stderr on successful execution', () => {
            const result = runCli([], testDir);
            expect(result.stderr).toBe('');
        });
    });

    describe('Path Handling', () => {
        // Test with "." - NO --relative - Expect ABSOLUTE paths
        it('should handle "." as the current directory (absolute paths)', () => {
            const result = runCli(['.'], testDir); // Run CLI in the original temp dir
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
             // Construct expected paths using the REAL path
             const expected = [
                realTestDir, // Use real path
                path.join(realTestDir, '.hiddenfile'),
                path.join(realTestDir, 'doc.txt'),
                path.join(realTestDir, 'emptyDir'),
                path.join(realTestDir, 'image.jpg'),
                path.join(realTestDir, 'subdir'),
                path.join(realTestDir, 'subdir', 'nested.js'),
            ].sort();
             expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with ".." - this is prone to finding unrelated system files and permission errors
        // Modify test to focus only on finding the expected testDir elements relative to parent
        it('should handle ".." to navigate up and find test dir contents (relative to parent)', async () => {
            const parentDir = path.dirname(realTestDir); // Use dirname of the real path
            const testDirName = path.basename(realTestDir); // Use basename of the real path

            // Add the --relative flag to the CLI arguments
            const result = runCli(['..', '--relative'], parentDir);
            expect(result.status).toBe(0);
            // Don't assert empty stderr, as system folders might cause permission errors outside testDir
            // expect(result.stderr).toBe('');

            // Expected paths *relative to the parentDir* where the command was run
            const expectedRelativePaths = [
                testDirName, // The test dir itself relative to parent
                path.join(testDirName, '.hiddenfile'),
                path.join(testDirName, 'doc.txt'),
                path.join(testDirName, 'emptyDir'),
                path.join(testDirName, 'image.jpg'),
                path.join(testDirName, 'subdir'),
                path.join(testDirName, 'subdir', 'nested.js'),
            ].map(p => p.replace(/\\/g, '/')).sort(); // Ensure consistent slashes for comparison

           // Filter stdout to only include lines starting with our testDirName
           const actualPaths = result.stdoutLines
               .filter(line => line.startsWith(testDirName + '/') || line === testDirName)
               .map(line => line.replace(/\\/g, '/')) // Ensure consistent slashes
               .sort();

           // Debugging: Log actual output if it still fails
           if (JSON.stringify(actualPaths) !== JSON.stringify(expectedRelativePaths)) {
               console.log("Mismatched output for '..' test:");
               console.log("Expected:", expectedRelativePaths);
               console.log("Received (filtered):", actualPaths);
               console.log("Raw stdoutLines:", result.stdoutLines);
           }

           expect(actualPaths).toEqual(expectedRelativePaths);
        });

        // Test providing a FILE as input path - should fail
        it('should fail if start path is a relative file path', () => {
            const relativeFilePath = 'doc.txt';
            const result = runCli([relativeFilePath], testDir);
            expect(result.status).not.toBe(0); // Expect non-zero status
            expect(result.stderr).toContain(`Start path "${relativeFilePath}" (resolved to "${path.resolve(testDir, relativeFilePath)}") is not a directory.`); // Expect specific error message
        });

        // Test providing an absolute FILE path - should fail
        it('should fail if start path is an absolute file path', () => {
            const absolutePath = path.join(realTestDir, 'doc.txt'); // Use real path for consistency
            const result = runCli([absolutePath], testDir); // Can run from testDir, path is absolute
            expect(result.status).not.toBe(0); // Expect non-zero status
            expect(result.stderr).toContain(`Start path "${absolutePath}" (resolved to "${absolutePath}") is not a directory.`); // Expect specific error message
        });
    });
});
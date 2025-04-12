// test/e2e/cli.basic.e2e.test.ts
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Basic Execution & Path Handling', () => {
    let testDir: string;

    beforeEach(async () => {
        // Use a simpler structure for basic tests, less likely to hit defaults
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-basic-'));
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
        await fs.remove(testDir);
    });

    describe('Basic Execution', () => {
        // Test without --relative flag - Expect ABSOLUTE paths
        it('should run with no arguments and find items in current dir (excluding defaults, absolute paths)', () => {
            const result = runCli([], testDir); // NO --relative
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // EXPECT ABSOLUTE PATHS
            const expected = [
                path.join(testDir), // Starting directory itself
                path.join(testDir, '.hiddenfile'),
                path.join(testDir, 'doc.txt'),
                path.join(testDir, 'emptyDir'),
                path.join(testDir, 'image.jpg'),
                path.join(testDir, 'subdir'),
                path.join(testDir, 'subdir', 'nested.js'),
            ].sort();
            // normalizeAndSort just normalizes separators and sorts
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with specific dir - NO --relative flag - Expect ABSOLUTE paths within
        it('should run with a specific directory path argument (absolute paths)', () => {
            const result = runCli(['subdir'], testDir); // NO --relative
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // EXPECT ABSOLUTE PATHS including the starting dir itself
            const expected = [
                path.join(testDir, 'subdir'), // The starting dir for the traversal
                path.join(testDir, 'subdir', 'nested.js'),
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with spaces in name - NO --relative - Expect ABSOLUTE paths
        it('should run targeting a directory with spaces in its name (absolute paths)', async () => {
            const dirWithSpaces = path.join(testDir, 'dir with spaces');
            await fs.ensureDir(dirWithSpaces);
            await fs.writeFile(path.join(dirWithSpaces, 'file inside spaces.txt'), 'space content');

            const result = runCli(['dir with spaces'], testDir); // NO --relative
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // EXPECT ABSOLUTE PATHS including the starting dir itself
            const expected = [
                dirWithSpaces, // The starting directory
                path.join(dirWithSpaces, 'file inside spaces.txt')
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
            expect(result.stdout.length).toBeGreaterThan(0);
        });

        it('should output nothing to stderr on successful execution', () => {
            const result = runCli([], testDir);
            expect(result.stderr).toBe('');
        });
    });

    describe('Path Handling', () => {
        // Test with "." - NO --relative - Expect ABSOLUTE paths
        it('should handle "." as the current directory (absolute paths)', () => {
            const result = runCli(['.'], testDir); // NO --relative
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
             // EXPECT ABSOLUTE PATHS
             const expected = [
                path.join(testDir), // Starting directory itself
                path.join(testDir, '.hiddenfile'),
                path.join(testDir, 'doc.txt'),
                path.join(testDir, 'emptyDir'),
                path.join(testDir, 'image.jpg'),
                path.join(testDir, 'subdir'),
                path.join(testDir, 'subdir', 'nested.js'),
            ].sort();
             expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with ".." - this is prone to finding unrelated system files and permission errors
        // Modify test to focus only on finding the expected testDir elements relative to parent
        it('should handle ".." to navigate up and find test dir contents (relative to parent)', async () => {
            const parentDir = path.dirname(testDir);
            const testDirName = path.basename(testDir);

            // Run from parent, target '..'
            const result = runCli(['..'], parentDir);
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
               .filter(line => line.startsWith(testDirName) || line === testDirName)
               .map(line => line.replace(/\\/g, '/')) // Ensure consistent slashes
               .sort();

           expect(actualPaths).toEqual(expectedRelativePaths);
        });

        // Test providing a FILE as input path - should fail
        it('should fail if start path is a relative file path', () => {
            const relativeFilePath = 'doc.txt';
            const result = runCli([relativeFilePath], testDir);
            expect(result.status).not.toBe(0); // Expect non-zero status
            expect(result.stderr).toContain(`is not a directory`); // Expect error message
            expect(result.stderr).toContain(relativeFilePath); // Error message should mention the path
        });

        // Test providing an absolute FILE path - should fail
        it('should fail if start path is an absolute file path', () => {
            const absolutePath = path.join(testDir, 'doc.txt');
            const result = runCli([absolutePath], testDir);
            expect(result.status).not.toBe(0); // Expect non-zero status
            expect(result.stderr).toContain(`is not a directory`); // Expect error message
            expect(result.stderr).toContain(absolutePath); // Error message should mention the absolute path
        });
    });
});
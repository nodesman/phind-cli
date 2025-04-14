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
        // Test default behavior (relative paths, prefixed with ./)
        it('should run with no arguments and find items in current dir (excluding defaults, relative paths)', () => {
            const result = runCli([], realTestDir); // Run CLI using the REAL path for CWD
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // Expect relative paths prefixed with './'
            const expected = [
                '.',
                './.hiddenfile',
                './doc.txt',
                './emptyDir',
                './image.jpg',
                './subdir',
                './subdir/nested.js',
            ].sort();
            // normalizeAndSort handles separators and sorts
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with specific dir argument - expect paths relative to that dir
        it('should run with a specific directory path argument (relative paths)', () => {
            const result = runCli(['subdir'], realTestDir); // Run CLI using the REAL path for CWD, starting in 'subdir'
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // Expect paths relative to 'subdir', prefixed with './'
            const expected = [
                '.', // The 'subdir' itself relative to its base
                './nested.js',
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test with spaces in name - expect paths relative to that dir
        it('should run targeting a directory with spaces in its name (relative paths)', async () => {
            const dirWithSpacesOriginal = path.join(testDir, 'dir with spaces');
            // const dirWithSpacesReal = path.join(realTestDir, 'dir with spaces'); // Real path not needed for relative assertion
            await fs.ensureDir(dirWithSpacesOriginal);
            await fs.writeFile(path.join(dirWithSpacesOriginal, 'file inside spaces.txt'), 'space content');

            const result = runCli(['dir with spaces'], realTestDir); // Run CLI using the REAL path for CWD, start in 'dir with spaces'
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            // Expect paths relative to 'dir with spaces'
            const expected = [
                '.',
                './file inside spaces.txt'
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should exit with status 0 on successful execution (default relative)', () => {
            const result = runCli([], realTestDir); // Use real path
            expect(result.status).toBe(0);
        });

        it('should output results to stdout (default relative)', () => {
            const result = runCli([], realTestDir); // Use real path
            expect(result.stdout).toBeDefined();
            // Check length relative to expected output count (still 7 with relative paths)
            expect(result.stdoutLines.length).toBe(7);
        });

        it('should output nothing to stderr on successful execution (default relative)', () => {
            const result = runCli([], realTestDir); // Use real path
            expect(result.stderr).toBe('');
        });
    });

    describe('Path Handling', () => {
        // Test with "." - Expect RELATIVE paths (default)
        it('should handle "." as the current directory (relative paths)', () => {
            const result = runCli(['.'], realTestDir); // Run CLI using the REAL path for CWD
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
             // Expect relative paths prefixed with './'
             const expected = [
                 '.',
                 './.hiddenfile',
                 './doc.txt',
                 './emptyDir',
                 './image.jpg',
                 './subdir',
                 './subdir/nested.js',
            ].sort();
             expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        // Test providing a FILE as input path - should fail (no change needed)
        it('should fail if start path is a relative file path', () => {
            const relativeFilePath = 'doc.txt';
            // Run the CLI using the real path as CWD so relative resolution is consistent
            const result = runCli([relativeFilePath], realTestDir);
            expect(result.status).not.toBe(0); // Expect non-zero status

            const expectedResolvedPath = path.resolve(realTestDir, relativeFilePath); // Use realTestDir for resolution
            // Check for the outer wrapper message AND the inner "is not a directory" part
            expect(result.stderr).toContain(`Error accessing start path "${relativeFilePath}" (resolved to "${expectedResolvedPath}")`);
            expect(result.stderr).toContain(`is not a directory.`);
        });

        // Test providing an absolute FILE path - should fail (no change needed)
        it('should fail if start path is an absolute file path', () => {
            const absolutePath = path.join(realTestDir, 'doc.txt'); // Use real path for consistency
            // Running from realTestDir, path is absolute
            const result = runCli([absolutePath], realTestDir);
            expect(result.status).not.toBe(0); // Expect non-zero status

            // Check for the outer wrapper message AND the inner "is not a directory" part
            expect(result.stderr).toContain(`Error accessing start path "${absolutePath}" (resolved to "${absolutePath}")`);
            expect(result.stderr).toContain(`is not a directory.`);
        });
    });
});
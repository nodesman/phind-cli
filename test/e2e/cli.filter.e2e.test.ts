// test/e2e/cli.filter.e2e.test.ts
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper'; // Import helpers

describe('CLI E2E - Filtering (Type, Depth)', () => {
    let testDir: string;
    let realTestDir: string; // For macOS /private/var issue

    beforeEach(async () => {
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-filter-'); // Unique prefix
        testDir = await fs.mkdtemp(tempDirPrefix);
        realTestDir = await fs.realpath(testDir); // Resolve symlinks

        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
            'script.js': 'javascript',
            'build': {
                'output.log': 'log data',
                'app.exe': 'executable',
            },
            'src': {
                'main.ts': 'typescript',
                'util.ts': 'typescript utils',
            },
            'empty': null,
        });
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('Type Filtering (--type, -t)', () => {
        it('should find only files when --type f is used', () => {
            const result = runCli(['--type', 'f'], testDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute paths
            const expected = [
                'doc.txt',
                'image.jpg',
                'script.js',
                'build/output.log',
                'build/app.exe',
                'src/main.ts',
                'src/util.ts',
            ].map(f => path.join(realTestDir, f)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should find only directories when --type d is used', () => {
            const result = runCli(['--type', 'd'], testDir);
            expect(result.status).toBe(0);
             // Use realTestDir for expected absolute paths
            const expected = [
                '.', // Should include starting dir itself if --relative is not used
                'build',
                'src',
                'empty'
            ].map(d => path.join(realTestDir, d)).sort();
            // Check that the output *contains* the expected dirs.
            // It might contain the starting dir '.' as well, depending on traverser logic.
            // Update: The base directory itself is printed if it matches criteria.
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should ignore --type if not specified (absolute)', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            const absolutePaths = result.stdoutLines.filter(line => path.isAbsolute(line));
            const relativePaths = result.stdoutLines.filter(line => !path.isAbsolute(line));

            expect(absolutePaths.length).toBeGreaterThan(0); // Should find absolute paths
            expect(relativePaths.length).toBe(0); // Should not find relative paths
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'doc.txt')); // Check a file
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'build')); // Check a directory
        });

         it('should reject invalid values for --type', () => {
             const result = runCli(['--type', 'x'], testDir);
             expect(result.status).not.toBe(0);
             expect(result.stderr).toContain("Invalid values for argument type: Allowed values are f, d");
         });
    });

    describe('Depth Limiting (--maxdepth, -d)', () => {
        it('should find only the starting directory items with --maxdepth 0 (absolute)', () => {
            const result = runCli(['--maxdepth', '0'], testDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute path
            expect(normalizeAndSort(result.stdoutLines)).toEqual([realTestDir]);
        });

        it('should find items up to depth 1 with --maxdepth 1 (absolute)', () => {
            const result = runCli(['--maxdepth', '1'], testDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute paths
            const expected = [
                realTestDir, // Starting directory itself
                'doc.txt',
                'image.jpg',
                'script.js',
                'build',
                'src',
                'empty'
            ].map(f => path.join(realTestDir, f)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should find items up to a specific depth (e.g., 2) (absolute)', () => {
            const result = runCli(['--maxdepth', '2'], testDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute paths
            const expected = [
                realTestDir, // Starting directory itself
                'doc.txt',
                'image.jpg',
                'script.js',
                'build',
                'build/output.log',
                'build/app.exe',
                'src',
                'src/main.ts',
                'src/util.ts',
                'empty',
            ].map(f => path.join(realTestDir, f)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should behave as default (Infinity) if --maxdepth is not specified (absolute)', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            // Check it finds nested items, indicating depth > 2
             expect(result.stdoutLines).toContain(path.join(realTestDir, 'build', 'output.log'));
             expect(result.stdoutLines).toContain(path.join(realTestDir, 'src', 'main.ts'));
             expect(result.stdoutLines.length).toBeGreaterThan(7); // Starting dir + 6 items at depth 1 + 4 at depth 2 = 11
        });

        it('should accept --maxdepth 0', () => {
             const result = runCli(['--maxdepth', '0'], testDir);
             expect(result.status).toBe(0);
             // Use realTestDir for expected absolute path
             expect(normalizeAndSort(result.stdoutLines)).toEqual([realTestDir]);
        });

        it('should reject negative values for --maxdepth', () => {
            const result = runCli(['--maxdepth', '-1'], testDir);
            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain("Argument maxdepth must be a non-negative number");
        });
    });
});
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

        // Use the original testDir path for creating the structure
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
        // Remove using the original path
        await fs.remove(testDir);
    });

    describe('Type Filtering (--type, -t)', () => {
        it('should find only files when --type f is used', () => {
            // Run CLI using the REAL path for CWD to avoid symlink issues during execution
            const result = runCli(['--type', 'f'], realTestDir);
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
             // Run CLI using the REAL path for CWD
            const result = runCli(['--type', 'd'], realTestDir);
            expect(result.status).toBe(0);
             // Use realTestDir for expected absolute paths
            const expected = [
                realTestDir, // Use the realTestDir directly for the starting directory
                path.join(realTestDir, 'build'),
                path.join(realTestDir, 'src'),
                path.join(realTestDir, 'empty'),
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should ignore --type if not specified (absolute)', () => {
             // Run CLI using the REAL path for CWD
            const result = runCli([], realTestDir);
            expect(result.status).toBe(0);
            const absolutePaths = result.stdoutLines.filter(line => path.isAbsolute(line));
            const relativePaths = result.stdoutLines.filter(line => !path.isAbsolute(line));

            expect(absolutePaths.length).toBeGreaterThan(0); // Should find absolute paths
            expect(relativePaths.length).toBe(0); // Should not find relative paths
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'doc.txt')); // Check a file
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'build')); // Check a directory
        });

         it('should reject invalid values for --type', () => {
             // Run CLI using the REAL path for CWD
             const result = runCli(['--type', 'x'], realTestDir);
             expect(result.status).not.toBe(0);
             // Use regex to match core error message regardless of localization
             expect(result.stderr).toMatch(/invalid values|ongeldige waarden/i);
             expect(result.stderr).toContain('Argument: type');
             expect(result.stderr).toMatch(/given: "x"|gegeven: "x"/i);
         });
    });

    describe('Depth Limiting (--maxdepth, -d)', () => {
        it('should find only the starting directory items with --maxdepth 0 (absolute)', () => {
             // Run CLI using the REAL path for CWD
            const result = runCli(['--maxdepth', '0'], realTestDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute path
            expect(normalizeAndSort(result.stdoutLines)).toEqual([realTestDir]);
        });

        it('should find items up to depth 1 with --maxdepth 1 (absolute)', () => {
            // Run CLI using the REAL path for CWD
            const result = runCli(['--maxdepth', '1'], realTestDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute paths
            const expected = [
                realTestDir, // Use realTestDir directly for the starting directory
                path.join(realTestDir, 'doc.txt'),
                path.join(realTestDir, 'image.jpg'),
                path.join(realTestDir, 'script.js'),
                path.join(realTestDir, 'build'),
                path.join(realTestDir, 'src'),
                path.join(realTestDir, 'empty'),
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should find items up to a specific depth (e.g., 2) (absolute)', () => {
             // Run CLI using the REAL path for CWD
            const result = runCli(['--maxdepth', '2'], realTestDir);
            expect(result.status).toBe(0);
            // Use realTestDir for expected absolute paths
            const expected = [
                realTestDir, // Use realTestDir directly for the starting directory
                path.join(realTestDir, 'doc.txt'),
                path.join(realTestDir, 'image.jpg'),
                path.join(realTestDir, 'script.js'),
                path.join(realTestDir, 'build'),
                path.join(realTestDir, 'build', 'output.log'),
                path.join(realTestDir, 'build', 'app.exe'),
                path.join(realTestDir, 'src'),
                path.join(realTestDir, 'src', 'main.ts'),
                path.join(realTestDir, 'src', 'util.ts'),
                path.join(realTestDir, 'empty'),
            ].map(f => path.normalize(f)).sort(); // Normalize expected paths
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should behave as default (Infinity) if --maxdepth is not specified (absolute)', () => {
             // Run CLI using the REAL path for CWD
            const result = runCli([], realTestDir);
            expect(result.status).toBe(0);
            // Check it finds nested items, indicating depth > 1
             expect(result.stdoutLines).toContain(path.join(realTestDir, 'build', 'output.log'));
             expect(result.stdoutLines).toContain(path.join(realTestDir, 'src', 'main.ts'));
             // Check total count: Start dir (1) + Depth 1 (6) + Depth 2 (4) = 11
             expect(result.stdoutLines.length).toBe(11);
        });

        it('should accept --maxdepth 0', () => {
             // Run CLI using the REAL path for CWD
             const result = runCli(['--maxdepth', '0'], realTestDir);
             expect(result.status).toBe(0);
             // Use realTestDir for expected absolute path
             expect(normalizeAndSort(result.stdoutLines)).toEqual([realTestDir]);
        });

        it('should reject negative values for --maxdepth', () => {
             // Run CLI using the REAL path for CWD
            const result = runCli(['--maxdepth', '-1'], realTestDir);
            expect(result.status).not.toBe(0);
            // Check for the specific error message from the application logic
            expect(result.stderr).toContain("Argument maxdepth must be a non-negative number");
        });
    });
});
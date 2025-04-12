// test/e2e/cli.filter.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper'; // Import helpers

describe('CLI E2E - Filtering (Type, Depth)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
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
            const expected = [
                'doc.txt',
                'image.jpg',
                'script.js',
                'build/output.log',
                'build/app.exe',
                'src/main.ts',
                'src/util.ts',
            ].map(f => path.join(testDir, f)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should find only directories when --type d is used', () => {
            const result = runCli(['--type', 'd'], testDir);
            expect(result.status).toBe(0);
            const expected = [
                'build',
                'src',
                'empty'
            ].map(d => path.join(testDir, d)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));

        });

        it('should ignore --type if not specified', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            expect(result.stdoutLines.length).toBeGreaterThan(0); // Should find something
        });

         it('should reject invalid values for --type', () => {
             const result = runCli(['--type', 'x'], testDir);
             expect(result.status).not.toBe(0);
             expect(result.stderr).toContain("Invalid values for argument type: Allowed values are f, d");
         });
    });

    describe('Depth Limiting (--maxdepth, -d)', () => {
        it('should find only the starting directory items with --maxdepth 0', () => {
            const result = runCli(['--maxdepth', '0'], testDir);
            expect(result.status).toBe(0);
            expect(normalizeAndSort(result.stdoutLines)).toEqual([path.join(testDir)]);
        });

        it('should find items up to depth 1 with --maxdepth 1', () => {
            const result = runCli(['--maxdepth', '1'], testDir);
            expect(result.status).toBe(0);
            const expected = [
                'doc.txt',
                'image.jpg',
                'script.js',
                'build',
                'src',
                'empty'
            ].map(f => path.join(testDir, f)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        });

        it('should find items up to a specific depth (e.g., 2)', () => {
            const result = runCli(['--maxdepth', '2'], testDir);
            expect(result.status).toBe(0);
            const expected = [
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
            ].map(f => path.join(testDir, f)).sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        });

        it('should behave as default (Infinity) if --maxdepth is not specified', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            expect(result.stdoutLines.length).toBeGreaterThan(10); // Arbitrary number, just check that it finds more than a shallow search
        });

        it('should accept --maxdepth 0', () => {
             const result = runCli(['--maxdepth', '0'], testDir);
             expect(result.status).toBe(0);
             expect(normalizeAndSort(result.stdoutLines)).toEqual([path.join(testDir)]);
        });

        it('should reject negative values for --maxdepth', () => {
            const result = runCli(['--maxdepth', '-1'], testDir);
            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain("Argument maxdepth must be a non-negative number");
        });
    });
});
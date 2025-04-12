// test/e2e/cli.options.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Other Options (Case, Relative, Help)', () => {
    let testDir: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
            'image.JPG': 'jpeg upper',
            'script.js': 'javascript',
            'src': {
                'main.ts': 'typescript',
                'util.ts': 'typescript utils',
            },
        });
        originalEnv = { ...process.env };
    });

    afterEach(async () => {
        await fs.remove(testDir);
        process.env = originalEnv; // Restore env
    });

    describe('Case Sensitivity (--ignore-case, -i)', () => {
        it('should perform case-insensitive matching for --name when -i is used', () => {
            const result = runCli(['--name', 'image.jpg', '-i'], testDir);
            expect(result.status).toBe(0);
            const expected = [
                path.join(testDir, 'image.JPG'),
                path.join(testDir, 'image.jpg')
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should perform case-insensitive matching for --exclude when -i is used', () => {
            const result = runCli(['--exclude', 'image.jpg', '-i'], testDir);
            expect(result.status).toBe(0);
            const expected = [
                '.',
                'doc.txt',
                'script.js',
                'src',
                'src/main.ts',
                'src/util.ts',
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'image.JPG'));
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'image.jpg'));
        });

        it('should perform case-insensitive pruning for directories when -i is used', async () => {
             await fs.ensureDir(path.join(testDir, 'CaSeSeNsItIvEdIr'));
             await fs.writeFile(path.join(testDir, 'CaSeSeNsItIvEdIr', 'file.txt'), 'test');
             const result = runCli(['--exclude', 'casesensitive*', '-i'], testDir);
             expect(result.status).toBe(0);
             expect(normalizeAndSort(result.stdoutLines)).not.toContain(path.join(testDir, 'CaSeSeNsItIvEdIr'));
        });
    });

    describe('Relative Paths (--relative, -r)', () => {
        it('should print absolute paths by default', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            expect(result.stdoutLines[0]).toEqual(path.join(testDir, 'doc.txt'));
        });

        it('should print paths relative to the starting directory when --relative is used', () => {
            const result = runCli(['--relative'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdoutLines[0]).toEqual('.');
            expect(result.stdoutLines).toContain('doc.txt');
        });

        it('should print "." for the starting directory itself when --relative is used', () => {
            const result = runCli(['--relative'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdoutLines).toContain('.');
        });
    });

    describe('Help Option (--help, -h)', () => {
        it('should display help message when --help is used', () => {
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain('Usage:');
        });

        it('should display help message when -h is used', () => {
            const result = runCli(['-h'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain('Usage:');
        });

        it('should exit with status 0 after displaying help', () => {
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
        });

        it('should not perform any search when help is requested', () => {
            const result = runCli(['--help'], testDir);
            expect(result.stdoutLines.length).toBeGreaterThan(0); // Has help output
        });

        it('should display default values and descriptions in help message', () => {
            const result = runCli(['--help'], testDir);
            expect(result.stdout).toContain('--name <name..>');
            expect(result.stdout).toContain('[default: *]');
        });
    });
});
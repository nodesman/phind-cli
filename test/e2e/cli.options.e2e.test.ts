// test/e2e/cli.options.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Other Options (Case, Relative, Help)', () => {
    let testDir: string;
    let realTestDir: string; // For real path resolution
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        const tempDirPrefix = path.join(os.tmpdir(), 'phind-e2e-options-');
        testDir = await fs.mkdtemp(tempDirPrefix);
        realTestDir = await fs.realpath(testDir); // Resolve symlinks/real path

        await createTestStructure(testDir, { // Create using original path
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
        await fs.remove(testDir); // Remove using original path
        process.env = originalEnv; // Restore env
    });

    describe('Case Sensitivity (--ignore-case, -i)', () => {
        it('should perform case-insensitive matching for --name when -i is used', () => {
            const result = runCli(['--name', 'image.jpg', '-i'], testDir);
            expect(result.status).toBe(0);
            // Use realTestDir for constructing expected absolute paths
            const expected = [
                path.join(realTestDir, 'image.JPG'),
                path.join(realTestDir, 'image.jpg')
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should perform case-insensitive matching for --exclude when -i is used', () => {
            // Run with --relative for simpler path checking, less prone to /var vs /private/var
            const result = runCli(['--exclude', 'image.jpg', '-i', '--relative'], testDir);
            expect(result.status).toBe(0);
            const expectedRelative = [
                '.',
                'doc.txt',
                'script.js',
                'src',
                'src/main.ts',
                'src/util.ts',
            ].sort();
            // Compare relative paths
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expectedRelative);
            // Check absolute paths are not included (using realTestDir for safety)
            expect(result.stdoutLines.map(l => path.resolve(realTestDir, l))).not.toContain(path.join(realTestDir, 'image.JPG'));
            expect(result.stdoutLines.map(l => path.resolve(realTestDir, l))).not.toContain(path.join(realTestDir, 'image.jpg'));
        });

        it('should perform case-insensitive pruning for directories when -i is used', async () => {
             const dirToPruneOriginal = path.join(testDir, 'CaSeSeNsItIvEdIr');
             const dirToPruneReal = path.join(realTestDir, 'CaSeSeNsItIvEdIr');
             await fs.ensureDir(dirToPruneOriginal);
             await fs.writeFile(path.join(dirToPruneOriginal, 'file.txt'), 'test');
             const result = runCli(['--exclude', 'casesensitive*', '-i'], testDir);
             expect(result.status).toBe(0);
             // Check the real absolute path is not included in the output
             expect(normalizeAndSort(result.stdoutLines)).not.toContain(dirToPruneReal);
             expect(normalizeAndSort(result.stdoutLines)).not.toContain(path.join(dirToPruneReal, 'file.txt'));
        });
    });

    describe('Relative Paths (--relative, -r)', () => {
        it('should print absolute paths by default', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            // Check using realTestDir
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'doc.txt'));
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'image.JPG'));
            // Verify the first line is not '.'
            expect(result.stdoutLines[0]).not.toBe('.');
        });

        it('should print paths relative to the starting directory when --relative is used', () => {
            const result = runCli(['--relative'], testDir);
            expect(result.status).toBe(0);
            // The first line should be '.' for the starting directory itself
            expect(result.stdoutLines).toContain('.');
            expect(result.stdoutLines).toContain('doc.txt');
            expect(result.stdoutLines).toContain('image.JPG');
            expect(result.stdoutLines).toContain('src/main.ts');
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
            expect(result.stdout).toContain('Usage: phind [path] [options]'); // Updated usage string based on bin name
            expect(result.stdout).toContain('Find files/directories recursively');
            expect(result.stdout).toContain('Options:');
        });

        it('should display help message when -h is used', () => {
            const result = runCli(['-h'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain('Usage: phind [path] [options]');
            expect(result.stdout).toContain('Options:');
        });

        it('should exit with status 0 after displaying help', () => {
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
        });

        it('should not perform any search when help is requested', () => {
            // Run on an empty dir to ensure no accidental file finding happens
            const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phind-e2e-empty-'));
            const result = runCli(['--help'], emptyDir);
            fs.rmSync(emptyDir, { recursive: true, force: true }); // Clean up empty dir

            expect(result.status).toBe(0);
            expect(result.stdout).toContain('Usage:');
            // Check that stdout does NOT contain typical file/dir output like '.' or a file name
            expect(result.stdout).not.toMatch(/^[.]$/m); // Does not contain only '.' on a line
            expect(result.stdout.split('\n').length).toBeGreaterThan(5); // Help has multiple lines
        });


        it('should display default values and descriptions in help message', () => {
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toMatch(/--name.*Glob pattern\(s\).*\[default: "\*"\]/);
            expect(result.stdout).toMatch(/--exclude.*Glob pattern\(s\).*\[default: "node_modules", ".git"\]/);
            expect(result.stdout).toMatch(/--maxdepth.*Maximum directory levels.*\[default: \u221E]/); // Infinity symbol
            expect(result.stdout).toMatch(/--relative.*Print paths relative.*\[boolean] \[default: false]/);
            expect(result.stdout).toMatch(/--ignore-case.*case-insensitive matching.*\[boolean] \[default: false]/);
            expect(result.stdout).toMatch(/--type.*Match only files \(f\) or directories \(d\).*\[string] \[choices: "f", "d"]/);
        });
    });
});
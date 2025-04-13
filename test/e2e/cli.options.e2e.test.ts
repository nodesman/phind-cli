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
            // 'image.JPG': 'jpeg upper', // <<< CHANGE THIS
            'image_upper.JPG': 'jpeg upper', // <<< TO THIS (unique name)
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
        // This test might fail if there's an underlying issue with case handling
        // in the code or environment, but the expectation itself is correct for -i.
        it('should perform case-insensitive matching for --name when -i is used', () => {
            // --- FIX: Use a pattern that matches both unique files with -i ---
            // const result = runCli(['--name', 'image.jpg', '-i'], testDir); // <<< ORIGINAL
            const result = runCli(['--name', '*.jpg', '-i'], testDir); // <<< FIXED PATTERN
            expect(result.status).toBe(0);
            // Use realTestDir for constructing expected absolute paths
            const expected = [
                // path.join(realTestDir, 'image.JPG'), // <<< CHANGE THIS
                path.join(realTestDir, 'image_upper.JPG'), // <<< TO THIS
                path.join(realTestDir, 'image.jpg')
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should perform case-insensitive matching for --exclude when -i is used', () => {
            // Run with --relative for simpler path checking, less prone to /var vs /private/var
            // Use '*.jpg' pattern with -i to exclude both 'image.jpg' and 'image_upper.JPG'
            const result = runCli(['--exclude', '*.jpg', '-i', '--relative'], testDir);
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
            // Check that neither of the excluded files is present (relative check is sufficient here)
            expect(result.stdoutLines).not.toContain('image.jpg');
            expect(result.stdoutLines).not.toContain('image_upper.JPG');
        });

        it('should perform case-insensitive pruning for directories when -i is used', async () => {
             const dirToPruneOriginal = path.join(testDir, 'CaSeSeNsItIvEdIr');
             const dirToPruneReal = path.join(realTestDir, 'CaSeSeNsItIvEdIr');
             await fs.ensureDir(dirToPruneOriginal);
             await fs.writeFile(path.join(dirToPruneOriginal, 'file.txt'), 'test');
             // Use runCli with the original testDir path as cwd
             const result = runCli(['--exclude', 'casesensitive*', '-i'], testDir);
             expect(result.status).toBe(0);
             // Check the real absolute path is not included in the output
             expect(normalizeAndSort(result.stdoutLines)).not.toContain(dirToPruneReal);
             expect(normalizeAndSort(result.stdoutLines)).not.toContain(path.join(dirToPruneReal, 'file.txt'));
        });
    });

    describe('Relative Paths (--relative, -r)', () => {
        // This test might fail if there's an underlying case issue in the code/env.
        it('should print absolute paths by default', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            // Check using realTestDir for assertions
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'doc.txt'));
            // expect(result.stdoutLines).toContain(path.join(realTestDir, 'image.JPG')); // <<< CHANGE THIS
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'image_upper.JPG')); // <<< TO THIS
            // Verify the first line is not '.' (unless the base dir is the only result, unlikely here)
            if (result.stdoutLines.length > 1) {
                expect(result.stdoutLines[0]).not.toBe('.');
            } else if (result.stdoutLines.length === 1) {
                 expect(result.stdoutLines[0]).toBe(realTestDir); // Base dir itself if only match
            }
        });

        // This test might fail if there's an underlying case issue in the code/env.
        it('should print paths relative to the starting directory when --relative is used', () => {
             // Use runCli with the original testDir path as cwd
            const result = runCli(['--relative'], testDir);
            expect(result.status).toBe(0);
            // The first line should be '.' for the starting directory itself
            expect(result.stdoutLines).toContain('.');
            expect(result.stdoutLines).toContain('doc.txt');
            // expect(result.stdoutLines).toContain('image.JPG'); // <<< CHANGE THIS
            expect(result.stdoutLines).toContain('image_upper.JPG'); // <<< TO THIS
            expect(result.stdoutLines).toContain('src/main.ts');
        });

        it('should print "." for the starting directory itself when --relative is used', () => {
             // Use runCli with the original testDir path as cwd
            const result = runCli(['--relative'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdoutLines).toContain('.');
        });
    });

    describe('Help Option (--help, -h)', () => {
        // Use regex to be less sensitive to exact script name (cli.js vs phind) and localization
        it('should display help message when --help is used', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toMatch(/Usage: .*(phind|cli\.js) \[path] \[options]/); // Check Usage line format
            // --- END FIX ---
            expect(result.stdout).toMatch(/Options:/i);
        });

        it('should display help message when -h is used', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['-h'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toMatch(/Usage: .*(phind|cli\.js) \[path] \[options]/); // Check Usage line format
            // --- END FIX ---
            expect(result.stdout).toMatch(/Options:/i);
        });

        it('should exit with status 0 after displaying help', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
        });

        it('should not perform any search when help is requested', () => {
            // Run on an empty dir to ensure no accidental file finding happens
            const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phind-e2e-empty-'));
            let result: ReturnType<typeof runCli>;
            try {
                // Use runCli with the emptyDir path as cwd
                result = runCli(['--help'], emptyDir);
            } finally {
                fs.rmSync(emptyDir, { recursive: true, force: true }); // Clean up empty dir
            }

            expect(result.status).toBe(0);
            expect(result.stdout).toMatch(/Usage:/i);
            // Check that stdout does NOT contain typical file/dir output like '.' or a file name
            expect(result.stdout).not.toMatch(/^\.$/m); // Does not contain only '.' on a line relative path start
            expect(result.stdout).not.toContain(path.normalize(emptyDir)); // Does not contain absolute path start
            expect(result.stdout.split('\n').length).toBeGreaterThan(5); // Help has multiple lines
        });

        it('should display default values and descriptions in help message', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
            // --- FIX: Adjust regex patterns to match yargs output ---
            // Use regex, make spacing flexible (\s*), check for key parts
            // Use \s+ for flexible whitespace matching
            expect(result.stdout).toMatch(/--name\s+.*Glob pattern\(s\).*\s+\[array]\s+\[default: "\*" \(all files\/dirs\)\]/);
            expect(result.stdout).toMatch(/--exclude\s+.*Glob pattern\(s\).*\s+\[array]\s+\[default: "node_modules", ".git"\]/);
            expect(result.stdout).toMatch(/--maxdepth\s+.*Maximum directory levels.*\s+\[number]\s+\[default: Infinity]/);
            expect(result.stdout).toMatch(/--relative\s+.*Print paths relative.*\s+\[boolean]\s+\[default: false]/);
            expect(result.stdout).toMatch(/--ignore-case\s+.*case-insensitive matching.*\s+\[boolean]\s+\[default: false]/);
            expect(result.stdout).toMatch(/--type\s+.*Match only files \(f\) or directories \(d\).*\s+\[string]\s+\[choices: "f", "d"]/);
            // --- END FIX ---
        });
    });
});
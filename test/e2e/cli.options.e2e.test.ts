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
            'image_upper.JPG': 'jpeg upper', // Unique name
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
            // Default is now relative paths, prefixed with './'
            const result = runCli(['--name', '*.jpg', '-i'], testDir);
            expect(result.status).toBe(0);
            const expected = [
                './image.jpg',
                './image_upper.JPG'
            ].sort();
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expected);
        });

        it('should perform case-insensitive matching for --exclude when -i is used', () => {
            // Explicitly use --relative (which is default, but reinforces the test intent)
            // Use '*.jpg' pattern with -i to exclude both 'image.jpg' and 'image_upper.JPG'
            const result = runCli(['--exclude', '*.jpg', '-i', '--relative'], testDir);
            expect(result.status).toBe(0);
            // Expected paths are relative and prefixed with './' (except '.')
            const expectedRelative = [
                '.',
                './doc.txt',
                './script.js',
                './src',
                './src/main.ts',
                './src/util.ts',
            ].sort();
            // Compare relative paths
            expect(normalizeAndSort(result.stdoutLines)).toEqual(expectedRelative);
            // Check that neither of the excluded files is present (relative check is sufficient here)
            expect(result.stdoutLines).not.toContain('./image.jpg');
            expect(result.stdoutLines).not.toContain('./image_upper.JPG');
        });

        it('should perform case-insensitive pruning for directories when -i is used', async () => {
             const dirToPruneOriginal = path.join(testDir, 'CaSeSeNsItIvEdIr');
             const dirToPruneReal = path.join(realTestDir, 'CaSeSeNsItIvEdIr'); // For checking absence
             const fileInDirReal = path.join(dirToPruneReal, 'file.txt'); // For checking absence

             await fs.ensureDir(dirToPruneOriginal);
             await fs.writeFile(path.join(dirToPruneOriginal, 'file.txt'), 'test');

             // Default is relative paths. Use testDir as CWD.
             const result = runCli(['--exclude', 'casesensitive*', '-i'], testDir);
             expect(result.status).toBe(0);

             // Check the relative paths are not included in the output
             expect(normalizeAndSort(result.stdoutLines)).not.toContain('./CaSeSeNsItIvEdIr');
             expect(normalizeAndSort(result.stdoutLines)).not.toContain('./CaSeSeNsItIvEdIr/file.txt');
             // Sanity check that other relative files are present
             expect(normalizeAndSort(result.stdoutLines)).toContain('./doc.txt');
        });
    });

    describe('Path Output Style (--relative)', () => {
        it('should print absolute paths when --relative=false is used', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['--relative=false'], testDir);
            expect(result.status).toBe(0);
            // Check using realTestDir for assertions
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'doc.txt'));
            expect(result.stdoutLines).toContain(path.join(realTestDir, 'image_upper.JPG'));
            // Verify the first line is not '.'
            if (result.stdoutLines.length > 0) {
                expect(result.stdoutLines[0]).not.toBe('.');
                 // Check if the first line is the absolute path of the base directory
                 expect(result.stdoutLines).toContain(realTestDir);
            }
        });

        it('should print relative paths (prefixed with ./) by default', () => {
            // Use runCli with the original testDir path as cwd, no flag needed
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            // The first line should be '.' for the starting directory itself
            expect(result.stdoutLines).toContain('.');
            expect(result.stdoutLines).toContain('./doc.txt');
            expect(result.stdoutLines).toContain('./image_upper.JPG');
            expect(result.stdoutLines).toContain('./src/main.ts');
        });

        it('should print "." for the starting directory itself by default', () => {
            // Use runCli with the original testDir path as cwd, no flag needed
            const result = runCli([], testDir);
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
            expect(result.stdout).toMatch(/Options:/i);
        });

        it('should display help message when -h is used', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['-h'], testDir);
            expect(result.status).toBe(0);
            expect(result.stdout).toMatch(/Usage: .*(phind|cli\.js) \[path] \[options]/); // Check Usage line format
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
            expect(result.stdout).not.toMatch(/^\.\//m); // Does not contain './' prefixed lines
            expect(result.stdout).not.toContain(path.normalize(emptyDir)); // Does not contain absolute path start
            expect(result.stdout.split('\n').length).toBeGreaterThan(5); // Help has multiple lines
        });

        it('should display default values and descriptions in help message', () => {
            // Use runCli with the original testDir path as cwd
            const result = runCli(['--help'], testDir);
            expect(result.status).toBe(0);
            // Adjust regex patterns to match yargs output and new defaults
            expect(result.stdout).toMatch(/--name\s+.*Glob pattern\(s\).*\[array].*\[default: "\*" \(all files\/dirs\)\]/s);
            expect(result.stdout).toMatch(/--exclude\s+.*Glob pattern\(s\).*\[array].*\[default: "node_modules", ".git", ".gradle"\]/s);
            expect(result.stdout).toMatch(/--maxdepth\s+.*Maximum directory levels.*\[number].*\[default: Infinity]/s);
            // Check the updated relative option default and description
            expect(result.stdout).toMatch(/--relative\s+.*Print paths relative.*\(default\).*Use --relative=false for absolute paths\..*\[boolean].*\[default: true \(relative paths\)\]/s);
            expect(result.stdout).toMatch(/--ignore-case\s+.*case-insensitive matching.*\[boolean].*\[default: false]/s);
            expect(result.stdout).toMatch(/--type\s+.*Match only files \(f\) or directories \(d\).*\[string].*\[choices: "f", "d"]/s);
        });
    });
});
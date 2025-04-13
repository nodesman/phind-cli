// test/e2e/cli.exclude.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { createTestStructure, runCli, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Excludes (Default, CLI, Global)', () => {
    let testDir: string;
    // Store the RELATIVE path within testDir for the fake global ignore
    const relativeGlobalIgnoreDir = '.config/phind';
    const globalIgnoreFilename = 'ignore';
    let relativeGlobalIgnorePath: string; // e.g., '.config/phind/ignore'
    let absoluteGlobalIgnorePath: string; // Full path for writing the file

    const testStructure = {
        'doc.txt': 'text',
        'image.jpg': 'jpeg',
        'script.js': 'javascript',
        '.config': { 'app.conf': 'config file' }, // This directory will be used for the fake global ignore parent
        'build': {
            'output.log': 'log data',
            'app.exe': 'executable',
        },
        'node_modules': { 'package': { 'index.js': '' } },
        '.git': { 'HEAD': '' },
        'src': {
            'main.ts': 'typescript',
            'util.ts': 'typescript utils',
        },
        'excluded.tmp': 'temp file',
        'empty': null,
    };

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
        await createTestStructure(testDir, testStructure);
        // Calculate paths based on testDir
        relativeGlobalIgnorePath = path.join(relativeGlobalIgnoreDir, globalIgnoreFilename).replace(/\\/g, '/'); // Ensure consistent separators
        absoluteGlobalIgnorePath = path.join(testDir, relativeGlobalIgnorePath);
        // Ensure the directory structure exists within the temp dir for writing the file
        await fs.ensureDir(path.dirname(absoluteGlobalIgnorePath));
    });


    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('Default Excludes', () => {
        it('should exclude node_modules by default', () => {
            const result = runCli([], testDir);
            const normalizedOutput = result.stdoutLines.map(line => path.relative(testDir, line));
            expect(normalizedOutput).not.toContain('node_modules');
            expect(normalizedOutput).not.toContain(path.join('node_modules', 'package'));
        });

        it('should exclude .git by default', () => {
            const result = runCli([], testDir);
            const normalizedOutput = result.stdoutLines.map(line => path.relative(testDir, line));
            expect(normalizedOutput).not.toContain('.git');
            expect(normalizedOutput).not.toContain(path.join('.git', 'HEAD'));
        });

        it('should include node_modules if explicitly included via --name (and default exclude is bypassed by specific include)', () => {
            // Run with relative paths for simpler assertion
            // Use --name 'node_modules/**' - expects contents, NOT the directory itself based on standard glob interpretation
            const result = runCli(['--name', 'node_modules/**', '--relative'], testDir);
            const expectedRelative = [
                 // 'node_modules', // <<< Should NOT be included by 'node_modules/**'
                 'node_modules/package',
                 'node_modules/package/index.js'
                ].sort();
             // Use normalizeAndSort which handles path separators
             const receivedNormalized = normalizeAndSort(result.stdoutLines);
             expect(receivedNormalized).toEqual(expect.arrayContaining(expectedRelative));
             expect(receivedNormalized).toContain('node_modules/package/index.js');
             // --- FIX: Assertion reflects standard glob behavior ---
             expect(receivedNormalized).not.toContain('node_modules'); // The directory itself should not match '**'
             // --- END FIX ---
             expect(receivedNormalized.length).toBe(expectedRelative.length); // Ensure no extra items
        });

        it('should include .git if explicitly included via --name (and default exclude is bypassed by specific include)', () => {
             // Run with relative paths for simpler assertion
             // Use --name '.git/**' - expects contents, NOT the directory itself
             const result = runCli(['--name', '.git/**', '--relative'], testDir);
             const expectedRelative = [
                 // '.git', // <<< Should NOT be included by '.git/**'
                 '.git/HEAD'
                ].sort();
             // Use normalizeAndSort which handles path separators
             const receivedNormalized = normalizeAndSort(result.stdoutLines);
             expect(receivedNormalized).toEqual(expect.arrayContaining(expectedRelative));
             expect(receivedNormalized).toContain('.git/HEAD');
             // --- FIX: Assertion reflects standard glob behavior ---
             expect(receivedNormalized).not.toContain('.git'); // The directory itself should not match '**'
             // --- END FIX ---
             expect(receivedNormalized.length).toBe(expectedRelative.length); // Ensure no extra items
        });
    });

    describe('Exclude Patterns (--exclude, -e)', () => {
        it('should exclude files matching a single --exclude pattern (relative)', () => {
            const result = runCli(['--exclude', '*.txt', '--relative'], testDir);
            expect(result.stdoutLines).not.toContain('doc.txt');
            expect(result.stdoutLines).toContain('script.js'); // Ensure other files present
        });

        it('should exclude files matching multiple --exclude patterns (relative)', () => {
            const result = runCli(['--exclude', '*.txt', '--exclude', '*.js', '--relative'], testDir);
            expect(result.stdoutLines).not.toContain('doc.txt');
            expect(result.stdoutLines).not.toContain('script.js');
            expect(result.stdoutLines).toContain('image.jpg'); // Ensure other files
        });

        it('should exclude files based on glob patterns (e.g., build/*.log) (relative)', () => {
            const result = runCli(['--exclude', 'build/*.log', '--relative'], testDir);
            expect(result.stdoutLines).not.toContain('build/output.log');
            expect(result.stdoutLines).toContain('build/app.exe'); // Ensure other file in dir is there
            expect(result.stdoutLines).toContain('build'); // Ensure parent dir is still there if not pruned explicitly
            expect(result.stdoutLines).toContain('script.js');
        });

        it('should exclude hidden files/dirs when pattern allows (e.g., .config) (relative)', () => {
             // Exclude .config specifically, not using '.*' to avoid excluding .git
             const result = runCli(['--exclude', '.config', '--relative'], testDir);
             expect(result.stdoutLines).not.toContain('.config'); // Directory itself is excluded (pruned)
             expect(result.stdoutLines).not.toContain('.config/app.conf'); // Content implicitly excluded
             // .git should still be excluded by default
             expect(result.stdoutLines).not.toContain('.git');
             expect(result.stdoutLines).toContain('doc.txt'); // Sanity check non-hidden
        });

        it('should exclude entire directories and their contents (pruning) (relative)', () => {
             const result = runCli(['--exclude', 'build', '--relative'], testDir);
             expect(result.stdoutLines).not.toContain('build');
             expect(result.stdoutLines).not.toContain('build/output.log');
             expect(result.stdoutLines).not.toContain('build/app.exe');
             expect(result.stdoutLines).toContain('script.js'); // Other files still present
        });

        it('should prioritize --exclude over --name if patterns overlap (relative)', () => {
            // Find all *.tmp files except excluded.tmp
            const result = runCli(['--name', '*.tmp', '--exclude', 'excluded.tmp', '--relative'], testDir);
            expect(result.stdoutLines).not.toContain('excluded.tmp');
             // Add another tmp file to ensure the name pattern *could* find something
             fs.writeFileSync(path.join(testDir, 'another.tmp'), 'test');
             const result2 = runCli(['--name', '*.tmp', '--exclude', 'excluded.tmp', '--relative'], testDir);
             expect(result2.stdoutLines).toContain('another.tmp');
             expect(result2.stdoutLines).not.toContain('excluded.tmp');
             expect(result2.stderr).toBe('');
        });

        it('should handle --exclude patterns with case sensitivity by default (relative)', () => {
            const result = runCli(['--exclude', 'DOC.TXT', '--relative'], testDir);
             // 'DOC.TXT' doesn't exist, so this exclude pattern has no effect on 'doc.txt'
            expect(result.stdoutLines).toContain('doc.txt');
        });

         it('should exclude based on case sensitivity when the file exists (relative)', async () => {
            // Create uppercase file to test exclusion
            await fs.writeFile(path.join(testDir, 'DOC.TXT'), 'uppercase doc');
            const result = runCli(['--exclude', 'DOC.TXT', '--relative'], testDir);
            expect(result.stdoutLines).not.toContain('DOC.TXT'); // Should be excluded
            expect(result.stdoutLines).toContain('doc.txt'); // Lowercase should remain
        });
    });

    describe('Global Ignore File (--no-global-ignore)', () => {
        // Helper to write the fake global ignore file
        const ensureGlobalIgnoreFile = async (content: string) => {
             await fs.ensureDir(path.dirname(absoluteGlobalIgnorePath));
             await fs.writeFile(absoluteGlobalIgnorePath, content);
        };

        it('should load and apply excludes from the global ignore file by default (relative)', async () => {
            await ensureGlobalIgnoreFile('*.tmp\nbuild'); // Exclude *.tmp and the build dir

            // Pass the RELATIVE path to runCli helper
            const result = runCli(['--relative'], testDir, {}, relativeGlobalIgnorePath);

            expect(result.stdoutLines).not.toContain('excluded.tmp'); // Globally excluded file
            expect(result.stdoutLines).not.toContain('build'); // Globally excluded directory (pruned)
            expect(result.stdoutLines).not.toContain('build/output.log'); // Content of pruned dir

            // Default excludes still apply
            expect(result.stdoutLines).not.toContain('node_modules');
            expect(result.stdoutLines).not.toContain('.git');

            // Other files should be present
            expect(result.stdoutLines).toContain('doc.txt'); // Sanity check
            expect(result.stdoutLines).toContain('src');
            expect(result.stdoutLines).toContain('.');
        });

        it('should NOT load global ignores when --no-global-ignore is specified (relative)', async () => {
            await ensureGlobalIgnoreFile('*.tmp\nbuild'); // Define global excludes

            // Pass the relative path, but the flag should prevent its use
            const result = runCli(['--no-global-ignore', '--relative'], testDir, {}, relativeGlobalIgnorePath);

            // --- BEGIN ADDED CHECKS ---
            // Check for unexpected errors and non-zero exit code
            if (result.status !== 0 || result.stderr) {
                console.error(`Test failed unexpectedly:\nStatus: ${result.status}\nStderr:\n${result.stderr}\nStdout:\n${result.stdout}`);
            }
            expect(result.stderr).toBe(''); // Expect no errors printed to stderr
            expect(result.status).toBe(0);  // Expect successful exit code
            // --- END ADDED CHECKS ---

            // Global excludes should NOT be applied
            expect(result.stdoutLines).toContain('excluded.tmp');
            expect(result.stdoutLines).toContain('build');
            expect(result.stdoutLines).toContain('build/output.log'); // Content should be found

            // Default excludes still apply
            expect(result.stdoutLines).not.toContain('node_modules');
            expect(result.stdoutLines).not.toContain('.git');

            // Other files should be present
            expect(result.stdoutLines).toContain('doc.txt');
            // In relative mode, the starting directory itself should be listed as '.' if it matches filters
            expect(result.stdoutLines).toContain('.');
        });

        it('should combine global ignores with default and CLI excludes (relative)', async () => {
            await ensureGlobalIgnoreFile('*.log'); // Global: exclude logs

            // Pass the relative path
            const result = runCli(['--exclude', '*.tmp', '--relative'], testDir, {}, relativeGlobalIgnorePath); // CLI: exclude *.tmp

            // Check exclusions from all sources
            expect(result.stdoutLines).not.toContain('excluded.tmp');      // CLI exclude
            expect(result.stdoutLines).not.toContain('build/output.log'); // Global exclude
            expect(result.stdoutLines).not.toContain('node_modules');     // Default exclude
            expect(result.stdoutLines).not.toContain('.git');             // Default exclude

            // Check remaining files
            expect(result.stdoutLines).toContain('doc.txt');
            expect(result.stdoutLines).toContain('build'); // Dir itself not excluded by *.log
            expect(result.stdoutLines).toContain('build/app.exe'); // Other file in build
            expect(result.stdoutLines).toContain('.');
        });

        it('should handle non-existent global ignore file gracefully', async () => {
            // Ensure the global ignore file definitely doesn't exist for this test run
            await fs.remove(absoluteGlobalIgnorePath);

            // Pass the relative path of the non-existent file
            const result = runCli(['--relative'], testDir, {}, relativeGlobalIgnorePath);

            expect(result.status).toBe(0);
            expect(result.stderr).toBe(''); // No error message about missing file

            // Check for presence of specific files/dirs relative to testDir
            expect(result.stdoutLines).toContain('.'); // The starting directory itself
            expect(result.stdoutLines).toContain('doc.txt'); // Sanity check file
            expect(result.stdoutLines).toContain('excluded.tmp'); // Should be found as no global exclude applied
            expect(result.stdoutLines).toContain('build'); // Directory should be found
            expect(result.stdoutLines).toContain('.config'); // Hidden dir should be found (contains app.conf)

            // Check that default excludes ARE still applied
            expect(result.stdoutLines).not.toContain('node_modules');
            expect(result.stdoutLines).not.toContain('.git');
        });
    });
});
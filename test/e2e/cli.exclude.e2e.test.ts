// test/e2e/cli.exclude.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { createTestStructure, runCli, normalizeAndSort } from './cli.helper';

describe('CLI E2E - Excludes (Default, CLI, Global)', () => {
    let testDir: string;
    let globalIgnoreFilePath: string;

    const testStructure = {
        'doc.txt': 'text',
        'image.jpg': 'jpeg',
        'script.js': 'javascript',
        '.config': { 'app.conf': 'config file' },
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
        // Determine the expected path for the global ignore file *within the temp dir* for testing purposes
        // This simulates where PhindConfig would look if the homedir/.config were this temp dir.
        // Note: This path might not perfectly match the real PhindConfig logic in all edge cases (like XDG),
        // but it's sufficient for testing the --no-global-ignore flag functionality.
        const configDir = path.join(testDir, '.config');
        globalIgnoreFilePath = path.join(configDir, 'phind', 'ignore');
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('Default Excludes', () => {
        it('should exclude node_modules by default', () => {
            const result = runCli([], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'node_modules'));
            // Check relative path as well just in case
            expect(result.stdoutLines).not.toContain('node_modules');
        });

        it('should exclude .git by default', () => {
            const result = runCli([], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, '.git'));
            // Check relative path as well just in case
             expect(result.stdoutLines).not.toContain('.git');
        });

        it('should include node_modules if explicitly included via --name (and default exclude is bypassed by specific include)', () => {
            // Run with relative paths for simpler assertion
             const result = runCli(['--name', 'node_modules/**', '--relative'], testDir);
             const expectedRelative = [
                 'node_modules',
                 'node_modules/package',
                 'node_modules/package/index.js'
                ].sort();
             // Use normalizeAndSort which handles path separators
             const receivedNormalized = normalizeAndSort(result.stdoutLines);
             expect(receivedNormalized).toEqual(expect.arrayContaining(expectedRelative));
             expect(receivedNormalized).toContain('node_modules/package/index.js');
             expect(receivedNormalized).toContain('node_modules');
        });

        it('should include .git if explicitly included via --name (and default exclude is bypassed by specific include)', () => {
             // Run with relative paths for simpler assertion
             const result = runCli(['--name', '.git/**', '--relative'], testDir);
             const expectedRelative = [
                 '.git',
                 '.git/HEAD'
                ].sort();
             // Use normalizeAndSort which handles path separators
             const receivedNormalized = normalizeAndSort(result.stdoutLines);
             expect(receivedNormalized).toEqual(expect.arrayContaining(expectedRelative));
             expect(receivedNormalized).toContain('.git');
             expect(receivedNormalized).toContain('.git/HEAD');
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
            expect(result.stdoutLines).toContain('build'); // Ensure parent dir is still there
            expect(result.stdoutLines).toContain('script.js');
        });

        it('should exclude hidden files/dirs when pattern allows (e.g., .*) (relative)', () => {
             const result = runCli(['--exclude', '.*', '--relative'], testDir);
             expect(result.stdoutLines).not.toContain('.config'); // Directory itself is excluded
             expect(result.stdoutLines).not.toContain('.config/app.conf'); // Content implicitly excluded
             expect(result.stdoutLines).not.toContain('.git'); // Default exclude also matches .*
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
            // Find all .txt files except doc.txt
            const result = runCli(['--name', '*.txt', '--exclude', 'doc.txt', '--relative'], testDir);
            expect(result.stdoutLines).not.toContain('doc.txt');
            expect(result.stdoutLines).toContain('excluded.tmp'); // Should find the other txt file
            expect(result.stderr).toBe('');
        });

        it('should handle --exclude patterns with case sensitivity by default (relative)', () => {
            const result = runCli(['--exclude', 'IMAGE.JPG', '--relative'], testDir);
             // 'IMAGE.JPG' doesn't exist, so this exclude pattern has no effect
             // We expect to still see 'image.jpg'
            expect(result.stdoutLines).toContain('image.jpg');
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
        // Helper to ensure the directory for the fake global ignore exists
        const ensureGlobalIgnoreDir = async () => {
             await fs.ensureDir(path.dirname(globalIgnoreFilePath));
        };

        it('should load and apply excludes from the global ignore file by default (relative)', async () => {
            await ensureGlobalIgnoreDir();
            await fs.writeFile(globalIgnoreFilePath, '*.tmp\nbuild'); // Exclude *.tmp and the build dir

            const result = runCli(['--relative'], testDir); // Use relative for consistency

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
            await ensureGlobalIgnoreDir();
            await fs.writeFile(globalIgnoreFilePath, '*.tmp\nbuild'); // Define global excludes

            const result = runCli(['--no-global-ignore', '--relative'], testDir); // Add flag

            // Global excludes should NOT be applied
            expect(result.stdoutLines).toContain('excluded.tmp');
            expect(result.stdoutLines).toContain('build');
            expect(result.stdoutLines).toContain('build/output.log'); // Content should be found

            // Default excludes still apply
            expect(result.stdoutLines).not.toContain('node_modules');
            expect(result.stdoutLines).not.toContain('.git');

            // Other files should be present
            expect(result.stdoutLines).toContain('doc.txt');
            expect(result.stdoutLines).toContain('.');
        });

        it('should combine global ignores with default and CLI excludes (relative)', async () => {
            await ensureGlobalIgnoreDir();
            await fs.writeFile(globalIgnoreFilePath, '*.log'); // Global: exclude logs

            const result = runCli(['--exclude', '*.tmp', '--relative'], testDir); // CLI: exclude *.tmp

            // Check exclusions from all sources
            expect(result.stdoutLines).not.toContain('excluded.tmp');      // CLI exclude
            expect(result.stdoutLines).not.toContain('build/output.log'); // Global exclude
            expect(result.stdoutLines).not.toContain('node_modules');     // Default exclude
            expect(result.stdoutLines).not.toContain('.git');             // Default exclude

            // Check remaining files
            expect(result.stdoutLines).toContain('doc.txt');
            expect(result.stdoutLines).toContain('build'); // Dir itself not excluded
            expect(result.stdoutLines).toContain('build/app.exe'); // Other file in build
            expect(result.stdoutLines).toContain('.');
        });

        it('should handle non-existent global ignore file gracefully', () => {
            // Ensure the global ignore file definitely doesn't exist for this test run
            // (it shouldn't by default in the clean temp dir, but belts and suspenders)
            fs.removeSync(globalIgnoreFilePath); // Use sync for simplicity in test setup

            // **** Use --relative ****
            const result = runCli(['--relative'], testDir);

            expect(result.status).toBe(0);
            expect(result.stderr).toBe(''); // No error message about missing file

            // **** Expect relative paths ****
            // Check for presence of specific files/dirs relative to testDir
            expect(result.stdoutLines).toContain('.'); // The starting directory itself
            expect(result.stdoutLines).toContain('doc.txt'); // Sanity check file
            expect(result.stdoutLines).toContain('excluded.tmp'); // Should be found as no global exclude applied
            expect(result.stdoutLines).toContain('build'); // Directory should be found
            expect(result.stdoutLines).toContain('.config'); // Hidden dir should be found

            // Check that default excludes ARE still applied
            expect(result.stdoutLines).not.toContain('node_modules');
            expect(result.stdoutLines).not.toContain('.git');
        });
    });
});
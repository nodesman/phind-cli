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
        globalIgnoreFilePath = path.join(testDir, '.config', 'phind', 'ignore'); // For testing global ignores
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('Default Excludes', () => {
        it('should exclude node_modules by default', () => {
            const result = runCli([], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'node_modules'));
        });

        it('should exclude .git by default', () => {
            const result = runCli([], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, '.git'));
        });

        it('should include node_modules if explicitly included via --name and default exclude mechanism is overridden/bypassed', () => {
             const result = runCli(['--name', 'node_modules/**'], testDir);
             const expected = ['node_modules', 'node_modules/package', 'node_modules/package/index.js'].sort();
             expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
             expect(result.stdoutLines).toContain(path.join(testDir, 'node_modules/package/index.js'));
             expect(result.stdoutLines).toContain(path.join(testDir, 'node_modules'));
        });

        it('should include .git if explicitly included via --name and default exclude mechanism is overridden/bypassed', () => {
             const result = runCli(['--name', '.git/**'], testDir);
             const expected = ['.git', '.git/HEAD'].sort();
              expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
             expect(result.stdoutLines).toContain(path.join(testDir, '.git'));
             expect(result.stdoutLines).toContain(path.join(testDir, '.git/HEAD'));
        });
    });

    describe('Exclude Patterns (--exclude, -e)', () => {
        it('should exclude files matching a single --exclude pattern', () => {
            const result = runCli(['--exclude', '*.txt'], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'doc.txt'));
            expect(result.stdoutLines).toContain(path.join(testDir, 'script.js')); // Ensure other files present
        });

        it('should exclude files matching multiple --exclude patterns', () => {
            const result = runCli(['--exclude', '*.txt', '--exclude', '*.js'], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'doc.txt'));
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'script.js'));
            expect(result.stdoutLines).toContain(path.join(testDir, 'image.jpg')); // Ensure other files
        });

        it('should exclude files based on glob patterns (e.g., *.log)', () => {
            const result = runCli(['--exclude', 'build/*.log'], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'build', 'output.log'));
            expect(result.stdoutLines).toContain(path.join(testDir, 'build', 'app.exe')); // Ensure dir still there
            expect(result.stdoutLines).toContain(path.join(testDir, 'script.js'));
        });

        it('should exclude hidden files when pattern allows (e.g., .*)', () => {
             const result = runCli(['--exclude', '.*'], testDir);
             expect(result.stdoutLines).not.toContain(path.join(testDir, '.config')); // Directory is gone too
             expect(result.stdoutLines).not.toContain(path.join(testDir, '.config/app.conf'));
             expect(result.stdoutLines).toContain(path.join(testDir, 'doc.txt')); // Sanity
        });

        it('should exclude entire directories and their contents (pruning)', () => {
             const result = runCli(['--exclude', 'build'], testDir);
             expect(result.stdoutLines).not.toContain(path.join(testDir, 'build'));
             expect(result.stdoutLines).not.toContain(path.join(testDir, 'build', 'output.log'));
             expect(result.stdoutLines).not.toContain(path.join(testDir, 'build', 'app.exe'));
            expect(result.stdoutLines).toContain(path.join(testDir, 'script.js'));
        });

        it('should prioritize --exclude over --name if patterns overlap', () => {
            const result = runCli(['--name', '*.txt', '--exclude', 'doc.txt'], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'doc.txt'));
            expect(result.stderr).toBe('');
        });

        it('should handle --exclude patterns with case sensitivity by default', () => {
            const result = runCli(['--exclude', 'IMAGE.JPG'], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'IMAGE.JPG')); //Excluded, so not in list
             expect(result.stdoutLines).toContain(path.join(testDir, 'image.jpg')); // but other file is
        });
    });

    describe('Global Ignore File (--no-global-ignore)', () => {
        it('should load and apply excludes from the global ignore file by default', async () => {
            await fs.ensureDir(path.dirname(globalIgnoreFilePath));
            await fs.writeFile(globalIgnoreFilePath, '*.tmp\nbuild');
            const result = runCli([], testDir);
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'excluded.tmp'));
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'build')); // Pruned

            expect(result.stdoutLines).toContain(path.join(testDir, 'doc.txt')); // sanity
        });

        it('should NOT load global ignores when --no-global-ignore is specified', async () => {
            await fs.ensureDir(path.dirname(globalIgnoreFilePath));
            await fs.writeFile(globalIgnoreFilePath, '*.tmp\nbuild');
            const result = runCli(['--no-global-ignore'], testDir);
            expect(result.stdoutLines).toContain(path.join(testDir, 'excluded.tmp'));
             expect(result.stdoutLines).toContain(path.join(testDir, 'build'));

        });

        it('should combine global ignores with default and CLI excludes', async () => {
            await fs.ensureDir(path.dirname(globalIgnoreFilePath));
            await fs.writeFile(globalIgnoreFilePath, '*.log');
            const result = runCli(['--exclude', '*.tmp'], testDir);

            expect(result.stdoutLines).not.toContain(path.join(testDir, 'excluded.tmp'));
            expect(result.stdoutLines).not.toContain(path.join(testDir, 'build', 'output.log'));
            expect(result.stdoutLines).toContain(path.join(testDir, 'doc.txt'));
        });

        it('should handle non-existent global ignore file gracefully', () => {
            const result = runCli([], testDir);
            expect(result.status).toBe(0);
            expect(result.stderr).toBe(''); // No error message about missing file
            expect(result.stdoutLines).toContain(path.join(testDir, 'doc.txt')); // Sanity
            expect(result.stdoutLines).toContain(path.join(testDir, 'excluded.tmp'));
        });
    });
});
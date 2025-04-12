// test/e2e/cli.include.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure, normalizeAndSort } from './cli.helper'; // Import helpers

describe('CLI E2E - Include Patterns (--name, -n)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
        await createTestStructure(testDir, {
            'doc.txt': 'text',
            'image.jpg': 'jpeg',
            'image.JPG': 'jpeg upper',
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
            'empty': null,
            '.hiddenFile': 'hidden content',
            '.hiddenDir': { 'content': 'hidden dir content' }
        });
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    it('should include only files matching a single --name pattern', () => {
        const result = runCli(['--name', '*.txt'], testDir);
        expect(result.status).toBe(0);
        const expected = ['doc.txt'].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        expect(result.stdoutLines.length).toBe(expected.length);
    });

    it('should include only files matching multiple --name patterns', () => {
        const result = runCli(['--name', '*.txt', '--name', '*.js'], testDir);
        expect(result.status).toBe(0);
        const expected = ['doc.txt', 'script.js'].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        expect(result.stdoutLines.length).toBe(expected.length);
    });

    it('should include files based on glob patterns (e.g., *.txt)', () => {
        const result = runCli(['--name', '*.txt'], testDir);
        expect(result.status).toBe(0);
        const expected = ['doc.txt'].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        expect(result.stdoutLines.length).toBe(expected.length);
    });

    it('should include hidden files when pattern allows (e.g., .*)', () => {
        const result = runCli(['--name', '.*'], testDir);
        expect(result.status).toBe(0);
        const expected = ['.config', '.hiddenFile', '.hiddenDir'].sort();
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        expect(result.stdoutLines.length).toBe(expected.length);
    });

    it('should include files in subdirectories matching a pattern', () => {
         const result = runCli(['--name', 'src/*'], testDir);
         expect(result.status).toBe(0);
         const expected = ['src/main.ts', 'src/util.ts'].sort();
         expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
         expect(result.stdoutLines.length).toBe(expected.length);
    });

    it('should handle --name patterns with case sensitivity by default', () => {
        const result = runCli(['--name', 'image.JPG'], testDir);
        expect(result.status).toBe(0);
        const expected = ['image.JPG'];
        expect(normalizeAndSort(result.stdoutLines)).toEqual(expect.arrayContaining(expected));
        expect(result.stdoutLines.length).toBe(expected.length);
    });

    it('should default to including everything (*) if --name is not provided', () => {
        const result = runCli([], testDir);
        expect(result.status).toBe(0);
        const expected = [
            '.config',
            '.config/app.conf',
            'build',
            'build/app.exe',
            'build/output.log',
            'doc.txt',
            'empty',
            'image.JPG',
            'image.jpg',
            'script.js',
            'src',
            'src/main.ts',
            'src/util.ts',
            '.hiddenFile',
            '.hiddenDir',
        ].sort();
         const filtered = result.stdoutLines.filter(line => !line.includes('node_modules') && !line.includes('.git'));

        expect(normalizeAndSort(filtered)).toEqual(expect.arrayContaining(expected));
        expect(filtered.length).toBe(expected.length);
    });
});
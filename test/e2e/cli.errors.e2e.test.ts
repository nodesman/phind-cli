// test/e2e/cli.errors.e2e.test.ts
import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { runCli, createTestStructure } from './cli.helper';

describe('CLI E2E - Argument Validation and Error Handling', () => {
    let testDir: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phind-e2e-'));
        originalEnv = { ...process.env };
    });

    afterEach(async () => {
        await fs.remove(testDir);
        process.env = originalEnv; // Restore env
    });

    it('should exit with non-zero status and error message for invalid option values (e.g., --type x)', () => {
        const result = runCli(['--type', 'x'], testDir);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("Invalid values for argument type: Allowed values are f, d");
    });

    it('should exit with non-zero status and error message for unknown options (strict mode)', () => {
        const result = runCli(['--invalid-option'], testDir);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("Unknown argument: invalid-option");
    });

    it('should exit with non-zero status and error message if start path does not exist', () => {
        const nonExistentPath = path.join(testDir, 'non-existent-dir');
        const result = runCli([nonExistentPath], testDir);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`Start path "${nonExistentPath}" not found.`);
    });

    it('should exit with non-zero status and error message if start path is not a directory', async () => {
        const filePath = path.join(testDir, 'testfile.txt');
        await fs.writeFile(filePath, 'some content');
        const result = runCli([filePath], testDir);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`Start path "${filePath}" is not a directory.`);
    });

    it('should print permission errors to stderr but attempt to continue processing other directories', async () => {
        // Create a directory and make it unreadable
        const unreadableDir = path.join(testDir, 'unreadable');
        await fs.mkdir(unreadableDir);
        await fs.chmod(unreadableDir, 0o000);

        // Create another readable directory
        const readableDir = path.join(testDir, 'readable');
        await fs.mkdir(readableDir);
        const result = runCli([testDir], testDir);

        expect(result.stderr).toContain(`Permission error reading directory ${unreadableDir}`);
        expect(result.status).toBe(0); // Does not crash completely
        await fs.chmod(unreadableDir, 0o777); // Restore permissions
    });
});
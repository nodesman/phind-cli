import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

// Helper function to create a temporary test directory structure
export async function createTestStructure(baseDir: string, structure: any): Promise<void> {
    for (const name in structure) {
        const currentPath = path.join(baseDir, name);
        const value = structure[name];
        if (typeof value === 'string') {
            await fs.ensureDir(path.dirname(currentPath));
            await fs.writeFile(currentPath, value);
        } else if (typeof value === 'object' && value !== null) {
            await fs.ensureDir(currentPath);
            await createTestStructure(currentPath, value);
        } else {
            await fs.ensureDir(currentPath);
        }
    }
}

// Helper function to run the CLI
interface CliResult {
    stdout: string;
    stderr: string;
    stdoutLines: string[];
    stderrLines: string[];
    status: number | null;
    error?: Error;
}

export const runCli = (
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv,
    globalIgnorePath?: string | null // Add optional parameter
): CliResult => {
    const cliPath = path.resolve(__dirname, '../../bin/cli.js'); // Adjust path to compiled cli.js

    // Create a mutable copy of the environment to modify
    const processEnv = { ...process.env, ...env }; // Merge base env and specific test env

    // --- START MODIFICATION ---
    // Check if the --no-global-ignore flag is present in the arguments
    const noGlobalIgnoreFlag = args.includes('--no-global-ignore');

    if (noGlobalIgnoreFlag) {
        // If the flag is present, ensure the environment variable is *unset*
        // This overrides any path passed via the globalIgnorePath parameter for this specific test run.
        delete processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH;
    } else {
        // Otherwise (flag is NOT present), set/unset the env var based on the parameter as before
        if (globalIgnorePath === null) {
             // Explicitly unset if null is passed
             delete processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH;
        } else if (globalIgnorePath) {
             // Pass the absolute path to the test's global ignore file
             // Resolve it relative to the cwd (testDir) where the command is run
             processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH = path.resolve(cwd, globalIgnorePath);
        } else {
            // If globalIgnorePath is undefined (not passed), clear any potential leftover
             delete processEnv.PHIND_TEST_GLOBAL_IGNORE_PATH;
        }
    }
    // --- END MODIFICATION ---

    const result = spawn.sync(process.execPath, [cliPath, ...args], {
        cwd,
        encoding: 'utf-8',
        env: processEnv, // Use the modified environment
    });

    const normalizeOutput = (output: string | null): string => (output || '').replace(/\r\n/g, '\n');
    const splitLines = (output: string): string[] => output.split('\n').filter(line => line.trim() !== '');

    const stdoutNormalized = normalizeOutput(result.stdout);
    const stderrNormalized = normalizeOutput(result.stderr);

    return {
        stdout: stdoutNormalized,
        stderr: stderrNormalized,
        stdoutLines: splitLines(stdoutNormalized),
        stderrLines: splitLines(stderrNormalized),
        status: result.status,
        error: result.error,
    };
};

// Helper to normalize and sort output lines for comparison
export const normalizeAndSort = (lines: string[]) => {
    return lines
        .map(line => path.normalize(line).replace(/\\/g, '/')) // Normalize separators
        .sort();
}
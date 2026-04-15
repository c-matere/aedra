import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

const execPromise = promisify(exec);

@Injectable()
export class AiPythonExecutorService {
  private readonly logger = new Logger(AiPythonExecutorService.name);
  private readonly tempDir = join(process.cwd(), 'tmp/python');

  constructor() {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async runScript(script: string): Promise<{
    stdout: string;
    stderr: string;
    success: boolean;
    generatedFile?: { path: string; name: string };
  }> {
    const id = randomUUID();
    const sessionDir = join(this.tempDir, id);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const scriptPath = join(sessionDir, `script.py`);

    try {
      await writeFile(scriptPath, script);

      this.logger.log(`Executing Python script: ${scriptPath}`);
      const { stdout, stderr } = await execPromise(`python3 script.py`, {
        timeout: 30000,
        env: { ...process.env, PYTHONPATH: process.cwd() },
        cwd: sessionDir,
      });

      // Scan for any new files in the session directory (excluding the script)
      const files = await fs.promises.readdir(sessionDir);
      const outputFiles = files.filter((f) => f !== 'script.py');
      let generatedFile = undefined;

      if (outputFiles.length > 0) {
        // Pick the first one (usually there's only one relevant output)
        const fileName = outputFiles[0];
        generatedFile = {
          path: join(sessionDir, fileName),
          name: fileName,
        };
      }

      return { stdout, stderr, success: true, generatedFile };
    } catch (error: any) {
      this.logger.error(`Python execution failed: ${error.message}`);
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false,
      };
    } finally {
      try {
        // We leave the session directory for the caller to process/upload files if needed
        // but we delete the script itself
        if (fs.existsSync(scriptPath)) {
          await unlink(scriptPath);
        }
      } catch (e) {
        this.logger.warn(`Failed to cleanup temp script: ${scriptPath}`);
      }
    }
  }
}

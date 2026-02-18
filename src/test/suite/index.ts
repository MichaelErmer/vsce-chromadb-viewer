import * as path from 'path';
import Mocha from 'mocha';
import glob from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 60000 });
  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    glob('**/*.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
      if (err) { return reject(err); }
      files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));
      try {
        mocha.run((failures: number) => (failures ? reject(new Error(`${failures} tests failed`)) : resolve()));
      } catch (err) {
        reject(err);
      }
    });
  });
}

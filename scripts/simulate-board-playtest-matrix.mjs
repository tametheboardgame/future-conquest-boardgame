import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';

const argumentValue = name => {
  const prefix = `--${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
};

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const nonNegativeInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const runs = positiveInteger(argumentValue('runs') ?? process.env.FC_BOARD_PLAYTEST_RUNS, 24);
const maxSteps = positiveInteger(argumentValue('max-steps') ?? process.env.FC_BOARD_PLAYTEST_MAX_STEPS, 1000);
const seedOffset = nonNegativeInteger(argumentValue('seed-offset') ?? process.env.FC_BOARD_PLAYTEST_SEED_OFFSET, 1);
const outputDir = resolve(
  process.cwd(),
  argumentValue('output-dir') ?? process.env.FC_BOARD_PLAYTEST_OUTPUT_DIR ?? 'board-playtest-output'
);

rmSync('.board-playtest-dist', { recursive: true, force: true });
execFileSync(tsc, ['-p', 'tsconfig.test.json', '--outDir', '.board-playtest-dist'], { stdio: 'inherit' });
writeFileSync('.board-playtest-dist/package.json', '{"type":"commonjs"}\n');

const {
  runBoardPlaytestMatrix,
  renderBoardPlaytestMatrixMarkdown
} = require(resolve(process.cwd(), '.board-playtest-dist/board-playtest-simulation.js'));

const report = runBoardPlaytestMatrix({ runs, maxSteps, seedOffset });
const markdown = renderBoardPlaytestMatrixMarkdown(report);

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'board-playtest-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'board-playtest-matrix.md'), markdown);
process.stdout.write(markdown);
console.log(`\nWrote board playtest outputs to ${outputDir}`);

if (report.integrityGate !== 'pass') process.exitCode = 1;

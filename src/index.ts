/**
 * Misskey Core Entory Point!
 */

Error.stackTraceLimit = Infinity;

/**
 * Module dependencies
 */
import * as fs from 'fs';
import * as os from 'os';
import * as cluster from 'cluster';
const prominence = require('prominence');
import { logInfo, logDone, logWarn, logFailed } from 'log-cool';
import * as chalk from 'chalk';
const git = require('git-last-commit');
const portUsed = require('tcp-port-used');
import ProgressBar from './utils/cli/progressbar';
import initdb from './db/mongodb';
import checkDependencies from './utils/check-dependencies';

// Init babel
require('babel-core/register');
require('babel-polyfill');

const env = process.env.NODE_ENV;
const IS_PRODUCTION = env === 'production';
const IS_DEBUG = !IS_PRODUCTION;

global.config = require('./config').default(`${__dirname}/../.config/config.yml`);

/**
 * Initialize state
 */
enum State {
	success,
	warn,
	failed
}

// Set process title
process.title = 'Misskey';

// Start app
main();

/**
 * Init proccess
 */
function main(): void {
	// Master
	if (cluster.isMaster) {
		master();
	} else { // Workers
		worker();
	}
}

/**
 * Init master proccess
 */
async function master(): Promise<void> {
	let state: State;

	try {
		// initialize app
		state = await init();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}

	const res = (t: string, c: string) =>
		console.log(chalk.bold(`--> ${(chalk as any)[c](t)}\n`));

	switch (state) {
		case State.failed:
			res('Fatal error occurred :(', 'red');
			process.exit();
			return;
		case State.warn:
			res('Some problem(s) :|', 'yellow');
			break;
		case State.success:
			res('OK :)', 'green');
			break;
	}

	// Spawn workers
	spawn(() => {
		console.log(chalk.bold.green(`\nMisskey Core is now running. [port:${config.port}]`));

		// Listen new workers
		cluster.on('fork', worker => {
			console.log(`Process forked: [${worker.id}]`);
		});

		// Listen online workers
		cluster.on('online', worker => {
			console.log(`Process is now online: [${worker.id}]`);
		});

		// Listen for dying workers
		cluster.on('exit', worker => {
			// Replace the dead worker,
			// we're not sentimental
			console.log(chalk.red(`[${worker.id}] died :(`));
			cluster.fork();
		});
	});
}

/**
 * Init worker proccess
 */
function worker(): void {
	// Register config
	global.config = config;

	// Init mongo
	initdb().then(db => {
		global.db = db;

		// start server
		require('./server');
	}, err => {
		console.error(err);
		process.exit(0);
	});
}

/**
 * Init app
 */
async function init(): Promise<State> {
	console.log('Welcome to Misskey!\n');

	console.log(chalk.bold('Misskey Core <aoi>'));

	let warn = false;

	// Get commit info
	try {
		const commit = await prominence(git).getLastCommit();
		console.log(`commit: ${commit.shortHash} ${commit.author.name} <${commit.author.email}>`);
		console.log(`        ${new Date(parseInt(commit.committedOn, 10) * 1000)}`);
	} catch (e) {
		// noop
	}

	console.log('\nInitializing...\n');

	if (IS_DEBUG) {
		logWarn('It is not in the Production mode. Do not use in the Production environment.');
	}

	logInfo(`environment: ${env}`);

	// Get machine info
	const totalmem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
	const freemem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
	logInfo(`MACHINE: ${os.hostname()}`);
	logInfo(`MACHINE: CPU: ${os.cpus().length}core`);
	logInfo(`MACHINE: MEM: ${totalmem}GB (available: ${freemem}GB)`);

	if (!fs.existsSync(`${__dirname}/../.config/config.yml`)) {
		logFailed('Configuration not found');
		return State.failed;
	}

	logDone('Success to load configuration');
	logInfo(`maintainer: ${config.maintainer}`);

	checkDependencies();

	// Check if a port is being used
	if (await portUsed.check(config.port)) {
		logFailed(`Port: ${config.port} is already used!`);
		return State.failed;
	}

	// Try to connect to MongoDB
	try {
		const db = await initdb(config);
		logDone('Success to connect to MongoDB');
		db.close();
	} catch (e) {
		logFailed(`MongoDB: ${e}`);
		return State.failed;
	}

	return warn ? State.warn : State.success;
}

/**
 * Spawn workers
 */
function spawn(callback: any): void {
	// Count the machine's CPUs
	const cpuCount = os.cpus().length;

	const progress = new ProgressBar(cpuCount, 'Starting workers');

	// Create a worker for each CPU
	for (let i = 0; i < cpuCount; i++) {
		const worker = cluster.fork();
		worker.on('message', message => {
			if (message === 'ready') {
				progress.increment();
			}
		});
	}

	// On all workers started
	progress.on('complete', () => {
		callback();
	});
}

// Dying away...
process.on('exit', () => {
	console.log('Bye.');
});
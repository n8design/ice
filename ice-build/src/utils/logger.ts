import chalk from 'chalk';

export class Logger {
  private scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  info(message: string): void {
    console.log(`🧊 ${chalk.cyan(`[${this.scope}]`)} ${message}`);
  }

  warn(message: string): void {
    console.log(`${chalk.yellow('⚠️')} ${chalk.cyan(`[${this.scope}]`)} ${message}`);
  }

  error(message: string): void {
    console.error(`${chalk.red('❌')} ${chalk.cyan(`[${this.scope}]`)} ${message}`);
  }

  success(message: string): void {
    console.log(`${chalk.green('✅')} ${chalk.cyan(`[${this.scope}]`)} ${message}`);
  }

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(`${chalk.magenta('🔍')} ${chalk.cyan(`[${this.scope}]`)} ${message}`);
    }
  }
}

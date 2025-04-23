export function reportError(
  context: string, 
  error: Error | string, 
  verbose: boolean = false
): void {
  const message = typeof error === 'string' ? error : error.message;
  const errorDetails = typeof error !== 'string' && verbose && error.stack 
    ? `\n${error.stack}` 
    : '';
  
  console.error(`❌ Error in ${context}: ${message}${errorDetails}`);
}
// filepath: test-ice-build/source/index.ts
// Import the CSS (esbuild can handle this with the sass plugin)
import './styles.scss';

function greet(name: string): string {
  return `Hello, ${name}! Build time: ${new Date().toLocaleTimeString()}`;
}

const message = greet('Ice Build User');
console.log(message);

console.debug('Debugging information:');

// Add content to the page
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.textContent = message;
  }
});
console.log('DOM fully loaded and parsed');
// let testVar: number = "this is definitely not a number";

// consoel.debug('Debugging information:');

// ... existing code ...

// Add an invalid JavaScript syntax error
// function invalidSyntax( { // Missing closing brace

//   console.log("This line won't be reached if parsing fails");
/**
 * CSS Property Validation Note:
 * 
 * The Sass/SCSS compiler only validates syntax (brackets, semicolons, etc.), 
 * but not CSS property names. It will compile files with invalid properties
 * and pass them through to the final CSS output.
 * 
 * This happens because:
 * 1. CSS specs continuously evolve with new properties
 * 2. Vendor prefixes (-webkit-, -moz-, etc.) are common
 * 3. Custom properties (--my-property) are valid
 * 4. Sass is designed to be a preprocessor, not a validator
 * 
 * For proper CSS validation, a dedicated tool like stylelint or 
 * PostCSS plugins should be used in the build pipeline.
 */

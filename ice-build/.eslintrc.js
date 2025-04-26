module.exports = {
  // Existing configuration...
  rules: {
    // Existing rules...
    '@typescript-eslint/no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      // Add this to be more permissive during development:
      'ignoreRestSiblings': true
    }]
  }
};
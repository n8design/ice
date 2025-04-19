module.exports = {
  name: 'ice-build',
  tagFormat: 'ice-build@${version}',
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', {
      // Only consider commits that affect this project's files
      releaseRules: [
        {breaking: true, release: 'major'},
        {type: 'feat', release: 'minor'},
        {type: 'fix', release: 'patch'}
      ]
    }],
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', {
      'changelogFile': 'CHANGELOG.md'
    }],
    '@semantic-release/npm',
    ['@semantic-release/git', {
      'assets': ['package.json', 'CHANGELOG.md'],
      'message': 'chore(release): ice-build@${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }],
    ['@semantic-release/github', {
      'releasedLabels': ['ice-build:released', 'released'],
      'successComment': false, // Disable commenting on PRs/Issues
      'assets': [
        {'path': 'dist/*.min.js', 'label': 'Minified JavaScript bundle'}
      ]
    }]
  ],
  // Add this to scope commits to the project directory
  pkgRoot: "ice-build",
  // Only include commits that modified files in this path
  extends: "semantic-release-monorepo"
};
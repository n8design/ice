module.exports = {
  name: 'ice-hotreloader',
  tagFormat: 'ice-hotreloader@${version}',
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
      'message': 'chore(release): ice-hotreloader@${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }],
    ['@semantic-release/github', {
      'releasedLabels': ['ice-hotreloader:released', 'released'],
      'successComment': false,
      'assets': [
        {'path': 'dist/*.min.js', 'label': 'Minified JavaScript bundle'}
      ]
    }]
  ],
  pkgRoot: "ice-hotreloader",
  extends: "semantic-release-monorepo"
};
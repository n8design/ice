export default {
  input: {
    scss: ['source/scss/**/*.scss'],
    ts: [],
    html: ['source/*.html']
  },
  output: {
    path: 'public'
  },
  sass: {
    sourceMap: true
  },
  hotreload: {
    enabled: true,
    port: 3005,  // Changed from 3001 to 3005 to avoid conflict
    host: 'localhost'
  }
};

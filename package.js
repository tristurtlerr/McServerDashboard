const packager = require('electron-packager');

// Root items to ignore during packaging (must match relative path starting with '/')
const ignoredRootItems = [
  '/src',
  '/tsconfig.json',
  '/tsconfig.node.json',
  '/tsconfig.app.json',
  '/vite.config.ts',
  '/vite.config.mts',
  '/.git',
  '/.gitignore',
  '/.gitattributes',
  '/.oxlintrc',
  '/.oxlintrc.json',
  '/package-lock.json',
  '/README.md',
  '/package.js',
  '/release',
  '/index.html'
];

function ignoreFunction(filePath) {
  // filePath is already relative to project root and starts with '/', e.g. '/src/index.tsx'
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check if it matches any ignored root item or is inside one
  const shouldIgnore = ignoredRootItems.some((item) => {
    return normalizedPath === item || normalizedPath.startsWith(item + '/');
  });

  if (shouldIgnore) {
    console.log(`Ignoring: ${normalizedPath}`);
  }

  return shouldIgnore;
}

console.log('Packaging app for platform win32 x64 using electron v42.5.0...');

packager({
  dir: __dirname,
  name: 'MC Server Manager',
  platform: 'win32',
  arch: 'x64',
  out: 'release',
  overwrite: true,
  prune: true,
  ignore: ignoreFunction
})
  .then((paths) => {
    console.log('Packaging complete! Output written to:', paths);
  })
  .catch((err) => {
    console.error('Packaging error:', err);
    process.exit(1);
  });

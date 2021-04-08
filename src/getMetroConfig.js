// Check for symlinks in node_modules
// If found generate and use metro config.
//
// Sources:
//     - https://github.com/facebook/metro/issues/1#issuecomment-346502388
//     - https://github.com/facebook/metro/issues/1#issuecomment-334546083

const dedent = require('dedent-js')
const getDependencyPath = require('./getDependencyPath')

const mapModule = name =>
    `'${name}': path.resolve(__dirname, 'node_modules/${name}')`

const mapPath = (path, dependency) =>
    '/' + `${path}/node_modules/${dependency}/`.replace(/[\\\/]/g, '[\\/\\\\]') + '.*/'

module.exports = symlinkedDependencies => {
    const symlinkedDependenciesPaths = symlinkedDependencies.map(
        getDependencyPath,
    )

    let blacklist = [];
    let allPeerDependencies = new Set();
    symlinkedDependenciesPaths.forEach((symlinkedDependencyPath) => {
        let peerDependenciesOfSymlinkedDependency = Object.keys(
            require(`${symlinkedDependencyPath}/package.json`).peerDependencies || []
        );

        peerDependenciesOfSymlinkedDependency.forEach((dependency) => {
            allPeerDependencies.add(dependency);
            blacklist.push(mapPath(symlinkedDependencyPath, dependency))
        });
    });

    const extraNodeModules = Array.from(allPeerDependencies)
        .map(mapModule)
        .join(',\n  ')

    const getBlacklistRE = blacklist
        .join(',\n  ')

    const getProjectRoots = symlinkedDependenciesPaths
        .map(path => `path.resolve('${path.replace(/\\/g, '\\\\')}')`)
        .join(',\n  ')

    return dedent`
      const path = require('path');

      const extraNodeModules = {
        ${extraNodeModules}
      };
      const blacklistRegexes = [
        ${getBlacklistRE}
      ];
      const watchFolders = [
        ${getProjectRoots}
      ];

      module.exports = {
        resolver: {
          extraNodeModules,
          blacklistRE: require('metro-config/src/defaults/exclusionList')(blacklistRegexes)
        },
        watchFolders,
        transformer: {
          getTransformOptions: async () => ({
            transform: {
              experimentalImportSupport: false,
              inlineRequires: true,
            },
          }),
        }
      };

   `
}

import loaderUtils from 'loader-utils';
import OriginalSource from 'webpack/lib/OriginalSource';

let cache = {};

function filterPaths(paths, resolveFunc) {
    let out = [];

    const promise = paths.reduce((sequence, p) => {
        return sequence.then(() => {
            return new Promise(resolve => {
                resolveFunc(p.context, p.file, (err, result) => {
                    if (err) {
                        return resolve();
                    }

                    resolve(result);
                });
            });
        }).then(result => {
            if (result) {
                out.push(result);
            }
        });
    }, Promise.resolve());

    return promise.then(() => out);
}

function makeImportsString(files) {
    if (!files.length) {
        return '';
    }

    return files.map(file => '@import "~' + file + '";\n').join('');
}

function process(pathsToCheck, resolveFunc) {
    return filterPaths(pathsToCheck, resolveFunc).then(files => {
        return makeImportsString(files);
    });
}

function inject(src, importsToInject, srcMap, callback) {
    if (srcMap) {
        srcMap = new OriginalSource(src, this._module.identifier(), srcMap);

        srcMap.node().prepend(importsToInject);
        srcMap = srcMap.map();
    }

    callback(null, importsToInject + src, srcMap);
}

export default function(src, srcMap) {
    const callback = this.async();
    const opts = loaderUtils.parseQuery(this.query);

    if (this.cacheable) {
        this.cacheable();
    }

    if (!cache.pathsToCheck) {
        cache.pathsToCheck = opts.levels.map(level => {
            return {
                context: level,
                file: './' + opts.styles
            };
        });
    }

    if (cache.importsToInject) {
        inject(src, cache.importsToInject, srcMap, callback);
    } else {
        process(cache.pathsToCheck, this.resolve).then(result => {
            cache.importsToInject = result;

            inject(src, cache.importsToInject, srcMap, callback);
        });
    }
}

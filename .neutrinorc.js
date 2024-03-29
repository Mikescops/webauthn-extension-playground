const react = require('@neutrinojs/react');
const copy = require('@neutrinojs/copy');
const webext = require('neutrino-webextension');
const typescript = require('neutrinojs-typescript');

module.exports = {
    options: {
        output: 'build/v3',
        mains: {
            popup: {
                entry: 'popup',
                webext: {
                    type: 'action'
                }
            }
        }
    },
    use: [
        typescript(),
        react({
            html: {
                title: 'WebAuthn in Extension v3 - Playground'
            }
        }),
        copy({
            patterns: [{ context: 'assets', from: '**/*', to: 'assets', toType: 'dir' }]
        }),
        webext({
            manifest: 'src/manifest',
            minify: {
                // Javascript minification occurs only in production by default.
                // To change uglify-es options or switch to another minifier, see below.
                source: process.env.NODE_ENV === 'production'
            }
        })
    ]
};

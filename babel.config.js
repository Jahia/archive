module.exports = {
    sourceMaps: 'inline',
    presets: [
        ['@babel/preset-env', {targets: {node: 'current'}}],
        '@babel/preset-react',
        '@babel/preset-typescript'
    ],
    plugins: [
        // No '@babel/plugin-transform-classes': preset-env already lowers classes, and
        // listing it explicitly makes it run before class fields are transformed, which
        // fails on a class field declaration.
        '@babel/plugin-proposal-class-properties',
        ['@babel/plugin-transform-runtime', {regenerator: true}]
    ]
};

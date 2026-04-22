const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/graphql',
        createProxyMiddleware({
            target: 'http://localhost:5000',
            changeOrigin: true,
        }),
    );

    app.use(
        '/graphqlws',
        createProxyMiddleware({
            target: 'ws://localhost:5000',
            pathRewrite: { '^/graphqlws': '/' },
            changeOrigin: true,
            ws: true,
        }),
    );
};
module.exports = {
    apps: [{
        name: 'golem',
        script: 'apps/runtime/index.js',
        args: 'dashboard',
        cwd: '/home/ubuntu/project-golem',
        node_args: '--expose-gc --max-old-space-size=256',
        env: {
            NODE_OPTIONS: '--expose-gc --max-old-space-size=256',
        },
        watch: false,
        autorestart: true,
        max_restarts: 10,
        restart_delay: 5000,
    }]
};

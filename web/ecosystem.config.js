module.exports = {
  apps: [
    {
      name: "command-central",
      script: ".next/standalone/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOSTNAME: "0.0.0.0",
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};

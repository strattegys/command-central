module.exports = {
  apps: [
    {
      name: "command-central",
      script: "./start.sh",
      interpreter: "/bin/bash",
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

"use strict";

module.exports = {
  apps: [
    {
      name: "citadel-notify",
      script: "notify.js",
      cwd: __dirname,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "citadel-standup",
      script: "standup.js",
      cwd: __dirname,
      autorestart: true,
      watch: false,
      cron_restart: "0 18 * * *",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

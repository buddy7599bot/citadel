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
  ],
};

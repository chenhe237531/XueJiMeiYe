// pm2 进程配置：单进程同时提供 API、管理端、医院端、移动工作台和小程序 H5 版
module.exports = {
  apps: [
    {
      name: "xueji",
      cwd: __dirname + "/server",
      script: "dist/main.js",
      env: { NODE_ENV: "production", WEB_ROOT: __dirname },
      max_memory_restart: "600M"
    }
  ]
};

"use strict";

const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const baseConfig = require("./webpack.config");

const root = __dirname;
const temporaryRoot = fs.mkdtempSync(path.join(root, ".browser-build-"));
const source = path.join(temporaryRoot, "source");
const tsconfig = path.join(temporaryRoot, "tsconfig.json");

function applyBrowserVariants(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      applyBrowserVariants(absolute);
    } else if (entry.name.includes("-BROWSER")) {
      const destination = absolute.replace("-BROWSER", "");
      fs.rmSync(destination, { force: true });
      fs.renameSync(absolute, destination);
    }
  }
}

async function main() {
  fs.cpSync(path.join(root, "gramjs"), source, { recursive: true });
  applyBrowserVariants(source);
  fs.writeFileSync(
    tsconfig,
    `${JSON.stringify(
      {
        extends: path.join(root, "tsconfig.json"),
        compilerOptions: {
          outDir: path.join(temporaryRoot, "compiled"),
          rootDir: source,
          declaration: false,
        },
        include: [path.join(source, "**/*")],
        exclude: [path.join(root, "node_modules")],
      },
      null,
      2
    )}\n`
  );

  const config = {
    ...baseConfig,
    entry: path.join(source, "index.ts"),
    module: {
      ...baseConfig.module,
      rules: baseConfig.module.rules.map((rule) =>
        String(rule.test) === String(/\.ts$/)
          ? {
              ...rule,
              use: {
                loader: "ts-loader",
                options: { configFile: tsconfig },
              },
            }
          : rule
      ),
    },
    resolve: {
      ...baseConfig.resolve,
      modules: [path.join(root, "node_modules"), "node_modules"],
    },
    resolveLoader: {
      modules: [path.join(root, "node_modules"), "node_modules"],
    },
    output: {
      ...baseConfig.output,
      path: path.join(root, "browser"),
    },
  };

  await new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }
      if (stats.hasErrors()) {
        reject(
          new Error(
            stats.toString({
              all: false,
              errors: true,
              warnings: true,
            })
          )
        );
        return;
      }
      console.log(
        stats.toString({
          all: false,
          assets: true,
          timings: true,
          warnings: true,
        })
      );
      resolve();
    });
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

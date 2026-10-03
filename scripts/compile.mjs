import fs from "node:fs";
import path from "node:path";
import solc from "solc";
const sources = {};
for (const file of fs.readdirSync("contracts"))
  if (file.endsWith(".sol"))
    sources["contracts/" + file] = {
      content: fs.readFileSync("contracts/" + file, "utf8"),
    };
for (const file of fs.readdirSync("test/contracts"))
  if (file.endsWith(".sol"))
    sources["test/contracts/" + file] = {
      content: fs.readFileSync("test/contracts/" + file, "utf8"),
    };
const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "shanghai",
    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
          "storageLayout",
        ],
      },
    },
  },
};
const output = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import: (name) => {
      try {
        return {
          contents: fs.readFileSync(path.join("node_modules", name), "utf8"),
        };
      } catch {
        return { error: "Import not found: " + name };
      }
    },
  }),
);
for (const issue of output.errors || []) console.error(issue.formattedMessage);
if ((output.errors || []).some((e) => e.severity === "error")) process.exit(1);
fs.mkdirSync("artifacts", { recursive: true });
const manifest = [];
for (const [file, contracts] of Object.entries(output.contracts)) {
  if (!file.startsWith("contracts/") && !file.startsWith("test/contracts/"))
    continue;
  for (const [name, artifact] of Object.entries(contracts)) {
    fs.writeFileSync(
      "artifacts/" + name + ".json",
      JSON.stringify(
        {
          contractName: name,
          source: file,
          compiler: solc.version(),
          ...artifact,
        },
        null,
        2,
      ) + "\n",
    );
    manifest.push({
      name,
      source: file,
      creationBytes: artifact.evm.bytecode.object.length / 2,
      runtimeBytes: artifact.evm.deployedBytecode.object.length / 2,
    });
    if (artifact.evm.deployedBytecode.object.length / 2 > 24576)
      throw new Error(name + " exceeds deployed size limit");
  }
}
fs.writeFileSync(
  "artifacts/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Compiled " + manifest.length + " local contracts with " + solc.version(),
);

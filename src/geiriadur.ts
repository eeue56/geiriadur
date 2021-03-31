#!/usr/bin/env ts-node
import * as path from "path";

import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as ts from "typescript";

import glob from "fast-glob";
import JSON5 from "json5";

async function getFiles(dir: string): Promise<string[]> {
    const dirents: fs.Dirent[] = await fsPromises.readdir(dir, {
        withFileTypes: true,
    });
    const files = await Promise.all(
        dirents.map(async (dirent: fs.Dirent) => {
            const res: string = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                return await getFiles(res);
            } else {
                return res;
            }
        })
    );
    return Array.prototype.concat(...files);
}

type ExportedType = {
    kind: "type";
    type: string[];
    jsDoc: string[];
    pos: {
        start: number;
        end: number;
    };
};

type ExportedFunction = {
    kind: "function";
    type: string[];
    jsDoc: string[];
    pos: {
        start: number;
        end: number;
    };
};

type Export = ExportedType | ExportedFunction;

function exportTitle(exported: Export): string {
    const firstLine = exported.type[0] || "";

    switch (exported.kind) {
        case "type": {
            const matches = firstLine.match(/export type (.+)/);
            if (matches) {
                return "type " + matches[1].split("=")[0];
            }

            return "";
        }
        case "function": {
            const matches = firstLine.match(/export function (.+)/);
            if (matches) {
                if (matches[1].indexOf("<") > -1) {
                    return matches[1].split("<")[0];
                }

                return matches[1].split("(")[0];
            }

            return "";
        }
    }
}

function exportToEnglish(
    repo: string,
    filePath: string,
    exported: Export
): string {
    const headline = "## " + exportTitle(exported);
    const typeBody = "```javascript\n" + exported.type.join("\n") + "\n```";
    const comments = exported.jsDoc.join("\n");

    const linkToSource = `[View source](${repo}/blob/main/${filePath}#L${exported.pos.start}-L${exported.pos.end})`;

    return [ headline, typeBody, comments, linkToSource ].join("\n");
}

function getExports(fileContents: string): Export[] {
    let isInJSDoc = false;
    let currentJSDoc: string[] = [ ];

    let isInType = false;
    let currentType: string[] = [ ];

    let isInFunction = false;
    let currentFunction: string[] = [ ];

    let startLineNumber = 0;

    let types: Export[] = [ ];

    const lines = fileContents.split("\n");

    lines.forEach((line, lineNumber) => {
        if (isInJSDoc) {
            currentJSDoc.push(line);
            if (line.endsWith("*/")) {
                isInJSDoc = false;
            }
        } else if (isInType) {
            currentType.push(line);

            if (line.length === 0) {
                isInType = false;
                types.push({
                    kind: "type",
                    jsDoc: currentJSDoc,
                    type: currentType,
                    pos: {
                        start: startLineNumber,
                        end: lineNumber,
                    },
                });

                currentJSDoc = [ ];
                currentType = [ ];
            }
        } else if (isInFunction) {
            currentFunction.push(line);
        } else {
            if (line.startsWith("/**")) {
                isInJSDoc = true;
                currentJSDoc.push(line);
            } else if (line.startsWith("export type")) {
                isInType = true;
                startLineNumber = lineNumber;
                currentType.push(line);
            } else if (line.startsWith("export function")) {
                isInFunction = true;
                startLineNumber = lineNumber;
                currentFunction.push(line);
            }
        }

        if (isInFunction) {
            if (line.endsWith("{")) {
                isInFunction = false;
                types.push({
                    kind: "function",
                    jsDoc: currentJSDoc,
                    type: currentFunction,
                    pos: {
                        start: startLineNumber,
                        end: lineNumber,
                    },
                });

                currentJSDoc = [ ];
                currentFunction = [ ];
            }
        }
    });

    return types;
}

export async function runner(): Promise<any> {
    console.log("Looking for tsconfig...");
    const strConfig = (await fsPromises.readFile("./tsconfig.json")).toString();
    const config = JSON5.parse(strConfig);

    const strPackage = (await fsPromises.readFile("./package.json")).toString();
    const packageJson = JSON5.parse(strPackage);
    const repo = packageJson.homepage.split("#")[0];

    console.log(`Generating docs for ${packageJson.name} hosted at ${repo}`);
    console.log(`Looking for docs in ${config.include}...`);

    const files = await glob(config.include);

    const root = process.cwd();

    await Promise.all(
        files.map(async (fileName) => {
            return new Promise(async (resolve, reject) => {
                console.log(`Found ${fileName}`);

                const fileContents = (
                    await fsPromises.readFile(fileName)
                ).toString();
                const exportedItems = getExports(fileContents);

                const docs = exportedItems
                    .map((exported) => {
                        return exportToEnglish(repo, fileName, exported);
                    })
                    .join("\n");

                const fileNameWithoutPath = fileName.split(".")[0] + ".md";

                let additionalPath = "";

                if (fileName.indexOf("/") > -1) {
                    const split = fileName.split("/");
                    additionalPath = split.slice(0, split.length - 1).join("/");
                }

                try {
                    await fsPromises.mkdir("docs/" + additionalPath, {
                        recursive: true,
                    });
                } catch (e) {}
                await fsPromises.writeFile(`docs/${fileNameWithoutPath}`, docs);

                resolve(null);
            });
        })
    );
}

if (require.main === module) {
    runner();
}

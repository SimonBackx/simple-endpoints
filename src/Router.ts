import { promises as fs } from "fs";
import http from "http";

import { EncodedResponse } from "./EncodedResponse";
import { Endpoint } from "./Endpoint";
import { Request } from "./Request";

async function directoryExists(filePath): Promise<boolean> {
    try {
        return (await fs.stat(filePath)).isDirectory();
    } catch (err) {
        return false;
    }
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}
type GenericEndpoint = Endpoint<any, any, any, any>;
type EndpointConstructor = { new (): GenericEndpoint };

function isEndpointType(endpoint: any): endpoint is EndpointConstructor {
    return endpoint.prototype instanceof Endpoint;
}

export class Router {
    endpoints: GenericEndpoint[] = [];
    verbose = false

    async loadAllEndpoints(folder: string) {
        const parts = folder.split("/");
        const firstPart = parts.shift();
        if (firstPart === undefined) {
            throw new Error("Invalid folder path");
        }
        let folderQueue: string[] = [firstPart];

        for (const part of parts) {
            if (part == "*") {
                const newQueue: string[] = [];
                for (folder of folderQueue) {
                    // Read all directories
                    const recursiveFolders = (await fs.readdir(folder, { withFileTypes: true }))
                        .filter((dirent) => dirent.isDirectory())
                        .map((dirent) => folder + "/" + dirent.name);
                    newQueue.push(...recursiveFolders);
                }
                folderQueue = newQueue;
            } else {
                folderQueue = folderQueue.map((folder) => folder + "/" + part);
            }
        }

        for (const f of folderQueue) {
            if (await directoryExists(f)) {
                if (this.verbose) {
                    console.log("Endpoints from " + f);
                }
                await this.loadEndpoints(f);
            }
        }
    }

    /// Run migrations in the given folder
    async loadEndpoints(folder: string) {
        /// Query all migrations
        const files = await fs.readdir(folder);

        for (const file of files) {
            const p = folder + "/" + file;
            if (file.includes(".test.")) {
                continue;
            }
            if (file.endsWith(".d.ts")) {
                continue;
            }
            if (!file.endsWith(".ts") && !file.endsWith(".js")) {
                continue;
            }
            const imported = await import(p);
            for (const key in imported) {
                const element = imported[key];
                if (isEndpointType(element)) {
                    if (this.verbose) {
                        console.log("Loaded " + key);
                    }
                    this.endpoints.push(new element());
                }
            }
        }
    }

    async run(request: Request, response?: http.ServerResponse): Promise<EncodedResponse | null> {
        for (const endpoint of this.endpoints) {
            const r = await endpoint.run(request, response);
            if (r !== null) {
                return r;
            }
        }

        return null;
    }
}

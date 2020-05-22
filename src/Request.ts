import http from "http";
import urlParser from "url";
import { EndpointError } from "./EndpointError";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS";
export class Request {
    method: HttpMethod;
    url: string;
    host: string;
    request?: http.IncomingMessage;
    bodyPromise?: Promise<string>;

    version?: number;

    /// Use this e.g. to make test code shorter, but avoid using this in real code
    static defaultVersion?: number;

    get body(): Promise<string> {
        if (!this.bodyPromise) {
            if (!this.request) {
                throw new Error("Expected a body promise or a request");
            }
            const req = this.request;
            this.bodyPromise = new Promise<string>((resolve, reject) => {
                const chunks: any[] = [];
                let gotError = false;

                // we can access HTTP headers
                req.on("data", (chunk) => {
                    chunks.push(chunk);
                });
                req.on("error", (err) => {
                    gotError = true;
                    reject(err);
                });

                req.on("end", () => {
                    if (gotError) {
                        return;
                    }
                    const body = Buffer.concat(chunks).toString();
                    resolve(body);
                });
            });
        }
        return this.bodyPromise;
    }

    headers: http.IncomingHttpHeaders;
    query: {} = {};

    constructor(req: {
        method: HttpMethod;
        url: string;
        host: string;
        headers?: http.IncomingHttpHeaders;
        body?: Promise<string>;
        request?: http.IncomingMessage;
        query?: {};
        version?: number;
    }) {
        this.method = req.method;
        this.url = req.url;
        this.host = req.host;
        this.headers = req.headers ?? {};
        this.bodyPromise = req.body;
        this.query = req.query ?? {};
        this.request = req.request;
        this.version = req.version;
    }

    static buildJson(method: HttpMethod, url: string, host?: string, body?: any): Request {
        const parsedUrl = urlParser.parse(url, true);

        return new Request({
            method: method,
            url: parsedUrl.pathname ?? "",
            host: host || "",
            body: Promise.resolve(JSON.stringify(body) || ""),
            query: parsedUrl.query,
        });
    }

    /**
     * Return the number in the X-Version header or throw if invalid
     */
    getVersion(): number {
        if (this.version !== undefined) {
            return this.version;
        }
        // Check struct version in headers
        let version: number | undefined = (this.constructor as typeof Request).defaultVersion;

        if (this.headers["x-version"] && !Array.isArray(this.headers["x-version"])) {
            version = Number.parseInt(this.headers["x-version"]);
            if (isNaN(version)) {
                throw new EndpointError({
                    code: "invalid_header",
                    message: "The X-Version header should contain a valid integer",
                    statusCode: 400,
                });
            }
        }

        if (version === undefined) {
            throw new EndpointError({
                code: "missing_version",
                message: "Providing a version is required. Use the URL or the X-Version header.",
                statusCode: 400,
            });
        }

        this.version = version;
        return version;
    }

    static fromHttp(req: http.IncomingMessage): Request {
        if (!req.url) {
            throw new Error("Something went wrong");
        }

        const parsedUrl = urlParser.parse(req.url, true);
        let host = req.headers.host ?? "";

        let path = parsedUrl.pathname ?? "";

        // Remove port
        const splitted = host.split(":");
        host = splitted[0];

        console.log(req.method + " " + path);

        const urlVersionParts = path.split("/");
        let version: number | undefined;

        if (urlVersionParts.length > 1) {
            const possibleVersion = urlVersionParts[1];
            if (possibleVersion.substr(0, 1) == "v") {
                version = parseInt(possibleVersion.substr(1));
                if (isNaN(version)) {
                    version = undefined;
                } else {
                    path = path.substr(possibleVersion.length + 1);
                }
            }
        }

        return new Request({
            method: req.method as HttpMethod,
            url: parsedUrl.pathname ?? "",
            host: host,
            query: parsedUrl.query,
            request: req,
            headers: req.headers,
            version: version,
        });
    }
}

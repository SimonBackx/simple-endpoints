import http from "http";
import urlParser from "url";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS";
export class Request {
    method: HttpMethod;
    url: string;
    host: string;
    body: Promise<string>;

    headers: http.IncomingHttpHeaders;
    query: {} = {};

    constructor(req: { method: HttpMethod; url: string; host: string; headers?: http.IncomingHttpHeaders; body?: Promise<string>; query?: {} }) {
        this.method = req.method;
        this.url = req.url;
        this.host = req.host;
        this.headers = req.headers ?? {};
        this.body = req.body ?? Promise.resolve("");
        this.query = req.query ?? {};
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

    static fromHttp(req: http.IncomingMessage): Request {
        if (!req.url) {
            throw new Error("Something went wrong");
        }
        const body = new Promise<string>((resolve, reject) => {
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

        const parsedUrl = urlParser.parse(req.url, true);
        let host = req.headers.host ?? "";

        // Remove port
        const splitted = host.split(":");
        host = splitted[0];

        console.log(req.method + " " + parsedUrl.pathname);

        return new Request({
            method: req.method as HttpMethod,
            url: parsedUrl.pathname ?? "",
            host: host,
            query: parsedUrl.query,
            body: body,
        });
    }
}

import { Encodeable } from "@simonbackx/simple-encoding";
import http from "http";

import { Request } from "./Request";
import { Response } from "./Response";

export class EncodedResponse {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(response: Response<Encodeable | Encodeable[] | string | undefined>, request: Request) {
        this.status = response.status;
        this.headers = response.headers;

        if (response.body !== undefined) {
            if (!this.headers["Content-Type"]) {
                this.headers["Content-Type"] = "application/json";
            }

            if (this.headers["Content-Type"] == "application/json") {
                // Only require version if we have to encode something
                const version = request.getVersion();
                if (typeof response.body == "string") {
                    console.warn("We got a string value as body for JSON");
                    this.body = response.body;
                } else {
                    if (Array.isArray(response.body)) {
                        if (process.env.NODE_ENV === "development") {
                            this.body = JSON.stringify(response.body.map((e) => e.encode({ version })), undefined, 2);
                        } else {
                            this.body = JSON.stringify(response.body.map((e) => e.encode({ version })));
                        }
                    } else {
                        if (process.env.NODE_ENV === "development") {
                            this.body = JSON.stringify(response.body.encode({ version }), undefined, 2);
                        } else {
                            this.body = JSON.stringify(response.body.encode({ version }));
                        }
                    }
                }
            } else {
                if (typeof response.body == "string") {
                    this.body = response.body;
                } else {
                    console.error("Unexpected non-string value as body");
                    this.body = "";
                }
            }
        } else {
            this.body = "";
        }
    }
}

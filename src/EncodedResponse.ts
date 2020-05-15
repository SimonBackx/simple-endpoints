import { Encodeable } from "@simonbackx/simple-encoding";
import http from "http";

import { Response } from "./Response";

export class EncodedResponse {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(response: Response<Encodeable | Encodeable[] | undefined>) {
        this.status = response.status;
        this.headers = response.headers;

        if (response.body !== undefined) {
            if (!this.headers["Content-Type"]) {
                this.headers["Content-Type"] = "application/json";
            }
            if (Array.isArray(response.body)) {
                this.body = JSON.stringify(response.body.map((e) => e.encode()));
            } else {
                this.body = JSON.stringify(response.body.encode());
            }
        } else {
            this.body = "";
        }
    }
}

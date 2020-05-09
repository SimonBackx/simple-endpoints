import { Data } from "@simonbackx/simple-encoding";

import { EndpointError } from "./EndpointError";

// Error that is caused by a client and should be reported to the client
export class EndpointErrors extends Error {
    errors: EndpointError[];

    constructor(...errors: EndpointError[]) {
        super(errors.map((e) => e.toString()).join("\n"));
        this.errors = errors;
    }

    addError(error: EndpointError | EndpointErrors) {
        if (error instanceof EndpointError) {
            this.errors.push(error);
            this.message += "\n" + error.toString();
        } else if (error instanceof EndpointErrors) {
            this.errors.push(...error.errors);
            this.message += "\n" + error.toString();
        } else {
            throw new Error("Unsupported addError");
        }
    }

    get statusCode(): number | undefined {
        return this.errors.find((e) => e.statusCode !== undefined)?.statusCode;
    }

    removeErrorAt(index: number) {
        this.errors.splice(index, 1);
    }

    addNamespace(field: string) {
        this.errors.forEach((e) => {
            e.addNamespace(field);
        });
    }

    /**
     * Required to override the default toJSON behaviour of Error
     */
    toJSON() {
        return {
            errors: this.errors,
        };
    }

    static decode(data: Data): EndpointErrors {
        return new EndpointErrors(...data.field("errors").array(EndpointError));
    }

    throwIfNotEmpty() {
        if (this.errors.length > 0) {
            if (this.errors.length == 1) {
                throw this.errors[0];
            }
            throw this;
        }
    }

    /// Returns a human description of all the errors
    getHuman(): string {
        return this.errors
            .filter((e) => !!e.human)
            .map((e) => e.human)
            .join("\n");
    }
}

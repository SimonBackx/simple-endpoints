import { Data, Encodeable } from "@simonbackx/simple-encoding";

// Error that is caused by a client and should be reported to the client
export class EndpointError extends Error implements Encodeable {
    id: string;
    code: string;
    message: string;
    human: string | undefined;
    field: string | undefined;

    /**
     * Used to determine the associated HTTP status code when thrown in an endpoint
     */
    statusCode?: number;

    /// Error counter. All errors get numbered since the start of the server
    static counter = 0;

    constructor(error: { code: string; message: string; human?: string; field?: string; statusCode?: number; id?: string }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.human = error.human;
        this.field = error.field;
        this.statusCode = error.statusCode;
        this.id = error.id ?? this.generateID();

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EndpointError);
        }
    }

    toString(): string {
        return this.code + ": " + this.message + (this.field ? " at " + this.field : "") + " (" + this.id + ")";
    }

    /**
     * Required to override the default toJSON behaviour of Error
     */
    toJSON() {
        return this.encode();
    }

    encode() {
        return {
            id: this.id,
            code: this.code,
            message: this.message,
            human: this.human,
            field: this.field,
        };
    }

    static decode(data: Data): EndpointError {
        return new EndpointError({
            id: data.field("id").string,
            code: data.field("code").string,
            message: data.field("message").string,
            human: data.optionalField("human")?.string,
            field: data.optionalField("field")?.string,
        });
    }

    doesMatchFields(fields: string[]): boolean {
        for (const field of fields) {
            if (this.doesMatchField(field)) {
                return true;
            }
        }
        return false;
    }

    doesMatchField(field: string): boolean {
        if (!this.field) {
            return false;
        }

        return this.field.startsWith(field);
    }

    generateID(): string {
        EndpointError.counter += 1;
        return new Date().getTime() + "-" + EndpointError.counter;
    }

    addNamespace(field: string) {
        this.field = this.field ? field + "." + this.field : field;
    }

    /// Returns a human description of all the errors
    getHuman(): string {
        return this.human ?? this.message;
    }
}

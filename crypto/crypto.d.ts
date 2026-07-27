export declare class Counter {
    _counter: Buffer;
    constructor(initialValue: any);
    increment(): void;
}
export declare class CTR {
    private _counter;
    private _remainingCounter?;
    private _remainingCounterIndex;
    private _aes;
    constructor(key: Buffer, counter: any);
    update(plainText: any): Buffer<any>;
    encrypt(plainText: any): Buffer<any>;
}
export declare function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer): CTR;
export declare function createCipheriv(algorithm: string, key: Buffer, iv: Buffer): CTR;
export declare function randomBytes(count: number): Uint8Array<ArrayBuffer>;
export declare class Hash {
    private readonly algorithm;
    private data?;
    constructor(algorithm: string);
    update(data: Buffer): void;
    digest(): Promise<Buffer<ArrayBuffer>>;
}
export declare function pbkdf2Sync(password: any, salt: any, iterations: any, ...args: any): Promise<Buffer<ArrayBuffer>>;
export declare function createHash(algorithm: string): Hash;

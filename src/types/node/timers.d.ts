
/* NOTE: Do not edit directly! This file is generated using `npm run update-types` in https://github.com/Steve-Mcl/monaco-editor-esm-i18n */

declare module 'timers' {
    function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout;
    namespace setTimeout {
        function __promisify__(ms: number): Promise<void>;
        function __promisify__<T>(ms: number, value: T): Promise<T>;
    }
    function clearTimeout(timeoutId: NodeJS.Timeout): void;
    function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout;
    function clearInterval(intervalId: NodeJS.Timeout): void;
    function setImmediate(callback: (...args: any[]) => void, ...args: any[]): NodeJS.Immediate;
    namespace setImmediate {
        function __promisify__(): Promise<void>;
        function __promisify__<T>(value: T): Promise<T>;
    }
    function clearImmediate(immediateId: NodeJS.Immediate): void;
}
declare module 'node:timers' {
    export * from 'timers';
}

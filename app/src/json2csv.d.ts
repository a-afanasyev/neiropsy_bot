/**
 * Декларация типов для json2csv
 */

declare module 'json2csv' {
  export class Parser {
    constructor(opts?: any);
    parse(data: any[]): string;
  }
}


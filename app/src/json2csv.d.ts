// Type declarations for json2csv module
// Простые определения типов для работы с json2csv

declare module 'json2csv' {
  /**
   * Класс Parser для преобразования JSON в CSV
   */
  export class Parser {
    /**
     * Конструктор Parser
     * @param opts - опции парсера (опционально)
     */
    constructor(opts?: any);
    
    /**
     * Преобразовать массив объектов в CSV строку
     * @param data - данные для преобразования
     * @returns CSV строка
     */
    parse(data: any[]): string;
  }
}


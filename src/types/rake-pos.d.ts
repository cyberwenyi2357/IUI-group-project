declare module 'rake-pos' {
    export default class Rake {
        constructor();
        extractKeywords(text: string): string[];
    }
} 
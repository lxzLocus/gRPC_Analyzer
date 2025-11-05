export default class RestoreDiff {
    constructor(inputProjectDir: string);
    applyDiff(diff: string): string;
}
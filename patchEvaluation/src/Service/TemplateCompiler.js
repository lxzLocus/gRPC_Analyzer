
import handlebars from 'handlebars';

class TemplateRenderer {
    // テンプレート文字列を受け取り、内部でコンパイルして保持（これが「状態」）
    constructor(templateString) {
        if (!templateString) {
            throw new Error("Template string cannot be empty.");
        }
        // コンパイルした結果をインスタンスのプロパティとして保持します。
        this.template = handlebars.compile(templateString);
    }

    // 外部からデータ（context）を受け取り、描画結果を返す（これが「振る舞い」）
    render(context) {
        // contextをそのまま渡す（汎用的な実装）
        return this.template(context);
    }
}

export { TemplateRenderer };

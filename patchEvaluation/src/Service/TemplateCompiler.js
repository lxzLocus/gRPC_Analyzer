
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
        // contextの検証などをここに入れることもできる
        const {
            code_context,
            ground_truth_diff,
            agent_generated_diff,
            agent_thought_process
        } = context;

        return this.template({
            code_context,
            ground_truth_diff,
            agent_generated_diff,
            agent_thought_process
        });
    }
}

export { TemplateRenderer };

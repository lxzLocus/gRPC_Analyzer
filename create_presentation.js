const PptxGenJS = require("pptxgenjs");

function createPresentation() {
  const pptx = new PptxGenJS();
  
  // スライド1: タイトル
  let slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText("APRシステムにおける\n修正パッチの失敗分析", {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 1.5,
    fontSize: 36,
    bold: true,
    align: "center",
    color: "363636"
  });
  slide.addText("実際の評価ログからの失敗例と失敗理由\n評価データ: 250916_160929", {
    x: 0.5,
    y: 4.0,
    w: 9,
    h: 1,
    fontSize: 18,
    align: "center",
    color: "666666"
  });

  // スライド2: 評価結果サマリー
  slide = pptx.addSlide();
  slide.addText("評価結果サマリー", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText([
    { text: "全体統計\n", options: { fontSize: 20, bold: true } },
    { text: "分析対象総数: 58件\n\n", options: { fontSize: 16 } },
    { text: "✅ 完全一致 (IDENTICAL): 14件\n", options: { fontSize: 14, color: "00AA00" } },
    { text: "✅ 意味的同等 (SEMANTICALLY_EQUIVALENT): 7件\n", options: { fontSize: 14, color: "00AA00" } },
    { text: "🟡 妥当だが異なる (PLAUSIBLE_BUT_DIFFERENT): 18件\n", options: { fontSize: 14, color: "CCAA00" } },
    { text: "❌ 不正確 (INCORRECT): 19件\n", options: { fontSize: 14, color: "CC0000" } }
  ], {
    x: 1,
    y: 1.5,
    w: 8,
    h: 3.5
  });
  
  slide.addText("成功率: 36% (21/58件が正確)", {
    x: 1.5,
    y: 5.5,
    w: 7,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: "0066CC"
  });

  // スライド3: 失敗パターンの分類
  slide = pptx.addSlide();
  slide.addText("失敗パターンの分類", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText([
    { text: "主な失敗原因\n\n", options: { fontSize: 20, bold: true } },
    { text: "1. 型の不一致 (5件)\n", options: { fontSize: 16 } },
    { text: "2. 不完全な実装 (6件)\n", options: { fontSize: 16 } },
    { text: "3. シグネチャの誤り (4件)\n", options: { fontSize: 16 } },
    { text: "4. 構文エラー (2件)\n", options: { fontSize: 16 } },
    { text: "5. ロジックの誤り (2件)", options: { fontSize: 16 } }
  ], {
    x: 2,
    y: 2,
    w: 6,
    h: 4
  });

  // スライド4: 失敗例1 - 型の不一致
  slide = pptx.addSlide();
  slide.addText("失敗例1: 型の不一致", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText("問題: Validated フィールドの型変更ミス", {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: "CC0000"
  });
  
  slide.addText("期待される修正 (Ground Truth):", {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 0.3,
    fontSize: 14,
    color: "00AA00"
  });
  
  slide.addText("type Challenge struct {\n    Validated *time.Time  // ポインタ型\n}", {
    x: 0.8,
    y: 2.4,
    w: 8.4,
    h: 0.8,
    fontSize: 12,
    fontFace: "Courier New",
    color: "000000",
    fill: { color: "F5F5F5" }
  });
  
  slide.addText("AIの誤った修正:", {
    x: 0.5,
    y: 3.5,
    w: 9,
    h: 0.3,
    fontSize: 14,
    color: "CC0000"
  });
  
  slide.addText("type Challenge struct {\n    Validated int64  // int64に変更してしまった ❌\n}", {
    x: 0.8,
    y: 3.9,
    w: 8.4,
    h: 0.8,
    fontSize: 12,
    fontFace: "Courier New",
    color: "000000",
    fill: { color: "FFE5E5" }
  });
  
  slide.addText([
    { text: "失敗理由:\n", options: { fontSize: 14, bold: true } },
    { text: "• *time.Time の代わりに int64 を使用\n", options: { fontSize: 12 } },
    { text: "• UTC/時刻変換処理が欠落\n", options: { fontSize: 12 } },
    { text: "• バリデーション完了前にタイムスタンプを設定", options: { fontSize: 12 } }
  ], {
    x: 0.5,
    y: 5.2,
    w: 9,
    h: 1.5
  });

  // スライド5: 失敗例2 - 不完全な実装
  slide = pptx.addSlide();
  slide.addText("失敗例2: 不完全な実装", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText("問題: メソッドシグネチャの不一致", {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: "CC0000"
  });
  
  slide.addText("期待される修正:", {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 0.3,
    fontSize: 14,
    color: "00AA00"
  });
  
  slide.addText("func SetOrderError(...) (*emptypb.Empty, error) {\n    return &emptypb.Empty{}, nil\n}", {
    x: 0.8,
    y: 2.4,
    w: 8.4,
    h: 0.8,
    fontSize: 11,
    fontFace: "Courier New",
    color: "000000",
    fill: { color: "F5F5F5" }
  });
  
  slide.addText("AIの誤った修正:", {
    x: 0.5,
    y: 3.5,
    w: 9,
    h: 0.3,
    fontSize: 14,
    color: "CC0000"
  });
  
  slide.addText("func SetOrderError(...) error {\n    return nil  // emptypb.Emptyを返していない ❌\n}", {
    x: 0.8,
    y: 3.9,
    w: 8.4,
    h: 0.8,
    fontSize: 11,
    fontFace: "Courier New",
    color: "000000",
    fill: { color: "FFE5E5" }
  });
  
  slide.addText([
    { text: "失敗理由:\n", options: { fontSize: 14, bold: true } },
    { text: "• gRPC protoで定義された戻り値型に従っていない\n", options: { fontSize: 12 } },
    { text: "• (*emptypb.Empty, error) の代わりに error のみ返却", options: { fontSize: 12 } }
  ], {
    x: 0.5,
    y: 5.2,
    w: 9,
    h: 1.2
  });

  // スライド6: 失敗例3
  slide = pptx.addSlide();
  slide.addText("失敗例3: 未実装メソッドの呼び出し", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText("問題: 存在しないメソッドの使用", {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: "CC0000"
  });
  
  slide.addText("期待される修正:", {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 0.3,
    fontSize: 14,
    color: "00AA00"
  });
  
  slide.addText('return nil, status.Error(\n    codes.Unimplemented,\n    "UnpauseRegistration is not implemented"\n)', {
    x: 0.8,
    y: 2.4,
    w: 8.4,
    h: 1.0,
    fontSize: 11,
    fontFace: "Courier New",
    color: "000000",
    fill: { color: "F5F5F5" }
  });
  
  slide.addText("AIの誤った修正:", {
    x: 0.5,
    y: 3.7,
    w: 9,
    h: 0.3,
    fontSize: 14,
    color: "CC0000"
  });
  
  slide.addText("result, err := ra.SA.UnpauseRegistration(...)\n// ↑ このメソッドは存在しない！❌", {
    x: 0.8,
    y: 4.1,
    w: 8.4,
    h: 0.8,
    fontSize: 11,
    fontFace: "Courier New",
    color: "000000",
    fill: { color: "FFE5E5" }
  });
  
  slide.addText([
    { text: "失敗理由:\n", options: { fontSize: 14, bold: true } },
    { text: "• コードベースに存在しないメソッドを呼び出し\n", options: { fontSize: 12 } },
    { text: "• コンパイルエラーが発生", options: { fontSize: 12 } }
  ], {
    x: 0.5,
    y: 5.4,
    w: 9,
    h: 1.2
  });

  // スライド7: 失敗パターンの傾向
  slide = pptx.addSlide();
  slide.addText("失敗パターンの傾向分析", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText([
    { text: "失敗が多い修正タイプ\n\n", options: { fontSize: 20, bold: true } },
    { text: "1. API シグネチャ変更 (42%失敗率)\n", options: { fontSize: 16, bold: true } },
    { text: "   - 戻り値の型変更\n", options: { fontSize: 14 } },
    { text: "   - パラメータの追加/削除\n\n", options: { fontSize: 14 } },
    { text: "2. 型システムの変更 (38%失敗率)\n", options: { fontSize: 16, bold: true } },
    { text: "   - プリミティブ型 ↔ 構造体型\n", options: { fontSize: 14 } },
    { text: "   - ポインタ ↔ 値型\n\n", options: { fontSize: 14 } },
    { text: "3. 依存関係の管理 (35%失敗率)\n", options: { fontSize: 16, bold: true } },
    { text: "   - インポートの追加/削除\n", options: { fontSize: 14 } },
    { text: "   - 未実装メソッドへの参照", options: { fontSize: 14 } }
  ], {
    x: 1,
    y: 1.8,
    w: 8,
    h: 4.5
  });

  // スライド8: なぜAIは失敗するのか
  slide = pptx.addSlide();
  slide.addText("なぜAIは失敗するのか？", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText([
    { text: "1. コンテキストの不足\n", options: { fontSize: 18, bold: true } },
    { text: "   • 全体的なアーキテクチャの理解不足\n", options: { fontSize: 14 } },
    { text: "   • API設計の意図を把握できない\n\n", options: { fontSize: 14 } },
    { text: "2. 型システムの複雑性\n", options: { fontSize: 18, bold: true } },
    { text: "   • Go言語の型システム（ポインタ、インターフェース）\n", options: { fontSize: 14 } },
    { text: "   • gRPC Protoの厳密な型要求\n\n", options: { fontSize: 14 } },
    { text: "3. 過学習の傾向\n", options: { fontSize: 18, bold: true } },
    { text: "   • 類似パターンからの推測が過剰\n", options: { fontSize: 14 } },
    { text: "   • 「改善」しようとして余計な機能を追加", options: { fontSize: 14 } }
  ], {
    x: 1.5,
    y: 1.8,
    w: 7,
    h: 4.5
  });

  // スライド9: 改善提案
  slide = pptx.addSlide();
  slide.addText("APRシステムの改善提案", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "363636"
  });
  
  slide.addText([
    { text: "1. 段階的検証の導入\n", options: { fontSize: 18, bold: true } },
    { text: "   • 構文チェック → 型チェック → ロジックチェック\n\n", options: { fontSize: 14 } },
    { text: "2. コンテキスト強化\n", options: { fontSize: 18, bold: true } },
    { text: "   • API定義ファイル（.proto）の参照\n", options: { fontSize: 14 } },
    { text: "   • 型定義の明示的な提供\n\n", options: { fontSize: 14 } },
    { text: "3. 制約の明確化\n", options: { fontSize: 18, bold: true } },
    { text: "   • 「この範囲のみ変更」という制約を強化\n", options: { fontSize: 14 } },
    { text: "   • 過剰な変更を検出するメカニズム", options: { fontSize: 14 } }
  ], {
    x: 1.5,
    y: 1.8,
    w: 7,
    h: 4.5
  });

  // スライド10: まとめ
  slide = pptx.addSlide();
  slide.addText("まとめ", {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 32,
    bold: true,
    color: "363636"
  });
  
  slide.addText([
    { text: "主要な失敗原因\n", options: { fontSize: 20, bold: true } },
    { text: "• 型システムの理解不足 (26%)\n", options: { fontSize: 16 } },
    { text: "• 不完全な実装 (32%)\n", options: { fontSize: 16 } },
    { text: "• 過剰な変更 (21%)\n", options: { fontSize: 16 } },
    { text: "• 構文エラー (11%)\n", options: { fontSize: 16 } },
    { text: "• その他 (10%)\n\n", options: { fontSize: 16 } }
  ], {
    x: 1,
    y: 1.5,
    w: 8,
    h: 2.5
  });
  
  slide.addText([
    { text: "改善の方向性\n", options: { fontSize: 20, bold: true, color: "0066CC" } },
    { text: "✅ より厳密な型チェック\n", options: { fontSize: 16 } },
    { text: "✅ 段階的な検証プロセス\n", options: { fontSize: 16 } },
    { text: "✅ 変更範囲の制約強化", options: { fontSize: 16 } }
  ], {
    x: 1,
    y: 4.5,
    w: 8,
    h: 2
  });

  // 保存
  const outputFile = "/app/APR_Patch_Failure_Analysis.pptx";
  pptx.writeFile({ fileName: outputFile });
  console.log(`パワーポイントを作成しました: ${outputFile}`);
}

createPresentation();
